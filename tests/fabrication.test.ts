import { describe, expect, it } from 'vitest';
import {
  FABRICATION_RULES,
  fabricationSignature,
  fabricationPositions,
  fabricationCandidates,
  groupFabrication,
  ungroupFabrication,
  previewFabrication,
  validateFabrication,
} from '../src/domain/fabrication';
import {
  emptyProject,
  newBar,
  decodeProject,
  schedule,
  scheduleChanged,
  createScheduleLock,
  scheduleQuantityLabel,
} from '../src/domain/model';
import {
  completeOwnership,
  createHierarchyNode,
} from '../src/domain/hierarchy';
import {
  executeRebarBatch,
  applyRebarBatch,
  type RebarCommand,
} from '../src/domain/rebarApi';
import {
  createDetailPackage,
  readDetailPackage,
} from '../src/domain/detailPackage';
import {
  previewDetailTransfer,
  applyDetailTransfer,
} from '../src/domain/detailTransfer';
import {
  previewMergeRepetitions,
  applyMergeRepetitions,
  setDetailRepetition,
} from '../src/domain/detailRepetition';
import { toCsv, toDxf, toSheetPdf } from '../src/lib/exports';
import { annotationPrimitives } from '../src/domain/drafting';
import type { Bar, Project } from '../src/domain/types';
const pieces = (p: Project) => schedule(p).reduce((n, r) => n + r.quantity, 0);
const weight = (p: Project) => schedule(p).reduce((n, r) => n + r.weight, 0);
function fixture() {
  const a: Bar = {
    ...newBar('N1'),
    id: 'a',
    diameter: 10,
    mandrel: 50,
    quantity: 4,
  };
  const b: Bar = {
    ...a,
    id: 'b',
    mark: 'N2',
    quantity: 3,
    origin: { x: 2500, y: 1500 },
    rotation: 47,
    color: '#ff0000',
  };
  return completeOwnership({
    ...emptyProject(),
    bars: [a, b],
    details: [{ id: 'rep', barId: 'b', origin: { x: 0, y: 500 } }],
    annotations: [
      {
        id: 'call',
        kind: 'leader',
        barId: 'b',
        points: [
          { x: 0, y: 0 },
          { x: 30, y: 30 },
          { x: 100, y: 30 },
        ],
        label: '',
        textHeight: 40,
        color: '#ffffff',
      },
    ],
  });
}
const run = (p: Project, commands: RebarCommand[]) => {
  const r = executeRebarBatch(p, commands, { units: 'mm' });
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return applyRebarBatch(p, r);
};
const grouped = (p = fixture()) =>
  run(p, [
    { type: 'fabrication.group', ids: ['a', 'b'], representativeId: 'a' },
  ]);

describe('AS-54 · posição de fabricação e ocorrências', () => {
  it('soma barras deslocadas/rotacionadas, mantém IDs, chamadas, rebatimentos e massa analítica', () => {
    const p = fixture(),
      next = grouped(p),
      rows = schedule(next);
    expect(rows).toHaveLength(1);
    expect(rows[0].quantity).toBe(7);
    expect(rows[0].totalLength).toBe(7);
    expect(rows[0].weight).toBeCloseTo(
      ((7 * Math.PI * 0.01 ** 2) / 4) * 7850,
      12,
    );
    expect(next.bars.map((b) => b.id)).toEqual(['a', 'b']);
    expect(next.details).toBe(p.details);
    expect(next.annotations).toBe(p.annotations);
    expect(rows[0].positionId).toBe(fabricationPositions(p)[0].id);
    expect(rows[0].contributions.map((c) => c.barId)).toEqual(['a', 'b']);
    expect(annotationPrimitives(next.annotations[0], next)).toEqual(
      annotationPrimitives({ ...p.annotations[0] }, next),
    );
    expect(
      JSON.stringify(annotationPrimitives(next.annotations[0], next)),
    ).toContain('N1');
    expect(p.bars[1].mark).toBe('N2');
    expect(weight(next)).toBeCloseTo(weight(p), 12);
  });
  it('não confunde um L e uma reta com o mesmo comprimento desenvolvido', () => {
    const p = fixture(),
      a = {
        ...p.bars[0],
        points: [
          { x: 0, y: 0 },
          { x: 1000, y: 0 },
          { x: 1000, y: 500 },
        ],
      };
    const length = 1500 - 60 + (30 * Math.PI) / 2;
    const b = {
      ...p.bars[1],
      points: [
        { x: 0, y: 0 },
        { x: length, y: 0 },
      ],
    };
    expect(fabricationSignature(a)).not.toBe(fabricationSignature(b));
    expect(
      previewFabrication({ ...p, bars: [a, b] }, ['a', 'b'], 'a').issues[0],
    ).toMatch(/não são equivalentes/);
  });
  it.each([
    'steel',
    'diameter',
    'mandrel',
    'hook',
    'coupler',
    'termination',
    'variant',
  ] as const)('%s diferente impede equivalência', (field) => {
    const p = fixture();
    let a = p.bars[0],
      b = p.bars[1];
    if (field === 'steel') b = { ...b, steel: 'CA-60' };
    if (field === 'diameter') b = { ...b, diameter: 12.5 };
    if (field === 'mandrel') b = { ...b, mandrel: 60 };
    if (field === 'hook') {
      a = { ...a, kind: 'stirrup', hook: 80 };
      b = { ...b, kind: 'stirrup', hook: 100 };
    }
    if (field === 'coupler')
      b = {
        ...b,
        manufacturing: { start: { kind: 'coupler', code: 'M20-A' } },
      };
    if (field === 'termination')
      b = { ...b, manufacturing: { end: { kind: 'headed', code: 'H20' } } };
    if (field === 'variant') b = { ...b, manufacturing: { variant: 'X' } };
    expect(fabricationSignature(a)).not.toBe(fabricationSignature(b));
  });
  it('troca terminações com o percurso reverso e mantém peças espelhadas assimétricas distintas', () => {
    const a = {
      ...fixture().bars[0],
      points: [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { x: 1000, y: 500 },
      ],
      manufacturing: { start: { kind: 'coupler' as const, code: 'M20' } },
    };
    const reverse = {
      ...a,
      points: [...a.points].reverse(),
      manufacturing: { end: a.manufacturing.start },
    };
    expect(fabricationSignature(a, true)).toBe(
      fabricationSignature(reverse, true),
    );
    expect(fabricationSignature(a, false)).not.toBe(
      fabricationSignature(reverse, false),
    );
    expect(fabricationSignature(a)).not.toBe(
      fabricationSignature({
        ...a,
        points: a.points.map((p) => ({ x: -p.x, y: p.y })),
      }),
    );
    expect(fabricationSignature(a)).not.toBe(
      fabricationSignature({ ...reverse, manufacturing: a.manufacturing }),
    );
  });
  it('usa grade transitiva explícita e soma os comprimentos reais, sem arredondar a geometria física', () => {
    const p = fixture();
    p.bars[1].points = [
      { x: 0, y: 0 },
      { x: 1000.0004, y: 0 },
    ];
    expect(FABRICATION_RULES.lengthGrid).toBe(0.001);
    const q = grouped(p),
      row = schedule(q)[0];
    expect(row.totalLength).toBeCloseTo(4 + 3 * 1.0000004, 12);
    expect(row.unitLengthRange).toEqual([1, 1.0000004]);
    expect(q.bars[1].points[1].x).toBe(1000.0004);
    expect(
      fabricationSignature({
        ...p.bars[1],
        points: [
          { x: 0, y: 0 },
          { x: 1000.0006, y: 0 },
        ],
      }),
    ).not.toBe(fabricationSignature(p.bars[0]));
  });
  it('ignora quantidade, faixa, propriedade visual e vistas na assinatura', () => {
    const p = fixture();
    expect(fabricationSignature(p.bars[0])).toBe(
      fabricationSignature({
        ...p.bars[1],
        quantity: 10,
        distribution: { end: { x: 10000, y: 20 } },
        element: 'outro',
      }),
    );
  });
  it('mudar a primeira ocorrência separa somente ela, preservando as outras e os IDs de chamada', () => {
    const p = grouped(),
      sharedId = fabricationPositions(p)[0].id;
    const q = run(p, [
      { type: 'bar.update', id: 'a', patch: { kind: 'free', diameter: 12.5 } },
    ]);
    expect(schedule(q)).toHaveLength(2);
    expect(q.bars[0].mark).not.toBe(q.bars[1].mark);
    expect(q.bars[1]).toEqual(p.bars[1]);
    expect(
      fabricationPositions(q).find((g) => g.barIds.includes('b'))!.id,
    ).toBe(sharedId);
    expect(q.annotations).toBe(p.annotations);
    expect(p.bars[0].diameter).toBe(10);
    expect(decodeProject(JSON.stringify(q))).toEqual(q);
  });
  it('editar quantidade/mover preserva a posição, e renumerar renumera posições uma única vez', () => {
    const p = grouped(),
      id = fabricationPositions(p)[0].id;
    const q = run(p, [
      { type: 'bar.update', id: 'b', patch: { kind: 'free', quantity: 8 } },
      { type: 'bar.move', id: 'a', delta: { x: 500, y: 700 } },
      { type: 'bar.renumber' },
    ]);
    expect(schedule(q)).toHaveLength(1);
    expect(pieces(q)).toBe(12);
    expect(fabricationPositions(q)[0].id).toBe(id);
    expect(q.bars.map((b) => b.mark)).toEqual(['N1', 'N1']);
  });
  it('desagrupa tudo ou uma ocorrência, mantendo aço, posições remanescentes e chamadas', () => {
    const p = grouped();
    for (const ids of [['a'], ['a', 'b']]) {
      const q = ungroupFabrication(p, ids);
      expect(schedule(q)).toHaveLength(2);
      expect(pieces(q)).toBe(7);
      expect(weight(q)).toBeCloseTo(weight(p), 12);
      expect(q.annotations).toBe(p.annotations);
      expect(q.details).toBe(p.details);
      expect(new Set(q.bars.map((b) => b.mark)).size).toBe(2);
      expect(decodeProject(JSON.stringify(q))).toEqual(q);
    }
  });
  it('RA congela posições, contribuições e quantidades; agrupamento explícito invalida o bloqueio', () => {
    const p = grouped();
    p.scheduleLock = createScheduleLock(p, 'frozen');
    const old = schedule(p);
    expect(scheduleChanged(p)).toBe(false);
    const q = run(p, [
      { type: 'bar.update', id: 'b', patch: { kind: 'free', diameter: 12.5 } },
    ]);
    expect(scheduleChanged(q)).toBe(true);
    expect(schedule(q)).toEqual(old);
    expect(schedule({ ...q, scheduleLock: undefined })).toHaveLength(2);
    const r = executeRebarBatch(
      p,
      [{ type: 'fabrication.ungroup', ids: ['b'] }],
      { units: 'mm' },
    );
    expect(r.ok && r.receipt.scheduleInvalidated).toBe(true);
    expect(r.project.scheduleLock).toBeUndefined();
    expect(decodeProject(JSON.stringify(p)).scheduleLock).toEqual(
      p.scheduleLock,
    );
  });
  it('falha em lote é atômica, inclusive após agrupamento, e resultados antigos não podem ser aplicados', () => {
    const p = fixture();
    const r = executeRebarBatch(
      p,
      [
        { type: 'fabrication.group', ids: ['a', 'b'], representativeId: 'a' },
        { type: 'bar.update', id: 'a', patch: { kind: 'free', diameter: -1 } },
      ],
      { units: 'mm' },
    );
    expect(r.ok).toBe(false);
    expect(r.project).toBe(p);
    expect(schedule(p)).toHaveLength(2);
    const result = executeRebarBatch(
      p,
      [{ type: 'fabrication.group', ids: ['a', 'b'], representativeId: 'a' }],
      { units: 'mm' },
    );
    expect(() => applyRebarBatch({ ...p }, result)).toThrow(/mudou/);
    expect(result.base).toBe(p); // one immutable result is one editor history entry
  });
  it('protege contexto isolado e devolve erro estruturado para ocorrência inexistente e marca em uso', () => {
    const p = fixture();
    const result = executeRebarBatch(
      p,
      [
        {
          type: 'fabrication.group',
          ids: ['a', 'missing'],
          representativeId: 'a',
        },
      ],
      { units: 'mm' },
    );
    expect(!result.ok && result.issues[0]).toMatchObject({
      code: 'NOT_FOUND',
      field: 'id',
      objectId: 'missing',
    });
    const isolated = executeRebarBatch(
      p,
      [{ type: 'fabrication.group', ids: ['a', 'b'], representativeId: 'a' }],
      { units: 'mm', scopeDetailId: p.hierarchy.details[0].id },
    );
    expect(!isolated.ok && isolated.issues[0].field).toBe('scopeDetailId');
    const third = completeOwnership({
      ...p,
      bars: [...p.bars, { ...p.bars[0], id: 'c', mark: 'N3' }],
    });
    expect(() => groupFabrication(third, ['a', 'b'], 'a', true, 'N3')).toThrow(
      /já é usada/,
    );
  });
  it('aceita múltiplos detalhes com fatores diferentes, sem fabricar aço por rebatimento/vista', () => {
    let p = fixture();
    const d1 = p.hierarchy.details[0].id;
    const n = createHierarchyNode(
      p,
      'detail',
      'Outro',
      p.hierarchy.elements[0].id,
    );
    p = {
      ...n.project,
      hierarchy: {
        ...n.project.hierarchy,
        objectDetails: { ...n.project.hierarchy.objectDetails, b: n.id },
      },
    };
    p = setDetailRepetition(p, d1, { factor: 3, elements: [] });
    p = setDetailRepetition(p, n.id, { factor: 2, elements: [] });
    const q = grouped(p),
      row = schedule(q)[0];
    expect(row.quantity).toBe(4 * 3 + 3 * 2);
    expect(row.contributions.map((c) => c.repetitions)).toEqual([3, 2]);
    expect(scheduleQuantityLabel(row)).toBe('4×3 + 3×2 = 18');
    expect(row.repetitions).toBeNull();
    expect(row.contributions[1].origin).toContain('Outro');
    expect(toCsv(q)).toContain('Contribuições por ocorrência');
    expect(toDxf(q)).toContain('4x3 + 3x2 = 18');
    expect(toSheetPdf(q).byteLength).toBeGreaterThan(1000);
    expect(weight(q)).toBeCloseTo(weight(p), 12);
  });
  it.each([1, 2, 3, 4, 5, 6, 7])(
    'migração v%s preserva barras, vínculos, quantidades e pesos',
    (v) => {
      const p = fixture();
      const old = {
        ...p,
        schema: `armadurastruct/${v}`,
        fabricationPositions: undefined,
      };
      const q = decodeProject(JSON.stringify(old));
      expect(q.schema).toBe('armadurastruct/24');
      expect(q.bars).toEqual(p.bars);
      expect(q.annotations).toMatchObject(p.annotations);
      expect(pieces(q)).toBe(7);
      expect(weight(q)).toBeCloseTo(weight(p), 12);
      expect(fabricationPositions(q)).toHaveLength(2);
    },
  );
  it('rejeita grupos corrompidos, IDs/marcas repetidos sem equivalência e propriedades desconhecidas', () => {
    const p = grouped();
    const corrupt = {
      ...p,
      bars: p.bars.map((b) => (b.id === 'b' ? { ...b, steel: 'CA-60' } : b)),
    };
    expect(() => decodeProject(JSON.stringify(corrupt))).toThrow(
      /não equivalentes/,
    );
    const solo = fixture();
    solo.bars[1].mark = 'N1';
    expect(() => decodeProject(JSON.stringify(solo))).toThrow(/identificação/);
    const raw = {
      ...p,
      bars: p.bars.map((b) => ({ ...b, coupler: 'unknown' })),
    };
    expect(() => decodeProject(JSON.stringify(raw))).toThrow();
    expect(
      fabricationSignature({ ...p.bars[0], coupler: 'unknown' } as Bar),
    ).toBeUndefined();
    expect(fabricationCandidates(corrupt as Project)).toHaveLength(0);
  });
  it.each(['mm', 'cm', 'm'] as const)(
    'pacote v3 em %s conserva agrupamento e contribuições após importar',
    (unit) => {
      const p = grouped();
      const pack = createDetailPackage(p, p.hierarchy.details[0].id, {
        producer: { app: 'test', version: '1' },
        unit,
      });
      expect(pack.schema).toBe('openstruct.detail/15');
      const source = readDetailPackage(JSON.stringify(pack)).project;
      expect(schedule(source)).toHaveLength(1);
      expect(pieces(source)).toBe(7);
      expect(weight(source)).toBeCloseTo(weight(p), 10);
      const target = emptyProject();
      const plan = previewDetailTransfer(target, source, {
        sourceDetailId: pack.origin.detailId,
        mode: 'insert',
        targetElementId: target.hierarchy.elements[0].id,
      });
      expect(plan.issues).toEqual([]);
      const q = applyDetailTransfer(target, plan);
      expect(schedule(q)).toHaveLength(1);
      expect(pieces(q)).toBe(7);
      expect(weight(q)).toBeCloseTo(weight(p), 10);
      validateFabrication(q);
    },
  );
  it('exportar subconjunto de uma posição não inclui aço de outro detalhe e aceita contratos v1/v2', () => {
    const p = grouped();
    const d = createHierarchyNode(
      p,
      'detail',
      'Outro',
      p.hierarchy.elements[0].id,
    );
    const split = {
      ...d.project,
      hierarchy: {
        ...d.project.hierarchy,
        objectDetails: {
          ...d.project.hierarchy.objectDetails,
          b: d.id,
          rep: d.id,
          call: d.id,
        },
      },
    };
    const pack = createDetailPackage(split, p.hierarchy.details[0].id, {
      producer: { app: 'test', version: '1' },
    });
    expect(pack.objects.bars.map((b) => b.id)).toEqual(['a']);
    expect(pack.fabricationPositions![0].barIds).toEqual(['a']);
    expect(pieces(readDetailPackage(pack).project)).toBe(4);
    for (const version of ['openstruct.detail/1', 'openstruct.detail/2'])
      expect(
        pieces(
          readDetailPackage({
            ...pack,
            schema: version,
            fabricationPositions: undefined,
          }).project,
        ),
      ).toBe(4);
  });
  it('cópia não entra no grupo implicitamente; excluir remove apenas uma contribuição; corte mantém terminações externas', () => {
    const p = grouped();
    const copy = run(p, [
      { type: 'bar.copy', id: 'a', newId: 'c', delta: { x: 1500, y: 0 } },
    ]);
    expect(schedule(copy)).toHaveLength(2);
    expect(pieces(copy)).toBe(11);
    const deleted = run(p, [
      { type: 'bar.delete', id: 'b', references: 'remove' },
    ]);
    expect(pieces(deleted)).toBe(4);
    validateFabrication(deleted);
    let terminated = fixture();
    terminated.bars[0].manufacturing = {
      start: { kind: 'coupler', code: 'M20' },
      end: { kind: 'headed', code: 'H20' },
    };
    const cut = run(terminated, [
      { type: 'bar.split', id: 'a', station: 500, lap: 0 },
    ]);
    expect(cut.bars[0].manufacturing?.start?.code).toBe('M20');
    expect(cut.bars[0].manufacturing?.end?.kind).toBe('plain');
    expect(cut.bars[1].manufacturing?.start?.kind).toBe('plain');
    expect(cut.bars[1].manufacturing?.end?.code).toBe('H20');
  });
  it('representante escolhido fornece a forma do quadro e renomear não pode ocupar posição alheia', () => {
    const p = fixture(),
      q = groupFabrication(p, ['a', 'b'], 'b');
    expect(schedule(q)[0].bar.id).toBe('b');
    expect(schedule(q)[0].positionId).toBe(
      fabricationPositions(p).find((g) => g.barIds.includes('b'))!.id,
    );
    const withThird = completeOwnership({
      ...q,
      bars: [...q.bars, { ...newBar('N3'), id: 'c' }],
    });
    const invalid = executeRebarBatch(
      withThird,
      [{ type: 'bar.update', id: 'a', patch: { kind: 'free', mark: 'N3' } }],
      { units: 'mm' },
    );
    expect(invalid.ok).toBe(false);
    expect(invalid.project).toBe(withThird);
  });
  it('assinatura não serializa infinito por overflow da grade nem ignora metadados de terminação desconhecidos', () => {
    const b = fixture().bars[0];
    expect(
      fabricationSignature({
        ...b,
        points: [
          { x: 0, y: 0 },
          { x: 1e308, y: 0 },
        ],
      }),
    ).toBeUndefined();
    expect(
      fabricationSignature({
        ...b,
        manufacturing: {
          start: { kind: 'coupler', code: 'M20', allowance: 12 },
        },
      } as Bar),
    ).toBeUndefined();
  });
  it('RA bloqueada conserva origem e detalhe da contribuição após renomeação da hierarquia', () => {
    const p = grouped();
    p.scheduleLock = createScheduleLock(p, 'frozen');
    const renamed = {
      ...p,
      hierarchy: {
        ...p.hierarchy,
        details: p.hierarchy.details.map((d) => ({ ...d, name: 'Renomeado' })),
      },
    };
    expect(schedule(renamed)).toEqual(schedule(p));
    expect(decodeProject(JSON.stringify(renamed)).scheduleLock).toEqual(
      p.scheduleLock,
    );
  });
  it('reunião AS-03 de detalhes com posição compartilhada preserva os totais uma única vez', () => {
    let p = fixture();
    p.bars[1].quantity = 4;
    const e = createHierarchyNode(p, 'element', 'V2', p.hierarchy.floors[0].id);
    const d = createHierarchyNode(e.project, 'detail', 'Repetido', e.id);
    p = {
      ...d.project,
      hierarchy: {
        ...d.project.hierarchy,
        objectDetails: {
          ...d.project.hierarchy.objectDetails,
          b: d.id,
          rep: d.id,
          call: d.id,
        },
      },
    };
    p = grouped(p);
    const plan = previewMergeRepetitions(p, p.hierarchy.details[0].id, [d.id]);
    expect(plan.issues).toEqual([]);
    const q = applyMergeRepetitions(p, plan);
    expect(q.bars).toHaveLength(1);
    expect(schedule(q)).toHaveLength(1);
    expect(pieces(q)).toBe(8);
    expect(weight(q)).toBeCloseTo(weight(p), 12);
  });
  it('reimportação de revisão separa a peça alterada e mantém o agrupamento das demais ocorrências', () => {
    const source = grouped();
    const target = emptyProject();
    const inserted = previewDetailTransfer(target, source, {
      mode: 'insert',
      sourceDetailId: source.hierarchy.details[0].id,
      targetElementId: target.hierarchy.elements[0].id,
    });
    expect(inserted.issues).toEqual([]);
    const local = applyDetailTransfer(target, inserted);
    const revised = run(source, [
      { type: 'bar.update', id: 'a', patch: { kind: 'free', diameter: 12.5 } },
    ]);
    const plan = previewDetailTransfer(local, revised, {
      mode: 'replace',
      sourceDetailId: source.hierarchy.details[0].id,
      targetDetailId: inserted.targetDetailId,
    });
    expect(plan.issues).toEqual([]);
    const q = applyDetailTransfer(local, plan);
    expect(q.bars).toHaveLength(2);
    expect(schedule(q)).toHaveLength(2);
    expect(pieces(q)).toBe(7);
    expect(q.bars.map((b) => b.id)).toEqual(local.bars.map((b) => b.id));
    expect(q.bars.find((b) => b.diameter === 10)?.mark).toBe(
      local.bars.find((b) => b.diameter === 10)?.mark,
    );
  });
});
