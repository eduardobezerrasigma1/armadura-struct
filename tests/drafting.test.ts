import { describe, it, expect } from 'vitest';
import DxfParser from 'dxf-parser';
import {
  emptyProject,
  newBar,
  decodeProject,
  schedule,
  scheduleChanged,
} from '../src/domain/model';
import { geometry, world, distance } from '../src/domain/geometry';
import {
  transformBar,
  splitBar,
  joinBars,
  quantityForSpacing,
  renumber,
} from '../src/domain/editing';
import {
  annotationError,
  annotationPrimitives,
  arcThrough,
  distributionOrigins,
  repeatedGeometry,
} from '../src/domain/drafting';
import { toCsv, toDxf, toPdf, exportLines } from '../src/lib/exports';
import type { Annotation, Project } from '../src/domain/types';
import { completeOwnership } from '../src/domain/hierarchy';
const straight = () =>
  completeOwnership({
    ...emptyProject(),
    bars: [
      {
        ...newBar('N4'),
        id: 'bar',
        quantity: 3,
        points: [
          { x: 0, y: 0 },
          { x: 3000, y: 0 },
        ],
      },
    ],
  });
const annotation = (kind: Annotation['kind']): Annotation => ({
  id: 'dim',
  kind,
  barId: 'bar',
  points: [
    { x: 0, y: 0 },
    { x: 3000, y: 0 },
    { x: 1500, y: -300 },
  ],
  label: '',
  textHeight: 50,
  color: '#657890',
});

describe('bar editing preserves physical centerline and quantities', () => {
  it('splits a bent bar with overlap and preserves exact arc lengths', () => {
    const p = straight();
    p.bars[0].points = [
      { x: 0, y: 500 },
      { x: 0, y: 0 },
      { x: 3000, y: 0 },
      { x: 3000, y: 500 },
    ];
    const length = geometry(p.bars[0]).length;
    const next = splitBar(p, 'bar', length / 2, 400);
    expect(next.bars).toHaveLength(2);
    expect(next.bars.map((b) => b.quantity)).toEqual([3, 3]);
    expect(next.bars[0].mark).toBe('N4');
    expect(next.bars[1].mark).toBe('N1');
    expect(
      next.bars.reduce((sum, b) => sum + geometry(b).length, 0),
    ).toBeCloseTo(length + 400, 8);
    expect(
      schedule(next).reduce((sum, r) => sum + r.totalLength, 0),
    ).toBeCloseTo(((length + 400) * 3) / 1000, 8);
    expect(decodeProject(JSON.stringify(next))).toEqual(next);
    expect(p.bars).toHaveLength(1);
  });
  it('rejects cuts inside a bend and overlaps crossing bends', () => {
    const p = straight();
    p.bars[0].points = [
      { x: 0, y: 500 },
      { x: 0, y: 0 },
      { x: 3000, y: 0 },
    ];
    const r = (p.bars[0].mandrel + p.bars[0].diameter) / 2;
    expect(() => splitBar(p, 'bar', 500 - r + (r * Math.PI) / 4, 0)).toThrow(
      /dobras/,
    );
    expect(() => splitBar(p, 'bar', 510, 300)).toThrow(/dobras/);
    expect(() => splitBar(p, 'bar', 1000, -1)).toThrow();
    expect(() => splitBar(p, 'bar', 0, 100)).toThrow();
    expect(() => splitBar(p, 'bar', 1e6, 0)).toThrow();
  });
  it('merges reversed/rotated touching geometry without double counting pieces', () => {
    const p = straight();
    const a = p.bars[0];
    a.points = [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
    ];
    const b = {
      ...newBar('N7'),
      id: 'b',
      quantity: 3,
      origin: { x: 1000, y: 1000 },
      rotation: -90,
      points: [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
      ],
    };
    p.bars.push(b);
    p.annotations = [{ ...annotation('leader'), barId: 'b' }];
    p.details = [{ id: 'detail', barId: 'b', origin: { x: 0, y: 0 } }];
    const joined = joinBars(p, ['bar', 'b']);
    expect(joined.bars).toHaveLength(1);
    expect(joined.bars[0].quantity).toBe(3);
    expect(joined.annotations[0].barId).toBe('bar');
    expect(joined.details[0].barId).toBe('bar');
    const pts = joined.bars[0].points.map((p) => world(p, joined.bars[0]));
    expect(distance(pts[0], { x: 0, y: 0 })).toBeLessThan(1e-6);
    expect(distance(pts.at(-1)!, { x: 1000, y: 1000 })).toBeLessThan(1e-6);
    expect(geometry(joined.bars[0]).errors).toEqual([]);
  });
  it('refuses incompatible bars and gaps instead of inventing a connection', () => {
    const p = straight();
    p.bars.push({
      ...newBar('N2'),
      id: 'b',
      quantity: 3,
      origin: { x: 3001, y: 0 },
    });
    expect(() => joinBars(p, ['bar', 'b'])).toThrow(/extremidades/);
    p.bars[1].origin.x = 3000;
    p.bars[1].diameter = 10;
    expect(() => joinBars(p, ['bar', 'b'])).toThrow(/bitola/);
  });
});

describe('drafting, quantities and persisted project compatibility', () => {
  it('migrates 0.1 projects without losing bars, masks or details', () => {
    const legacy = {
      ...straight(),
      schema: 'armadurastruct/1',
      drawing: undefined,
      polylines: undefined,
      annotations: undefined,
    };
    const p = decodeProject(JSON.stringify(legacy));
    expect(p.schema).toBe('armadurastruct/25');
    expect(p.bars).toEqual(legacy.bars);
    expect(p.annotations).toEqual([]);
    expect(p.polylines).toEqual([]);
    expect(p.drawing.scale).toBe(0);
  });
  it('rejects orphan calls and duplicate object identities', () => {
    const p = straight();
    p.annotations = [{ ...annotation('leader'), barId: 'missing' }];
    expect(() => decodeProject(JSON.stringify(p))).toThrow(/sem armadura/);
    p.annotations = [{ ...annotation('leader'), id: 'bar' }];
    expect(() => decodeProject(JSON.stringify(p))).toThrow(/duplicados/);
  });
  it('links dimensions and callouts to edited/renumbered bars in DXF/PDF', () => {
    let p = straight();
    p.annotations = [
      annotation('dimension-orthogonal'),
      { ...annotation('leader'), id: 'call' },
    ];
    p = renumber(p);
    p.bars[0].quantity = 7;
    const items = exportLines(p);
    expect(items.some((l) => l.text === '300,0')).toBe(true);
    expect(items.some((l) => l.text?.startsWith('7 N1 Ø8'))).toBe(true);
    const dxf = new DxfParser().parseSync(toDxf(p))!;
    expect(dxf.entities.some((e) => e.layer === 'CHAMADAS')).toBe(true);
    expect(dxf.entities.some((e) => e.layer === 'COTAS')).toBe(true);
    expect(new TextDecoder().decode(toPdf(p).slice(0, 5))).toBe('%PDF-');
    expect(schedule(p)).toHaveLength(1);
  });
  it('retains aligned distances and uses projected orthogonal dimensions', () => {
    const p = straight(),
      a = {
        ...annotation('dimension-aligned'),
        barId: undefined,
        points: [
          { x: 0, y: 0 },
          { x: 300, y: 400 },
          { x: 0, y: 500 },
        ],
      };
    expect(annotationPrimitives(a, p).some((x) => x.text === '50,0')).toBe(
      true,
    );
    expect(
      annotationPrimitives({ ...a, kind: 'dimension-orthogonal' }, p).some(
        (x) => x.text === '30,0',
      ),
    ).toBe(true);
    const arc = arcThrough({ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 })!;
    expect(arc).toHaveLength(49);
    expect(arc.every((p) => Math.abs(Math.hypot(p.x, p.y) - 1) < 1e-8)).toBe(
      true,
    );
    expect(
      arcThrough({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }),
    ).toBeNull();
  });
  it('repeats at real indices, derives spacing and counts each position once', () => {
    const p = straight(),
      b = p.bars[0];
    b.quantity = quantityForSpacing(1000, 150);
    b.distribution = {
      start: { x: 500, y: 100 },
      end: { x: 1500, y: 100 },
      render: 'bars',
    };
    expect(b.quantity).toBe(8);
    expect(distributionOrigins(b)).toHaveLength(8);
    expect(distributionOrigins(b)[0]).toEqual({ x: 500, y: 100 });
    expect(distributionOrigins(b).at(-1)).toEqual({ x: 1500, y: 100 });
    expect(repeatedGeometry(b)).toHaveLength(8);
    expect(schedule(p)[0].quantity).toBe(8);
    expect(() => quantityForSpacing(1000, 0)).toThrow();
  });
  it('keeps a locked RA stable, detects changes and blocks stale exports', () => {
    const p = straight();
    p.scheduleLock = {
      at: '2026-11-06T00:00:00Z',
      bars: structuredClone(p.bars),
    };
    p.bars[0].origin.x = 100;
    expect(scheduleChanged(p)).toBe(false);
    p.bars[0].quantity = 5;
    expect(schedule(p)[0].quantity).toBe(3);
    expect(scheduleChanged(p)).toBe(true);
    expect(() => toCsv(p)).toThrow(/desatualizada/);
    expect(() => toDxf(p)).toThrow(/desatualizada/);
    p.scheduleLock.bars = structuredClone(p.bars);
    expect(scheduleChanged(p)).toBe(false);
    expect(schedule(p)[0].quantity).toBe(5);
    expect(toCsv(p)).toContain('N4');
    expect(
      decodeProject(JSON.stringify(p)).scheduleLock?.bars[0].quantity,
    ).toBe(5);
  });
  it('refuses fixed-scale PDF output that would crop the drawing', () => {
    const p: Project = straight();
    p.drawing.scale = 1;
    expect(() => toPdf(p)).toThrow(/não cabe/);
    p.drawing.scale = 50;
    expect(toPdf(p).length).toBeGreaterThan(1000);
  });
});

describe('drawing validation and transforms', () => {
  it('keeps a repeated rotated bar and its range on the same mirror axis', () => {
    const b = {
      ...newBar('N1'),
      rotation: 90,
      origin: { x: 100, y: 200 },
      distribution: {
        start: { x: 100, y: 400 },
        end: { x: 100, y: 1000 },
        render: 'bars' as const,
      },
    };
    const mirrored = transformBar(b, 'mirror');
    expect(
      distance(mirrored.distribution!.start!, { x: 100, y: 0 }),
    ).toBeLessThan(1e-8);
    expect(
      distance(mirrored.distribution!.end, { x: 100, y: -600 }),
    ).toBeLessThan(1e-8);
    expect(geometry(mirrored).length).toBeCloseTo(geometry(b).length, 10);
    const rotated = transformBar(b, 'rotate');
    expect(
      distance(rotated.distribution!.end, { x: -700, y: 200 }),
    ).toBeLessThan(1e-8);
  });
  it('blocks degenerate graphical sections instead of exporting a false arc', () => {
    const p = straight();
    p.annotations = [
      {
        ...annotation('section-arc'),
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 200, y: 0 },
        ],
      },
    ];
    expect(annotationError(p.annotations[0])).toMatch(/alinhados/);
    expect(() => toDxf(p)).toThrow(/anotações/);
    p.annotations = [
      {
        ...annotation('dimension-orthogonal'),
        points: [
          { x: 0, y: 0 },
          { x: 0, y: 100 },
          { x: 0, y: 300 },
        ],
      },
    ];
    expect(annotationError(p.annotations[0])).toMatch(/projeção/);
  });
});
