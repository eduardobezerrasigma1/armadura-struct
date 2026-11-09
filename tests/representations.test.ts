import { it, expect } from 'vitest';
import {
  emptyProject,
  newBar,
  schedule,
  decodeProject,
} from '../src/domain/model';
import { completeOwnership } from '../src/domain/hierarchy';
import {
  executeRebarBatch,
  applyRebarBatch,
  type RebarCommand,
} from '../src/domain/rebarApi';
import {
  representationPoints,
  representationPrimitives,
  showsPhysicalDescription,
} from '../src/domain/representations';
import { drawingPrimitives } from '../src/domain/drawingPrimitives';
import {
  createDetailPackage,
  readDetailPackage,
} from '../src/domain/detailPackage';
import { toDxf, toSheetPdf } from '../src/lib/exports';
import { placeDrawing } from '../src/domain/sheets';
import { fitPlacement } from '../src/domain/paper';
import type { Project } from '../src/domain/types';
const fixture = () =>
  completeOwnership({
    ...emptyProject(),
    bars: [{ ...newBar('N1'), id: 'b', quantity: 8, diameter: 10 }],
  });
const run = (p: Project, c: RebarCommand[]) =>
  applyRebarBatch(p, executeRebarBatch(p, c, { units: 'mm' }));
it('three inserts, including rotated 2x, preserve eight physical pieces and analytical weight', () => {
  let p = fixture();
  const before = schedule(p);
  p = run(p, [
    {
      type: 'representation.create',
      id: 'r1',
      barId: 'b',
      origin: { x: 0, y: 0 },
    },
    {
      type: 'representation.create',
      id: 'r2',
      barId: 'b',
      origin: { x: 2000, y: 500 },
      rotation: 90,
      scale: 2,
      identification: 'primary',
    },
    {
      type: 'representation.create',
      id: 'r3',
      barId: 'b',
      origin: { x: 0, y: 2000 },
      identification: 'none',
    },
  ]);
  expect(schedule(p)).toEqual(before);
  expect(schedule(p)[0].quantity).toBe(8);
  expect(schedule(p)[0].weight).toBeCloseTo(
    ((8 * Math.PI * 0.01 ** 2) / 4) * 7850,
    12,
  );
  const pts = representationPoints(p.bars[0], p.details[1]);
  expect(pts[0]).toEqual({ x: 2000, y: 500 });
  expect(pts.at(-1)!.y).toBeCloseTo(2500);
  expect(showsPhysicalDescription(p, 'b')).toBe(false);
  expect(decodeProject(JSON.stringify(p))).toEqual(p);
  const q = run(p, [{ type: 'representation.delete', id: 'r2' }]);
  expect(q.bars).toEqual(p.bars);
  expect(q.details).toHaveLength(2);
  expect(showsPhysicalDescription(q, 'b')).toBe(true);
});
it('updates propagate to every insertion, graphical edits preserve all other instances, and primary selection is unique', () => {
  let p = fixture();
  p = run(p, [
    {
      type: 'representation.create',
      id: 'r1',
      barId: 'b',
      origin: { x: 0, y: 0 },
      identification: 'primary',
    },
    {
      type: 'representation.create',
      id: 'r2',
      barId: 'b',
      origin: { x: 0, y: 3000 },
      identification: 'primary',
    },
  ]);
  expect(p.details[0].identification).toBe('mark');
  const q = run(p, [
    { type: 'representation.update', id: 'r2', scale: 2, rotation: 90 },
  ]);
  expect(q.details[0]).toEqual(p.details[0]);
  expect(q.bars).toEqual(p.bars);
  const r = run(q, [
    {
      type: 'bar.update',
      id: 'b',
      patch: {
        kind: 'free',
        points: [
          { x: 0, y: 0 },
          { x: 2000, y: 0 },
        ],
      },
    },
  ]);
  expect(representationPoints(r.bars[0], r.details[0]).at(-1)!.x).toBe(2000);
  expect(representationPoints(r.bars[0], r.details[1]).at(-1)!.y).toBeCloseTo(
    7000,
  );
  expect(
    representationPrimitives(
      r.bars[0],
      { ...r.details[1], identification: 'none' },
      r,
    ).some((p) => p.layer === 'IDENTIFICACAO'),
  ).toBe(false);
});
it.each([0, -1, Infinity])('invalid scale %s rolls back batch', (scale) => {
  const p = fixture(),
    r = executeRebarBatch(
      p,
      [
        {
          type: 'representation.create',
          barId: 'b',
          origin: { x: 0, y: 0 },
          scale,
        },
      ],
      { units: 'mm' },
    );
  expect(r.ok).toBe(false);
  expect(r.project).toBe(p);
});
it('PDF/DXF and package units retain transformed coordinates and physical dimensions', () => {
  let p = run(fixture(), [
    {
      type: 'representation.create',
      id: 'r',
      barId: 'b',
      origin: { x: 2000, y: 500 },
      rotation: 90,
      scale: 2,
    },
  ]);
  const primitives = drawingPrimitives(p).filter(
    (x) => x.layer === 'REBATIMENTOS',
  );
  expect(primitives[0].points.at(-1)!.y).toBeCloseTo(2500);
  expect(toDxf(p)).toContain('2500');
  p = placeDrawing(p, p.sheets[0].id, p.hierarchy.drawings[0].id).project;
  p = fitPlacement(p, p.hierarchy.placements[0].id);
  expect(toSheetPdf(p).byteLength).toBeGreaterThan(1000);
  for (const unit of ['mm', 'cm', 'm'] as const) {
    const pack = createDetailPackage(p, p.hierarchy.details[0].id, {
      producer: { app: 'test', version: '1' },
      unit,
    });
    expect(pack.schema).toBe('openstruct.detail/16');
    const q = readDetailPackage(pack).project;
    expect(q.details).toEqual(p.details);
    expect(schedule(q)[0].quantity).toBe(8);
  }
});
it('legacy rebatimentos migrate with unchanged origins and appearance defaults', () => {
  const p = fixture();
  p.details = [{ id: 'old', barId: 'b', origin: { x: 200, y: 300 } }];
  const q = decodeProject(
    JSON.stringify({ ...completeOwnership(p), schema: 'armadurastruct/10' }),
  );
  expect(q.details).toEqual(p.details);
  expect(representationPoints(q.bars[0], q.details[0]).at(-1)).toEqual({
    x: 1200,
    y: 300,
  });
});
