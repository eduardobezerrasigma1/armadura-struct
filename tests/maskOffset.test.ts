import { describe, it, expect } from 'vitest';
import { maskManipFixture } from './fixtures/maskManipulation';
import { nativePrimitive, validateNativeMask } from '../src/domain/nativeMasks';
import { maskCadEntities } from '../src/domain/maskCadEditing';
import {
  offsetMaskGeometry,
  previewMaskOffset,
  applyMaskOffset,
  parseOffsetDistance,
  measuredOffsetDistance,
} from '../src/domain/maskOffset';
import { maskPoint, maskPrimitives, parseDxf } from '../src/cad/import';
import { decodeProject, schedule } from '../src/domain/model';
import { toCsv, toDxf, toPdf } from '../src/lib/exports';
import { setLayerState } from '../src/domain/layerProfiles';
import {
  createDetailPackage,
  readDetailPackage,
} from '../src/domain/detailPackage';
import { placeDrawing } from '../src/domain/sheets';
import { composeSheet, modelToPaper } from '../src/domain/paper';
import { bounds } from '../src/domain/geometry';
import type { Point, Project } from '../src/domain/types';
const context = (p: Project) => ({
  key: 'model',
  detailId: p.hierarchy.objectDetails[p.masks[0].id],
});
const ref = (p: Project, i = 0) =>
  maskCadEntities(p, context(p)).find(
    (e) => e.mask.id === p.masks[0].id && e.ref.index === i,
  )!.ref;
const line = (points: Point[]) =>
  nativePrimitive({ kind: 'line', points, closed: false }, 'line');
const poly = (points: Point[], closed = false) =>
  nativePrimitive({ kind: 'polyline', points, closed }, 'path');
const xy = (values: number[]) =>
  Array.from({ length: values.length / 2 }, (_, i) => ({
    x: values[2 * i],
    y: values[2 * i + 1],
  }));
export const dumbbell = xy([
  0, 0, 1000, 0, 1000, 400, 2000, 400, 2000, 0, 3000, 0, 3000, 1000, 2000, 1000,
  2000, 600, 1000, 600, 1000, 1000, 0, 1000,
]);
const apply = (p: Project, d = 100, at = { x: 500, y: 200 }, i = 0) =>
  applyMaskOffset(
    p,
    previewMaskOffset(p, p.masks[0].id, ref(p, i), d, at, context(p)),
    context(p),
  );
describe('Offset de máscaras', () => {
  it('limites de entidades e orçamento geométrico rejeitam antes do commit', () => {
    const p = maskManipFixture();
    p.masks[0].primitives = Array.from({ length: 100000 }, (_, i) => ({
      ...line(xy([0, 0, 1000, 0])),
      id: `e${i}`,
    }));
    expect(() => apply(p)).toThrow(/100 mil/);
    const points = Array.from({ length: 800 }, (_, i) => ({
      x: 1000 * Math.cos((i * Math.PI) / 400),
      y: 1000 * Math.sin((i * Math.PI) / 400),
    }));
    expect(() =>
      offsetMaskGeometry(
        { ...p.masks[0], format: 'DXF' },
        { layer: 'CAD', points, closed: true },
        10,
        { x: 0, y: 0 },
      ),
    ).toThrow(/250 mil/);
  });
  it('texto, furos sem contrato de agrupamento e contexto isolado são recusados explicitamente', () => {
    const p = maskManipFixture();
    expect(() =>
      offsetMaskGeometry(
        p.masks[0],
        { layer: 'CAD', text: 'teste', points: [{ x: 0, y: 0 }] },
        100,
        { x: 0, y: 0 },
      ),
    ).toThrow(/Texto/);
    const C = poly(
      xy([
        0, 0, 1000, 0, 1000, 450, 800, 450, 800, 200, 200, 200, 200, 800, 800,
        800, 800, 550, 1000, 550, 1000, 1000, 0, 1000,
      ]),
      true,
    );
    expect(() =>
      offsetMaskGeometry(p.masks[0], C, 60, { x: -500, y: 500 }),
    ).toThrow(/furos/);
    expect(() =>
      previewMaskOffset(
        p,
        p.masks[0].id,
        ref(p),
        100,
        { x: 500, y: 100 },
        { ...context(p), scopeDetailId: 'foreign' },
      ),
    ).toThrow();
  });

  it.each([false, true])(
    'linha d=100 no lado físico superior, invertida=%s',
    (reverse) => {
      const p = maskManipFixture(),
        points = xy([0, 0, 1000, 0]);
      if (reverse) points.reverse();
      p.masks[0].primitives[0] = line(points);
      const q = apply(p),
        copy = q.masks[0].primitives.at(-1)!;
      expect(copy.points).toEqual(points.map((p) => ({ ...p, y: 100 })));
      expect(q.masks[0].primitives.slice(0, 3)).toEqual(p.masks[0].primitives);
      expect(copy.id).not.toBe('line');
      expect(q.bars).toBe(p.bars);
      expect(q.annotations).toBe(p.annotations);
      expect(q.masks[1]).toBe(p.masks[1]);
      expect(q.hierarchy).toBe(p.hierarchy);
      expect(q.scheduleLock).toBe(p.scheduleLock);
      expect(toCsv(q)).toBe(toCsv(p));
      expect(schedule(q)).toEqual(schedule(p));
    },
  );
  it.each([600, 400])(
    'círculo R500 mantém centro e raio analítico %s',
    (radius) => {
      const p = maskManipFixture();
      p.masks[0].primitives[0] = nativePrimitive(
        { kind: 'circle', center: { x: 50, y: 20 }, radius: 500 },
        'offset-circle-source',
      );
      const q = apply(p, 100, { x: radius === 600 ? 1000 : 50, y: 20 });
      expect(q.masks[0].primitives.at(-1)!.native).toEqual({
        kind: 'circle',
        center: { x: 50, y: 20 },
        radius,
      });
    },
  );
  it.each([500, 600])('círculo recusa d=%s interno', (d) => {
    const p = maskManipFixture();
    p.masks[0].primitives[0] = nativePrimitive(
      { kind: 'circle', center: { x: 0, y: 0 }, radius: 500 },
      'c',
    );
    expect(() => apply(p, d, { x: 0, y: 0 })).toThrow(/Raio/);
  });
  it.each([true, false])(
    'retângulo: interno=%s conserva representação analítica',
    (internal) => {
      const p = maskManipFixture();
      p.masks[0].primitives[0] = nativePrimitive(
        { kind: 'rectangle', points: xy([0, 0, 1000, 500]), closed: true },
        'r',
      );
      const q = apply(p, 100, { x: internal ? 500 : 1500, y: 250 }),
        r = q.masks[0].primitives.at(-1)!;
      expect(r.native?.kind).toBe('rectangle');
      expect(bounds(r.points)).toMatchObject({
        width: internal ? 800 : 1200,
        height: internal ? 300 : 700,
      });
      expect(() => apply(p, 250, { x: 500, y: 250 })).toThrow(/colapsa/);
    },
  );
  it.each([false, true])(
    'L, U e sentido inverso=%s preservam junções miter',
    (reverse) => {
      const p = maskManipFixture();
      const L = xy([0, 0, 1000, 0, 1000, 1000]),
        U = xy([0, 1000, 0, 0, 1000, 0, 1000, 1000]);
      if (reverse) {
        L.reverse();
        U.reverse();
      }
      const l = offsetMaskGeometry(p.masks[0], poly(L), 100, { x: 900, y: 100 })
        .results[0];
      expect(l.points).toEqual(
        reverse
          ? xy([900, 1000, 900, 100, 0, 100])
          : xy([0, 100, 900, 100, 900, 1000]),
      );
      const u = offsetMaskGeometry(p.masks[0], poly(U), 100, { x: 500, y: 300 })
        .results[0];
      expect(bounds(u.points)).toMatchObject({
        x: 100,
        y: 100,
        width: 800,
        height: 900,
      });
      expect(() =>
        offsetMaskGeometry(p.masks[0], poly(U), 600, { x: 500, y: 300 }),
      ).toThrow(/colapsa/);
    },
  );
  it('contorno côncavo, colinearidade quase exata e concavidade interna', () => {
    const p = maskManipFixture(),
      L = poly(
        xy([0, 0, 1000, 0, 1000, 400, 400, 400, 400, 1000, 0, 1000]),
        true,
      );
    const result = offsetMaskGeometry(p.masks[0], L, 100, { x: 100, y: 100 })
      .results[0];
    expect(bounds(result.points)).toMatchObject({
      x: 100,
      y: 100,
      width: 800,
      height: 800,
    });
    const near = poly(xy([0, 0, 1000, 0.00000001, 2000, 0]));
    const r = offsetMaskGeometry(p.masks[0], near, 100, { x: 500, y: 500 })
      .results[0];
    expect(r.points[1].y).toBeCloseTo(100.00000001, 9);
    expect(() =>
      offsetMaskGeometry(p.masks[0], L, 250, { x: 100, y: 100 }),
    ).toThrow(/colapsa/);
  });
  it('contorno com gargalo: dois remanescentes sem ligação artificial; transação inteira', () => {
    const p = maskManipFixture();
    p.masks[0].primitives[0] = poly(dumbbell, true);
    const plan = previewMaskOffset(
      p,
      p.masks[0].id,
      ref(p),
      150,
      { x: 500, y: 500 },
      context(p),
    );
    expect(plan.results).toHaveLength(2);
    expect(plan.notes.join(' ')).toContain('2 remanescentes');
    for (const r of plan.results) {
      expect(r.closed).toBe(true);
      expect(bounds(r.points)).toMatchObject({ width: 700, height: 700 });
    }
    const q = applyMaskOffset(p, plan, context(p));
    expect(q.masks[0].primitives).toHaveLength(5);
    expect(new Set(q.masks[0].primitives.map((p) => p.id)).size).toBe(5);
    expect(toCsv(q)).toBe(toCsv(p));
  });
  it.each(
    [
      xy([0, 0, 1000, 1000, 0, 1000, 1000, 0]),
      xy([0, 0, 1000, 0, 0, 0]),
      xy([0, 0, 0.0000001, 0, 500, 500]),
      xy([0, 0, 1000, 0, 1, 1]),
    ].map((points) => ({ points })),
  )('geometria inválida é recusada sem alterar fonte: %j', ({ points }) => {
    const p = maskManipFixture(),
      q = { layer: 'DESENHO', points, closed: false };
    expect(() =>
      offsetMaskGeometry(p.masks[0], q, 100, { x: 200, y: 300 }),
    ).toThrow();
  });
  it.each([0, -1, NaN, Infinity, 1e10])('distância inválida %s', (d) => {
    expect(() => apply(maskManipFixture(), d)).toThrow();
  });
  it.each(['0 mm', '-1 cm', 'Infinity mm', '100', '1,2,3 m', '1e2 mm'])(
    'entrada inválida %s',
    (raw) => expect(() => parseOffsetDistance(raw)).toThrow(),
  );
  it('unidades, decimal pt-BR e distância medida não arredondam coordenadas', () => {
    expect(parseOffsetDistance('2,5 cm')).toBe(25);
    expect(parseOffsetDistance('0.1 m')).toBe(100);
    expect(measuredOffsetDistance({ x: 0, y: 0 }, { x: 100, y: 100 })).toBe(
      Math.sqrt(20000),
    );
    expect(() =>
      measuredOffsetDistance({ x: 0, y: 0 }, { x: 0, y: 0 }),
    ).toThrow();
  });
  it('clique sobre linha, prolongamento ou ambiguidade de lados opostos é recusado', () => {
    const p = maskManipFixture();
    expect(() => apply(p, 100, { x: 500, y: 0 })).toThrow(/sobre/);
    expect(() => apply(p, 100, { x: 1500, y: 0 })).toThrow(/ambíguo/);
  });
  it.each([30, -137])(
    'máscara transladada, girada %s°, escala2: distância100 mm global',
    (rotation) => {
      const p = maskManipFixture();
      Object.assign(p.masks[0], {
        scale: 2,
        rotation,
        origin: { x: 100, y: 200 },
        format: 'DXF',
        sourceUnit: 'cm',
      });
      const m = p.masks[0],
        a = maskPoint({ x: 0, y: 0 }, m),
        b = maskPoint({ x: 1000, y: 0 }, m),
        side = maskPoint({ x: 500, y: 100 }, m);
      const q = apply(p, 100, side);
      const c = maskPoint(q.masks[0].primitives.at(-1)!.points[0], m);
      const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      expect(Math.abs(cross) / Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(
        100,
        9,
      );
      expect(q.masks[0].sourceUnit).toBe('cm');
    },
  );
  it('referência já amostrada mantém polilinha, estilo e aviso; arco conserva centro e abertura', () => {
    const p = maskManipFixture(),
      m = { ...p.masks[0], format: 'DWG' as const };
    const q = {
      ...line(xy([0, 0, 1000, 0])),
      native: undefined,
      style: { color: '#123456', lineWidth: 0.4 },
      textAlign: 'center' as const,
    };
    const result = offsetMaskGeometry(m, q, 100, { x: 500, y: 100 });
    expect(result.notes.join()).toContain('segmentos');
    expect(result.results[0].style).toEqual(q.style);
    expect(result.results[0].style).not.toBe(q.style);
    const arc = nativePrimitive(
      {
        kind: 'arc',
        center: { x: 0, y: 0 },
        radius: 500,
        startAngle: 0,
        sweepAngle: 90,
      },
      'arc',
    );
    const a = offsetMaskGeometry(m, arc, 100, { x: 500, y: 500 }).results[0];
    expect(a.native).toEqual({ ...arc.native, radius: 600 });
  });
  it.each(['visible', 'capture', 'editable'] as const)(
    'proteção %s, perda de alvo, contexto e alteração concorrente',
    (field) => {
      const p = maskManipFixture();
      p.masks[0].primitives[0].layerId = p.layers[0].id;
      const r = ref(p),
        plan = previewMaskOffset(
          p,
          p.masks[0].id,
          r,
          100,
          { x: 500, y: 200 },
          context(p),
        );
      const protectedP = setLayerState(p, 'model', p.layers[0].id, {
        [field]: false,
      });
      expect(() =>
        previewMaskOffset(
          protectedP,
          p.masks[0].id,
          r,
          100,
          { x: 500, y: 200 },
          context(p),
        ),
      ).toThrow();
      expect(() => applyMaskOffset({ ...p }, plan, context(p))).toThrow(
        /mudou/,
      );
      expect(() =>
        applyMaskOffset(p, plan, { ...context(p), key: 'sheet:x' }),
      ).toThrow(/mudou/);
      expect(() =>
        previewMaskOffset(
          p,
          p.masks[1].id,
          r,
          100,
          { x: 500, y: 200 },
          context(p),
        ),
      ).toThrow();
    },
  );
  it('prévia pura sem alocar ID; persistência, intercâmbio, PDF/DXF e vistas 1:50/1:100 concordam', () => {
    let p = maskManipFixture();
    p = placeDrawing(p, p.sheets[0].id, p.hierarchy.drawings[0].id).project;
    p = placeDrawing(p, p.sheets[0].id, p.hierarchy.drawings[0].id).project;
    p = {
      ...p,
      hierarchy: {
        ...p.hierarchy,
        placements: p.hierarchy.placements.map((v, i) => ({
          ...v,
          scale: i ? 100 : 50,
        })),
      },
    };
    const original = JSON.stringify(p),
      plan = previewMaskOffset(
        p,
        p.masks[0].id,
        ref(p),
        100,
        { x: 500, y: 200 },
        context(p),
      );
    expect(JSON.stringify(p)).toBe(original);
    expect(plan.results[0].id).toBe('offset-preview');
    const q = applyMaskOffset(p, plan, context(p));
    validateNativeMask(q.masks[0]);
    expect(decodeProject(JSON.stringify(q)).masks).toEqual(q.masks);
    const back = readDetailPackage(
      JSON.stringify(
        createDetailPackage(q, context(q).detailId, {
          producer: { app: 'test', version: '1' },
          unit: 'cm',
        }),
      ),
    ).project;
    expect(back.masks[0].primitives.at(-1)!.points).toEqual(
      xy([0, 100, 1000, 100]),
    );
    expect(
      parseDxf(toDxf(q), 'offset.dxf').primitives.some(
        (p) =>
          !p.text &&
          p.points.length === 2 &&
          p.points.every((p) => p.y === 100) &&
          bounds(p.points).width === 1000,
      ),
    ).toBe(true);
    expect(toPdf(q).length).toBeGreaterThan(100);
    const sheet = composeSheet(q, q.sheets[0].id);
    for (const v of sheet.views) {
      const target = xy([0, 100, 1000, 100]).map((p) =>
        modelToPaper(p, v.placement),
      );
      expect(
        v.content.some(
          (q) =>
            !q.text &&
            q.points.length === 2 &&
            q.points.every(
              (p, i) => Math.hypot(p.x - target[i].x, p.y - target[i].y) < 1e-7,
            ),
        ),
      ).toBe(true);
    }
    expect(toCsv(q)).toBe(toCsv(p));
    expect(q.hierarchy.placements).toBe(p.hierarchy.placements);
  });
});
