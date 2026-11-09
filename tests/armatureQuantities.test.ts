import { describe, it, expect } from 'vitest';
import {
  emptyProject,
  newBar,
  schedule,
  scheduleQuantityLabel,
  decodeProject,
  createScheduleLock,
  scheduleChanged,
} from '../src/domain/model';
import {
  barQuantities,
  quantityLabel,
  assemblyLabel,
  expectedBaseQuantity,
  barSearchText,
} from '../src/domain/detailQuantities';
import {
  completeOwnership,
  createHierarchyNode,
} from '../src/domain/hierarchy';
import {
  setDetailRepetition,
  previewMergeRepetitions,
} from '../src/domain/detailRepetition';
import {
  executeRebarBatch,
  applyRebarBatch,
  type RebarCommand,
} from '../src/domain/rebarApi';
import { groupFabrication } from '../src/domain/fabrication';
import {
  barCaption,
  annotationPrimitives,
  distributionOrigins,
} from '../src/domain/drafting';
import { drawingPrimitives } from '../src/domain/drawingPrimitives';
import { toCsv, toDxf, toSheetPdf } from '../src/lib/exports';
import {
  createDetailPackage,
  readDetailPackage,
} from '../src/domain/detailPackage';
import {
  previewDetailTransfer,
  applyDetailTransfer,
} from '../src/domain/detailTransfer';
import { fitPlacement } from '../src/domain/paper';
import { placeDrawing, duplicatePlacement } from '../src/domain/sheets';
import type { Project, Bar } from '../src/domain/types';
const run = (p: Project, commands: RebarCommand[]) => {
  const r = executeRebarBatch(p, commands, { units: 'mm' });
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return applyRebarBatch(p, r);
};
const pieces = (p: Project) => schedule(p).reduce((s, r) => s + r.quantity, 0);
function fixture() {
  let p = completeOwnership({
    ...emptyProject(),
    bars: [
      {
        ...newBar('N1'),
        id: 'a',
        quantity: 2,
        multiplier: 3,
        diameter: 10,
        mandrel: 50,
      },
    ],
  });
  p = setDetailRepetition(p, p.hierarchy.details[0].id, {
    factor: 4,
    elements: [],
  });
  p = placeDrawing(p, p.sheets[0].id, p.hierarchy.drawings[0].id).project;
  p = duplicatePlacement(p, p.hierarchy.placements[0].id).project;
  return completeOwnership({
    ...p,
    details: [{ id: 'reb', barId: 'a', origin: { x: 0, y: -400 } }],
    annotations: [
      {
        id: 'call',
        kind: 'leader',
        barId: 'a',
        points: [
          { x: 100, y: 0 },
          { x: 200, y: 200 },
          { x: 400, y: 200 },
        ],
        label: '',
        textHeight: 40,
        color: '#ffffff',
      },
    ],
  });
}
describe('AS-56 · quantidade por grupo, nervura e lance', () => {
  it('2 peças ×3 grupos ×4 detalhes são 24 peças com duas vistas e um rebatimento, com massa analítica', () => {
    const p = fixture(),
      b = p.bars[0],
      row = schedule(p)[0];
    expect(barQuantities(p, b)).toMatchObject({
      baseQuantity: 2,
      multiplier: 3,
      perDetailQuantity: 6,
      repetitions: 4,
      quantity: 24,
    });
    expect(row).toMatchObject({
      baseQuantity: 2,
      multiplier: 3,
      perDetailQuantity: 6,
      quantity: 24,
      totalLength: 24,
    });
    expect(row.weight).toBeCloseTo(((24 * Math.PI * 0.01 ** 2) / 4) * 7850, 12);
    expect(quantityLabel(p, b)).toBe('2 × 3 × 4 = 24');
    expect(scheduleQuantityLabel(row)).toBe('2 × 3 × 4 = 24');
    expect(p.hierarchy.placements).toHaveLength(2);
    expect(p.bars).toHaveLength(1);
    expect(b.quantity).toBe(2);
    const q = run(p, [
      { type: 'bar.update', id: 'a', patch: { kind: 'free', multiplier: 1 } },
    ]);
    expect(pieces(q)).toBe(8);
    const r = setDetailRepetition(p, p.hierarchy.details[0].id);
    expect(pieces(r)).toBe(6);
    expect(pieces(setDetailRepetition(q, q.hierarchy.details[0].id))).toBe(2);
    expect(pieces(p)).toBe(24);
  });
  it('nervura e apresentação sozinhas não mudam quantidades; comentários e lance aparecem nas consultas e descrições', () => {
    const p = fixture();
    const q = run(p, [
      {
        type: 'bar.update',
        id: 'a',
        patch: {
          kind: 'free',
          ribbed: true,
          showRibbed: true,
          comment: 'Montagem alternada',
          columnLevel: 'L2 → L3',
        },
      },
    ]);
    expect(pieces(q)).toBe(24);
    expect(schedule(q)[0].weight).toBe(schedule(p)[0].weight);
    expect(barCaption(q.bars[0], q)).toContain(
      'C/NERV · Lance L2 → L3 · Montagem alternada',
    );
    expect(barCaption(q.bars[0])).toContain('2 × 3 = 6');
    expect(barSearchText(q.bars[0])).toContain('Montagem alternada');
    expect(assemblyLabel({ ...q.bars[0], ribbed: false })).not.toContain(
      'C/NERV',
    );
    expect(schedule(q)[0].contributions[0]).toMatchObject({
      comment: 'Montagem alternada',
      columnLevel: 'L2 → L3',
      ribbed: true,
    });
    expect(JSON.stringify(annotationPrimitives(q.annotations[0], q))).toContain(
      'Montagem alternada',
    );
    expect(
      drawingPrimitives(q)
        .filter((p) => p.layer === 'IDENTIFICACAO' && p.text?.includes('%%c'))
        .every((p) => p.text?.includes('C/NERV')),
    ).toBe(true);
    const total = run(q, [
      {
        type: 'bar.update',
        id: 'a',
        patch: { kind: 'free', quantityDisplay: 'total' },
      },
    ]);
    expect(quantityLabel(total, total.bars[0])).toBe('24');
    expect(scheduleQuantityLabel(schedule(total)[0])).toBe('2 × 3 × 4 = 24');
    expect(decodeProject(JSON.stringify(q))).toEqual(q);
    expect(toCsv(q)).toContain('Montagem alternada');
    expect(toDxf(q)).toContain('C/NERV');
  });
  it('exibir C/NERV sem indicar nervura é apenas preferência e não acrescenta grupos', () => {
    const p = fixture(),
      q = run(p, [
        {
          type: 'bar.update',
          id: 'a',
          patch: { kind: 'free', showRibbed: true },
        },
      ]);
    expect(pieces(q)).toBe(24);
    expect(assemblyLabel(q.bars[0])).toBe('');
  });
  it('origem por espaçamento registra o limite e recalcula a base, conservando ambos os fatores', () => {
    let p = fixture();
    p = run(p, [
      {
        type: 'distribution.set',
        barId: 'a',
        distribution: { end: { x: 1000, y: 0 } },
        count: { mode: 'spacing', spacing: 200 },
      },
    ]);
    expect(p.bars[0]).toMatchObject({
      quantity: 6,
      multiplier: 3,
      quantitySource: { kind: 'distribution', mode: 'spacing', spacing: 200 },
    });
    expect(pieces(p)).toBe(72);
    expect(distributionOrigins(p.bars[0])).toHaveLength(6);
    const moved = run(p, [
      { type: 'bar.move', id: 'a', delta: { x: 500, y: 400 } },
    ]);
    expect(pieces(moved)).toBe(72);
    const q = run(p, [
      {
        type: 'bar.update',
        id: 'a',
        patch: { kind: 'free', origin: { x: 200, y: 0 } },
      },
    ]);
    expect(q.bars[0].quantity).toBe(5);
    expect(pieces(q)).toBe(60);
    const r = run(q, [{ type: 'distribution.remove', barId: 'a' }]);
    expect(r.bars[0].quantitySource).toEqual({ kind: 'manual' });
    expect(pieces(r)).toBe(60);
    expect(decodeProject(JSON.stringify(q))).toEqual(q);
  });
  it('faixa com quantidade fixa e faixa de origem manual distinguem a origem sem reaplicar multiplicadores', () => {
    const p = fixture();
    for (const mode of ['quantity', 'manual'] as const) {
      const q = run(p, [
        {
          type: 'distribution.set',
          barId: 'a',
          distribution: { end: { x: 1000, y: 0 } },
          count: { mode, quantity: 2 },
        },
      ]);
      expect(pieces(q)).toBe(24);
      expect(expectedBaseQuantity(q.bars[0])).toBe(2);
      expect(q.bars[0].quantitySource.kind).toBe(
        mode === 'manual' ? 'manual' : 'distribution',
      );
      const r = run(q, [
        { type: 'bar.update', id: 'a', patch: { kind: 'free', quantity: 4 } },
      ]);
      expect(pieces(r)).toBe(48);
    }
  });
  it('base controlada não aceita edição manual implícita; lote inválido não altera fatores ou histórico', () => {
    const p = run(fixture(), [
      {
        type: 'distribution.set',
        barId: 'a',
        distribution: { end: { x: 1000, y: 0 } },
        count: { mode: 'spacing', spacing: 200 },
      },
    ]);
    const r = executeRebarBatch(
      p,
      [
        { type: 'bar.update', id: 'a', patch: { kind: 'free', multiplier: 5 } },
        { type: 'bar.update', id: 'a', patch: { kind: 'free', quantity: 2 } },
      ],
      { units: 'mm' },
    );
    expect(r.ok).toBe(false);
    expect(r.project).toBe(p);
    expect(!r.ok && r.issues[0]).toMatchObject({
      field: 'patch.quantity',
      objectId: 'a',
      operationIndex: 1,
    });
    const q = run(p, [
      {
        type: 'bar.update',
        id: 'a',
        patch: {
          kind: 'free',
          quantitySource: { kind: 'manual' },
          quantity: 2,
        },
      },
    ]);
    expect(pieces(q)).toBe(24);
  });
  it.each([0, -1, 1.5, 10001, Infinity])(
    'rejeita multiplicador inválido %s',
    (multiplier) => {
      const p = fixture(),
        result = executeRebarBatch(
          p,
          [
            {
              type: 'bar.update',
              id: 'a',
              patch: { kind: 'free', multiplier },
            },
          ],
          { units: 'mm' },
        );
      expect(result.ok).toBe(false);
      expect(result.project).toBe(p);
      expect(!result.ok && result.issues[0].field).toContain('multiplier');
    },
  );
  it('recusa origem sem faixa, cache de quantidade adulterado e erro de unidade', () => {
    const p = fixture(),
      r = executeRebarBatch(
        p,
        [
          {
            type: 'bar.update',
            id: 'a',
            patch: {
              kind: 'free',
              quantitySource: {
                kind: 'distribution',
                mode: 'spacing',
                spacing: 100,
              },
            },
          },
        ],
        { units: 'mm' },
      );
    expect(r.ok).toBe(false);
    expect(!r.ok && r.issues[0].field).toBe('patch.quantitySource');
    const q = run(p, [
      {
        type: 'distribution.set',
        barId: 'a',
        distribution: { end: { x: 1000, y: 0 } },
        count: { mode: 'spacing', spacing: 200 },
      },
    ]);
    q.bars[0].quantity = 20;
    expect(() => decodeProject(JSON.stringify(q))).toThrow(/quantidade base/i);
    expect(
      executeRebarBatch(
        p,
        [
          {
            type: 'bar.update',
            id: 'a',
            patch: { kind: 'free', multiplier: 2 },
          },
        ],
        { units: 'cm' as 'mm' },
      ).ok,
    ).toBe(false);
  });
  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    'migra v%s com base original e multiplicador 1, sem deduzir faixa histórica',
    (v) => {
      const original = {
        ...newBar('N1'),
        id: 'old',
        quantity: 7,
        distribution: { end: { x: 1000, y: 0 } },
      };
      const raw = JSON.parse(
        JSON.stringify(
          completeOwnership({ ...emptyProject(), bars: [original] }),
        ),
      );
      raw.schema = `armadurastruct/${v}`;
      delete raw.bars[0].multiplier;
      delete raw.bars[0].quantitySource;
      raw.scheduleLock = { at: 'legacy', bars: structuredClone(raw.bars) };
      const p = decodeProject(JSON.stringify(raw));
      expect(p.schema).toBe('armadurastruct/24');
      expect(p.bars[0]).toMatchObject({
        quantity: 7,
        multiplier: 1,
        quantitySource: { kind: 'manual' },
      });
      expect(pieces(p)).toBe(7);
      expect(scheduleChanged(p)).toBe(false);
      expect(p.bars[0].id).toBe('old');
      expect(p.bars[0].points).toEqual(original.points);
      expect(decodeProject(JSON.stringify(p))).toEqual(p);
    },
  );
  it('consolidação AS-54 soma contribuições com multiplicadores distintos, sem mudar equivalência de fabricação', () => {
    let p = fixture();
    const b = {
      ...p.bars[0],
      id: 'b',
      mark: 'N2',
      quantity: 2,
      multiplier: 5,
      comment: 'Outra montagem',
      columnLevel: 'L4',
    };
    p = completeOwnership({ ...p, bars: [...p.bars, b] });
    p = groupFabrication(p, ['a', 'b'], 'a');
    const row = schedule(p)[0];
    expect(row.quantity).toBe(2 * 3 * 4 + 2 * 5 * 4);
    expect(row.multiplier).toBeNull();
    expect(scheduleQuantityLabel(row)).toBe('2×3×4 + 2×5×4 = 64');
    const q = run(p, [
      { type: 'bar.update', id: 'b', patch: { kind: 'free', multiplier: 1 } },
    ]);
    expect(schedule(q)).toHaveLength(1);
    expect(pieces(q)).toBe(32);
    expect(q.annotations).toEqual(p.annotations);
  });
  it('RA bloqueada congela fatores/metadados e avisa alteração sem alterar o snapshot', () => {
    const p = fixture();
    p.scheduleLock = createScheduleLock(p, 'frozen');
    const before = schedule(p);
    const q = run(p, [
      {
        type: 'bar.update',
        id: 'a',
        patch: {
          kind: 'free',
          multiplier: 5,
          comment: 'Revisão',
          columnLevel: 'L8',
        },
      },
    ]);
    expect(scheduleChanged(q)).toBe(true);
    expect(schedule(q)).toEqual(before);
    expect(pieces({ ...q, scheduleLock: undefined })).toBe(40);
    const display = run(p, [
      {
        type: 'bar.update',
        id: 'a',
        patch: { kind: 'free', quantityDisplay: 'total' },
      },
    ]);
    expect(scheduleChanged(display)).toBe(false);
    expect(decodeProject(JSON.stringify(q)).scheduleLock).toEqual(
      p.scheduleLock,
    );
  });
  it.each(['mm', 'cm', 'm'] as const)(
    'pacote v4 em %s conserva base/fatores/limite da faixa/observação e reimporta sem duplicação',
    (unit) => {
      const p = run(fixture(), [
        {
          type: 'distribution.set',
          barId: 'a',
          distribution: { end: { x: 1000, y: 0 } },
          count: { mode: 'spacing', spacing: 200 },
        },
        {
          type: 'bar.update',
          id: 'a',
          patch: {
            kind: 'free',
            comment: 'Faixa A',
            ribbed: true,
            showRibbed: true,
            columnLevel: 'L3',
          },
        },
      ]);
      const pack = createDetailPackage(p, p.hierarchy.details[0].id, {
        producer: { app: 'test', version: '1' },
        unit,
      });
      expect(pack.schema).toBe('openstruct.detail/15');
      const source = readDetailPackage(pack).project;
      expect(pieces(source)).toBe(72);
      expect(source.bars[0].quantitySource).toEqual({
        kind: 'distribution',
        mode: 'spacing',
        spacing: 200,
      });
      const target = emptyProject(),
        plan = previewDetailTransfer(target, source, {
          mode: 'insert',
          sourceDetailId: pack.origin.detailId,
          targetElementId: target.hierarchy.elements[0].id,
        });
      expect(plan.issues).toEqual([]);
      const inserted = applyDetailTransfer(target, plan);
      expect(pieces(inserted)).toBe(72);
      const updated = previewDetailTransfer(inserted, source, {
        mode: 'replace',
        sourceDetailId: pack.origin.detailId,
        targetDetailId: plan.targetDetailId,
      });
      expect(updated.issues).toEqual([]);
      expect(pieces(applyDetailTransfer(inserted, updated))).toBe(72);
      expect(toCsv(inserted)).toContain('Faixa A');
    },
  );
  it('não permite gravar fatores novos sob contratos antigos e continua lendo pacotes v1/v2/v3 sem fator', () => {
    const p = fixture(),
      pack = createDetailPackage(p, p.hierarchy.details[0].id, {
        producer: { app: 'test', version: '1' },
      });
    expect(() =>
      readDetailPackage({ ...pack, schema: 'openstruct.detail/3' }),
    ).toThrow(/detail\/4/);
    expect(() =>
      decodeProject(JSON.stringify({ ...p, schema: 'armadurastruct/8' })),
    ).toThrow(/formato 9/);
    const simple = completeOwnership({
      ...emptyProject(),
      bars: [newBar('N1')],
    });
    const old = createDetailPackage(simple, simple.hierarchy.details[0].id, {
      producer: { app: 'test', version: '1' },
    });
    for (const schema of [
      'openstruct.detail/1',
      'openstruct.detail/2',
      'openstruct.detail/3',
    ]) {
      const value = {
        ...old,
        schema,
        ...(schema === 'openstruct.detail/3'
          ? {}
          : { fabricationPositions: undefined }),
      };
      expect(pieces(readDetailPackage(value).project)).toBe(1);
    }
  });
  it('AS-03 não reúne detalhes com montagem ou multiplicador diferentes', () => {
    let p = fixture();
    const e = createHierarchyNode(p, 'element', 'V2', p.hierarchy.floors[0].id),
      d = createHierarchyNode(e.project, 'detail', 'Outra montagem', e.id);
    p = completeOwnership(
      {
        ...d.project,
        bars: [...p.bars, { ...p.bars[0], id: 'b', mark: 'N2', multiplier: 5 }],
      },
      d.id,
    );
    expect(
      previewMergeRepetitions(p, p.hierarchy.details[0].id, [d.id]).issues
        .length,
    ).toBeGreaterThan(0);
  });
  it('PDF vetorial e legendas preservam fatores sem transformar geometria de 1000 mm', () => {
    let p = fixture();
    for (const view of p.hierarchy.placements) p = fitPlacement(p, view.id);
    expect(p.bars[0].points[1].x).toBe(1000);
    expect(toDxf(p)).toContain('2 x 3 x 4 = 24');
    expect(toSheetPdf(p).byteLength).toBeGreaterThan(1000);
    expect(p.bars[0].points[1].x).toBe(1000);
  });
  it('dividir e unir conservam o fator e os dados de montagem, sem perder massa; montagens distintas não são unidas', () => {
    const p = run(fixture(), [
      {
        type: 'bar.update',
        id: 'a',
        patch: {
          kind: 'free',
          comment: 'Montagem A',
          columnLevel: 'L2',
          ribbed: true,
        },
      },
    ]);
    const split = run(p, [
      { type: 'bar.split', id: 'a', station: 500, lap: 0 },
    ]);
    expect(
      split.bars.every(
        (b) =>
          b.multiplier === 3 &&
          b.comment === 'Montagem A' &&
          b.columnLevel === 'L2',
      ),
    ).toBe(true);
    expect(schedule(split).reduce((n, r) => n + r.weight, 0)).toBeCloseTo(
      schedule(p)[0].weight,
      12,
    );
    const joined = run(split, [
      { type: 'bar.join', ids: [split.bars[0].id, split.bars[1].id] },
    ]);
    expect(pieces(joined)).toBe(24);
    const altered = run(split, [
      {
        type: 'bar.update',
        id: split.bars[1].id,
        patch: { kind: 'free', multiplier: 2 },
      },
    ]);
    expect(
      executeRebarBatch(
        altered,
        [{ type: 'bar.join', ids: [altered.bars[0].id, altered.bars[1].id] }],
        { units: 'mm' },
      ).ok,
    ).toBe(false);
  });
});
