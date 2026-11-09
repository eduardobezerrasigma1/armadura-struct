import { describe, it, expect } from 'vitest';
import {
  nativePrimitive,
  nativePoints,
  newNativeMask,
  localMaskPoint,
  shapeFromWorld,
  validateNativeMask,
} from '../src/domain/nativeMasks';
import {
  emptyProject,
  decodeProject,
  schedule,
  newBar,
} from '../src/domain/model';
import { completeOwnership } from '../src/domain/hierarchy';
import { maskPoint, maskPrimitives } from '../src/cad/import';
import {
  createDetailPackage,
  readDetailPackage,
} from '../src/domain/detailPackage';
import { toDxf, toCsv, toPdf } from '../src/lib/exports';
import { drawingPrimitives } from '../src/domain/drawingPrimitives';
const shapes = () => [
  nativePrimitive({
    kind: 'line',
    points: [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
    ],
    closed: false,
  }),
  nativePrimitive({
    kind: 'rectangle',
    points: [
      { x: 0, y: 0 },
      { x: 1000, y: 500 },
    ],
    closed: true,
  }),
  nativePrimitive({ kind: 'circle', center: { x: 0, y: 0 }, radius: 250 }),
  nativePrimitive({
    kind: 'polyline',
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ],
    closed: true,
  }),
];
function fixture() {
  return completeOwnership({
    ...emptyProject(),
    bars: [newBar('N1')],
    masks: [{ ...newNativeMask('Fôrma'), primitives: shapes() }],
  });
}
describe('máscaras CAD nativas', () => {
  it('mantém linha 1000, retângulo 1000×500 e círculo analítico R250 com erro de corda ≤0,05mm', () => {
    const [l, r, c] = shapes();
    expect(l.points[1].x).toBe(1000);
    expect(r.points).toEqual([
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 500 },
      { x: 0, y: 500 },
    ]);
    expect(c.native).toEqual({
      kind: 'circle',
      center: { x: 0, y: 0 },
      radius: 250,
    });
    for (let i = 0; i < c.points.length; i++) {
      const a = c.points[i],
        b = c.points[(i + 1) % c.points.length];
      expect(
        250 - Math.hypot((a.x + b.x) / 2, (a.y + b.y) / 2),
      ).toBeLessThanOrEqual(0.050000001);
    }
  });
  it('converte referencial local/modelo exatamente uma vez com escala, deslocamento e rotação', () => {
    const m = {
      ...newNativeMask('Teste'),
      scale: 10,
      rotation: 37,
      origin: { x: 800, y: -300 },
    };
    const a = { x: 1, y: 2 },
      b = { x: 101, y: 52 };
    const q = shapeFromWorld(
      'rectangle',
      [maskPoint(a, m), maskPoint(b, m)],
      m,
    );
    if (q.kind === 'circle' || q.kind === 'arc') throw 0;
    expect(q.points[1].x).toBeCloseTo(101, 10);
    expect(localMaskPoint(maskPoint(a, m), m).y).toBeCloseTo(2, 10);
  });
  it('rejeita degeneração, não finitos, raio inválido e excesso de vértices', () => {
    for (const radius of [0, -1, NaN, Infinity])
      expect(() =>
        nativePoints({ kind: 'circle', center: { x: 0, y: 0 }, radius }),
      ).toThrow();
    expect(() =>
      nativePoints({
        kind: 'line',
        points: [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ],
        closed: false,
      }),
    ).toThrow();
    expect(() =>
      nativePoints({
        kind: 'rectangle',
        points: [
          { x: 0, y: 0 },
          { x: 0, y: 500 },
        ],
        closed: true,
      }),
    ).toThrow();
    expect(() =>
      nativePoints({
        kind: 'polyline',
        points: Array(501).fill({ x: 0, y: 0 }),
        closed: false,
      }),
    ).toThrow();
  });
  it('valida identidade única e cache de representação e preserva origem nativa', () => {
    const m = { ...newNativeMask('A'), primitives: shapes() };
    expect(() => validateNativeMask(m)).not.toThrow();
    expect(() =>
      validateNativeMask({
        ...m,
        primitives: [m.primitives[0], m.primitives[0]],
      }),
    ).toThrow();
    expect(() =>
      validateNativeMask({
        ...m,
        primitives: [{ ...m.primitives[0], points: [] }],
      }),
    ).toThrow();
  });
  it('migra v19 sem alterar IDs, aço, polilinhas ou máscara importada e persiste v20', () => {
    const p = fixture();
    const old = {
      ...p,
      schema: 'armadurastruct/19',
      masks: [
        {
          ...p.masks[0],
          format: 'DXF',
          primitives: p.masks[0].primitives.map(
            ({ native, id, ...rest }) => rest,
          ),
        },
      ],
    };
    const q = decodeProject(JSON.stringify(old));
    expect(q.schema).toBe('armadurastruct/25');
    expect(q.masks[0].id).toBe(old.masks[0].id);
    expect(q.masks[0].primitives.map((p) => p.points)).toEqual(
      old.masks[0].primitives.map((p) => p.points),
    );
    expect(q.bars).toEqual(old.bars);
    expect(decodeProject(JSON.stringify(p))).toEqual(p);
  });
  it.each(['mm', 'cm', 'm'] as const)(
    'pacote v11 em %s preserva círculo analítico, medidas e levantamento',
    (unit) => {
      const p = fixture();
      const pack = createDetailPackage(p, p.hierarchy.details[0].id, {
        producer: { app: 'Teste', version: '1' },
        unit,
      });
      const q = readDetailPackage(pack).project;
      expect(q.masks[0].primitives[2].native?.kind).toBe('circle');
      const c = q.masks[0].primitives[2].native;
      if (c?.kind === 'circle') expect(c.radius).toBeCloseTo(250, 10);
      expect(schedule(q)[0].weight).toBeCloseTo(schedule(p)[0].weight, 10);
    },
  );
  it('canvas/saída compartilham uma representação por entidade e CSV permanece igual após apagar máscara', () => {
    const p = fixture();
    expect(drawingPrimitives(p).filter((v) => v.native)).toHaveLength(4);
    expect(maskPrimitives(p.masks[0])).toHaveLength(4);
    expect(toDxf(p)).toContain('LWPOLYLINE');
    expect(toPdf(p).length).toBeGreaterThan(100);
    expect(toCsv({ ...p, masks: [] })).toBe(toCsv(p));
  });
});
