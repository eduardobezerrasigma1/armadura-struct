import { describe, expect, it } from 'vitest';
import {
  emptyProject,
  newBar,
  schedule,
  decodeProject,
  createScheduleLock,
  scheduleChanged,
} from '../src/domain/model';
import {
  completeOwnership,
  createHierarchyNode,
  updateHierarchyNode,
  moveObjectsToDetail,
} from '../src/domain/hierarchy';
import { groupInDetail, setDetailGrouped } from '../src/domain/detailEditing';
import {
  setDetailRepetition,
  previewMergeRepetitions,
  applyMergeRepetitions,
  repetitionCandidates,
} from '../src/domain/detailRepetition';
import { barQuantities, detailTitle } from '../src/domain/detailQuantities';
import { placeDrawing, duplicatePlacement } from '../src/domain/sheets';
import {
  createDetailPackage,
  detailPackageProject,
  readDetailPackage,
} from '../src/domain/detailPackage';
import {
  previewDetailTransfer,
  matchingDetails,
} from '../src/domain/detailTransfer';
import { composeSheet } from '../src/domain/paper';
import { toCsv, toDxf, toSheetPdf } from '../src/lib/exports';
import type { Project } from '../src/domain/types';

function fixture() {
  let p = emptyProject();
  const id = p.hierarchy.details[0].id;
  p.hierarchy.elements[0].name = 'V1';
  p.hierarchy.details[0].name = 'Armação V1';
  p = completeOwnership({
    ...p,
    bars: [{ ...newBar('N1'), id: 'b1', diameter: 10, quantity: 4 }],
  });
  return { p, id };
}
function copies() {
  let { p, id } = fixture();
  const ids = [id];
  for (let i = 2; i <= 3; i++) {
    const e = createHierarchyNode(
      p,
      'element',
      `V${i}`,
      p.hierarchy.floors[0].id,
    );
    const d = createHierarchyNode(e.project, 'detail', `Armação V${i}`, e.id);
    ids.push(d.id);
    p = completeOwnership(
      {
        ...d.project,
        bars: [
          ...p.bars,
          {
            ...newBar(`N${i}`),
            id: `b${i}`,
            diameter: 10,
            quantity: 4,
            origin: { x: (i - 1) * 2000, y: 0 },
          },
        ],
      },
      d.id,
    );
  }
  for (const id of ids)
    p = placeDrawing(
      p,
      p.sheets[0].id,
      p.hierarchy.drawings.find((d) => d.detailId === id)!.id,
    ).project;
  const notes = createHierarchyNode(
    p,
    'detail',
    'Notas externas',
    p.hierarchy.elements[0].id,
  );
  p = completeOwnership({
    ...notes.project,
    details: [{ id: 'foreign-rep', barId: 'b2', origin: { x: 0, y: -300 } }],
    annotations: [
      {
        id: 'foreign-call',
        kind: 'leader',
        barId: 'b3',
        points: [
          { x: 0, y: 0 },
          { x: 200, y: 200 },
          { x: 400, y: 200 },
        ],
        label: '',
        textHeight: 40,
        color: '#777777',
      },
    ],
  });
  p.hierarchy.objectDetails['foreign-rep'] = notes.id;
  p.hierarchy.objectDetails['foreign-call'] = notes.id;
  return { p, ids };
}
const pieces = (p: Project) => schedule(p).reduce((n, r) => n + r.quantity, 0);
const weight = (p: Project) => schedule(p).reduce((n, r) => n + r.weight, 0);
const repeated = (p: Project, id: string, factor = 3) =>
  setDetailRepetition(p, id, {
    factor,
    elements: factor === 3 ? ['V1', 'V2', 'V3'].map((name) => ({ name })) : [],
  });

describe('repetição de elementos e levantamento consistente', () => {
  it('4 barras × 3 elementos = 12 e duas vistas mantêm 12; remover restaura 4', () => {
    const { p, id } = fixture(),
      before = JSON.stringify(p);
    let q = repeated(p, id);
    q = placeDrawing(q, q.sheets[0].id, q.hierarchy.drawings[0].id).project;
    q = duplicatePlacement(q, q.hierarchy.placements[0].id).project;
    expect(q.bars[0].quantity).toBe(4);
    expect(pieces(q)).toBe(12);
    expect(barQuantities(q, q.bars[0])).toMatchObject({
      baseQuantity: 4,
      repetitions: 3,
      quantity: 12,
    });
    expect(weight(q)).toBeCloseTo(((12 * Math.PI * 0.01 ** 2) / 4) * 7850, 10);
    expect(pieces(setDetailRepetition(q, id))).toBe(4);
    expect(JSON.stringify(p)).toBe(before);
    expect(pieces(decodeProject(JSON.stringify(q)))).toBe(12);
  });
  it('valida fator inteiro, lista completa, nomes distintos e referências a elementos', () => {
    const { p, id } = fixture();
    for (const factor of [0, -1, 1.2, Infinity, 10001])
      expect(() =>
        setDetailRepetition(p, id, { factor, elements: [] }),
      ).toThrow();
    expect(() =>
      setDetailRepetition(p, id, { factor: 3, elements: [{ name: 'V1' }] }),
    ).toThrow();
    expect(() =>
      setDetailRepetition(p, id, {
        factor: 2,
        elements: [{ name: 'V1' }, { name: 'V1' }],
      }),
    ).toThrow();
    expect(() =>
      setDetailRepetition(p, id, {
        factor: 1,
        elements: [{ name: 'V1', elementId: 'missing' }],
      }),
    ).toThrow(/inexistente/);
    expect(pieces(p)).toBe(4);
  });
  it('renomear/mover elemento vinculado e alterar o fator atualizam títulos, quadro e exportações', () => {
    const { p, id } = fixture();
    let q = setDetailRepetition(p, id, {
      factor: 1,
      elements: [{ name: 'V1', elementId: p.hierarchy.elements[0].id }],
    });
    q = updateHierarchyNode(
      q,
      'element',
      p.hierarchy.elements[0].id,
      'V9',
      p.hierarchy.floors[0].id,
    );
    expect(detailTitle(q, id)).toContain('V9');
    expect(toCsv(q)).toContain('V9');
    q = repeated(q, id);
    q = placeDrawing(q, q.sheets[0].id, q.hierarchy.drawings[0].id).project;
    const texts = composeSheet(q, q.sheets[0].id)
      .views.flatMap((v) => v.lines.map((l) => l.text ?? ''))
      .join(' ');
    expect(texts).toContain('V1 = V2 = V3');
    expect(texts).toContain('4 × 3 = 12');
    expect(toCsv(q)).toContain('Quantidade base');
    expect(toCsv(q)).toContain('"4";"3";"12"');
    expect(toDxf(q)).toContain('4 x 3 = 12');
    expect(toSheetPdf(q).byteLength).toBeGreaterThan(1000);
    expect(pieces(repeated(q, id, 2))).toBe(8);
  });
  it('RA bloqueada guarda fator/título próprios e mudanças de repetição invalidam o bloqueio', () => {
    const { p, id } = fixture();
    let q = repeated(p, id);
    q.scheduleLock = createScheduleLock(q, 'snapshot');
    expect(pieces(q)).toBe(12);
    expect(scheduleChanged(q)).toBe(false);
    const manual = {
      ...q,
      hierarchy: {
        ...q.hierarchy,
        details: q.hierarchy.details.map((d) =>
          d.id === id ? { ...d, repetition: { factor: 2, elements: [] } } : d,
        ),
      },
    };
    expect(scheduleChanged(manual)).toBe(true);
    expect(pieces(manual)).toBe(12);
    expect(repeated(q, id, 2).scheduleLock).toBeUndefined();
    expect(pieces(repeated(q, id, 2))).toBe(8);
    expect(() =>
      decodeProject(
        JSON.stringify({ ...q, scheduleLock: { at: 'bad', bars: q.bars } }),
      ),
    ).toThrow(/snapshot/);
  });
  it('abre formatos 1–6 preservando IDs, objetos, pesos e snapshots antigos', () => {
    const { p } = fixture();
    p.scheduleLock = { at: 'old', bars: structuredClone(p.bars) };
    for (const v of [1, 2, 3, 4, 5, 6]) {
      const q = decodeProject(
        JSON.stringify({ ...p, schema: `armadurastruct/${v}` }),
      );
      expect(q.schema).toBe('armadurastruct/25');
      expect(q.bars).toEqual(p.bars);
      expect(pieces(q)).toBe(4);
      expect(weight(q)).toBeCloseTo(weight(p), 10);
    }
  });
  it('exporta pacote vigente com repetição e lê v1 sem inventar multiplicador', () => {
    const { p, id } = fixture();
    const q = repeated(p, id);
    const pack = createDetailPackage(q, id, {
      producer: { app: 'test', version: '1' },
      unit: 'cm',
    });
    expect(pack.schema).toBe('openstruct.detail/16');
    expect(pieces(detailPackageProject(pack))).toBe(12);
    expect(pieces(readDetailPackage(JSON.stringify(pack)).project)).toBe(12);
    expect(() =>
      readDetailPackage({ ...pack, schema: 'openstruct.detail/1' }),
    ).toThrow(/exigem/);
    const native = createDetailPackage(p, id, {
      producer: { app: 'test', version: '1' },
    });
    expect(
      pieces(
        readDetailPackage({
          ...native,
          fabricationPositions: undefined,
          schema: 'openstruct.detail/1',
        }).project,
      ),
    ).toBe(4);
  });
  it('revisão individual conserva repetição local e não contamina alteração somente gráfica', () => {
    const { p: source, id } = fixture();
    const target = emptyProject();
    const insert = previewDetailTransfer(target, source, {
      mode: 'insert',
      sourceDetailId: id,
      targetElementId: target.hierarchy.elements[0].id,
    });
    let local = repeated(insert.project!, insert.targetDetailId!);
    local.scheduleLock = createScheduleLock(local, 'locked');
    const visual = structuredClone(source);
    visual.bars[0].color = '#123456';
    let update = previewDetailTransfer(local, visual, {
      mode: 'replace',
      sourceDetailId: id,
      targetDetailId: insert.targetDetailId,
    });
    expect(update.issues).toEqual([]);
    expect(update.raInvalidated).toBe(false);
    expect(pieces(update.project!)).toBe(12);
    visual.bars[0].quantity = 6;
    update = previewDetailTransfer(local, visual, {
      mode: 'replace',
      sourceDetailId: id,
      targetDetailId: insert.targetDetailId,
    });
    expect(update.issues).toEqual([]);
    expect(update.raInvalidated).toBe(true);
    expect(pieces(update.project!)).toBe(18);
  });
  it('agrupamento/desagrupamento conservam fator e mover para fator diferente é recusado', () => {
    const { p, id } = fixture();
    const q = repeated(p, id);
    const grouped = groupInDetail(
      q,
      ['b1'],
      'Grupo',
      q.hierarchy.elements[0].id,
    );
    expect(pieces(grouped.project)).toBe(12);
    expect(pieces(setDetailGrouped(grouped.project, grouped.id, false))).toBe(
      12,
    );
    const other = createHierarchyNode(
      q,
      'detail',
      'Outro',
      q.hierarchy.elements[0].id,
    );
    expect(() => moveObjectsToDetail(other.project, ['b1'], other.id)).toThrow(
      /quantidade efetiva/,
    );
  });
});

describe('reunião controlada de definições físicas', () => {
  it('homônimos em pavimentos distintos conservam identidade e exportam nomes sem ambiguidade', () => {
    const { p, ids } = copies();
    const upper = createHierarchyNode(p, 'floor', 'Superior');
    const e = upper.project.hierarchy.elements.find((e) => e.name === 'V2')!;
    let q = updateHierarchyNode(upper.project, 'element', e.id, 'V1', upper.id);
    // Existing files can still explicitly link occurrence names to legacy element IDs.
    for (const id of ids.slice(0, 2)) {
      const d = q.hierarchy.details.find((d) => d.id === id)!;
      const el = q.hierarchy.elements.find((e) => e.id === d.elementId)!;
      q = setDetailRepetition(q, id, {
        factor: 1,
        elements: [{ name: el.name, elementId: el.id }],
      });
    }
    const merged = previewMergeRepetitions(q, ids[0], [ids[1]]);
    expect(merged.issues).toEqual([]);
    expect(detailTitle(merged.project!, ids[0])).toContain('V1 (Superior)');
    const pack = createDetailPackage(merged.project!, ids[0], {
      producer: { app: 'test', version: '1' },
    });
    expect(pieces(detailPackageProject(pack))).toBe(8);
    const renamed = updateHierarchyNode(
      merged.project!,
      'detail',
      ids[0],
      'Novo título',
      merged.project!.hierarchy.details[0].elementId,
    );
    expect(detailTitle(renamed, ids[0])).toContain('Novo título');
  });
  it('mostra candidatos idênticos, remove definições duplicadas e conserva aço/vistas/vínculos', () => {
    const { p, ids } = copies(),
      before = JSON.stringify(p);
    expect(repetitionCandidates(p, ids[0]).map((d) => d.id)).toEqual(
      ids.slice(1),
    );
    const plan = previewMergeRepetitions(p, ids[0], ids.slice(1));
    expect(plan.issues).toEqual([]);
    expect(plan.factor).toBe(3);
    expect(plan.beforePieces).toBe(12);
    expect(plan.afterPieces).toBe(12);
    const q = applyMergeRepetitions(p, plan);
    expect(q.bars).toHaveLength(1);
    expect(q.bars[0]).toMatchObject({ id: 'b1', quantity: 4 });
    expect(q.details[0].barId).toBe('b1');
    expect(q.annotations[0].barId).toBe('b1');
    expect(weight(q)).toBeCloseTo(weight(p), 10);
    q.hierarchy.placements.forEach((v, i) => {
      expect(v.id).toBe(p.hierarchy.placements[i].id);
      expect(v.origin).toEqual(p.hierarchy.placements[i].origin);
      expect(v.scale).toBe(p.hierarchy.placements[i].scale);
    });
    expect(q.hierarchy.placements[1].modelOrigin.x).toBeCloseTo(
      p.hierarchy.placements[1].modelOrigin.x - 2000,
      10,
    );
    expect(JSON.stringify(p)).toBe(before);
    expect(decodeProject(JSON.stringify(q))).toEqual(q);
    expect(() => applyMergeRepetitions({ ...p }, plan)).toThrow(/mudou/);
  });
  it('escolher outro representante conserva seus IDs e nomes vinculados acompanham renomeação', () => {
    let { p, ids } = copies();
    for (const id of ids) {
      const d = p.hierarchy.details.find((d) => d.id === id)!;
      const el = p.hierarchy.elements.find((e) => e.id === d.elementId)!;
      p = setDetailRepetition(p, id, {
        factor: 1,
        elements: [{ name: el.name, elementId: el.id }],
      });
    }
    const plan = previewMergeRepetitions(p, ids[1], [ids[0], ids[2]]);
    expect(plan.issues).toEqual([]);
    const q = plan.project!;
    expect(q.bars[0].id).toBe('b2');
    expect(q.details[0].barId).toBe('b2');
    const e = p.hierarchy.elements.find((e) => e.name === 'V3')!;
    const renamed = updateHierarchyNode(q, 'element', e.id, 'V8', e.floorId);
    expect(detailTitle(renamed, ids[1])).toContain('V8');
    expect(toCsv(renamed)).toContain('V8');
  });
  it('recusa bitolas/quantidades diferentes e exige nomes para repetições previamente sem lista', () => {
    const { p, ids } = copies();
    p.bars[2].diameter = 12.5;
    expect(repetitionCandidates(p, ids[0]).map((d) => d.id)).toEqual([ids[1]]);
    expect(
      previewMergeRepetitions(p, ids[0], [ids[2]]).project,
    ).toBeUndefined();
    const q = setDetailRepetition(p, ids[0], { factor: 2, elements: [] });
    expect(
      previewMergeRepetitions(q, ids[0], [ids[1]]).issues.join(),
    ).toContain('nomes');
    const valid = previewMergeRepetitions(
      q,
      ids[0],
      [ids[1]],
      ['V1', 'V4', 'V2'],
    );
    expect(valid.issues).toEqual([]);
    expect(pieces(valid.project!)).toBe(pieces(q));
  });
  it('a origem reunida não pode ser reimportada como outra posição física', () => {
    const { p, ids } = copies();
    const q = previewMergeRepetitions(p, ids[0], [ids[1]]).project!;
    expect(matchingDetails(q, p, ids[1]).map((d) => d.id)).toEqual([ids[0]]);
    const reimport = previewDetailTransfer(q, p, {
      mode: 'insert',
      sourceDetailId: ids[1],
      targetElementId: q.hierarchy.elements[0].id,
    });
    expect(reimport.issues.join()).toContain('reunida');
    expect(pieces(q)).toBe(12);
  });
});
