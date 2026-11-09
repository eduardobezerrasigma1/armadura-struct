import { describe, it, expect } from 'vitest';
import { maskManipFixture } from './fixtures/maskManipulation';
import { maskCadEntities } from '../src/domain/maskCadEditing';
import {
  previewMaskManipulation,
  applyMaskManipulation,
} from '../src/domain/maskManipulation';
import { nativePrimitive, validateNativeMask } from '../src/domain/nativeMasks';
import { maskPoint, parseDxf } from '../src/cad/import';
import {
  transformPoint,
  type SelectionTransform,
} from '../src/domain/transforms';
import { decodeProject, schedule } from '../src/domain/model';
import { setLayerState } from '../src/domain/layerProfiles';
import { toCsv, toDxf, toPdf } from '../src/lib/exports';
import {
  createDetailPackage,
  readDetailPackage,
} from '../src/domain/detailPackage';
import type { Project, Point } from '../src/domain/types';
const ctx = (p: Project) => ({
  key: 'model',
  detailId: p.hierarchy.objectDetails[p.masks[0].id],
});
const refs = (p: Project) =>
  maskCadEntities(p, ctx(p))
    .filter((e) => e.mask.id === p.masks[0].id)
    .map((e) => e.ref);
const axis: Extract<SelectionTransform, { kind: 'mirror' }> = {
  kind: 'mirror',
  base: { x: 0, y: 0 },
  axisEnd: { x: 0, y: 1000 },
};
const mirror = (p: Project, remove = false, t = axis, selected = refs(p)) =>
  applyMaskManipulation(
    p,
    previewMaskManipulation(
      p,
      p.masks[0].id,
      selected,
      'mirror',
      ctx(p),
      t,
      remove,
    ),
    ctx(p),
  );
const near = (a: Point, b: Point) => {
  expect(a.x).toBeCloseTo(b.x, 7);
  expect(a.y).toBeCloseTo(b.y, 7);
};
describe('Espelhar entidades de máscara', () => {
  it.each([false, true])(
    'eixo x=0; apagar origem=%s; preserva aço, RA, CSV, outras entidades e máscara',
    (remove) => {
      const p = maskManipFixture();
      p.masks[0].primitives[0] = nativePrimitive(
        {
          kind: 'line',
          points: [
            { x: 100, y: 0 },
            { x: 200, y: 50 },
          ],
          closed: false,
        },
        'line',
      );
      p.masks[0].primitives[0].style = { color: '#123456', lineWidth: 0.5 };
      const q = mirror(p, remove, axis, refs(p).slice(0, 1)),
        result = q.masks[0].primitives[remove ? 0 : 3];
      near(result.points[0], { x: -100, y: 0 });
      near(result.points[1], { x: -200, y: 50 });
      expect(result.style).toEqual(p.masks[0].primitives[0].style);
      expect(result.id === 'line').toBe(remove);
      expect(q.masks[0].primitives).toHaveLength(remove ? 3 : 4);
      if (!remove)
        expect(q.masks[0].primitives.slice(0, 3)).toEqual(
          p.masks[0].primitives,
        );
      expect(q.masks[0].primitives[1]).toBe(p.masks[0].primitives[1]);
      expect(q.masks[0].id).toBe(p.masks[0].id);
      expect(q.bars).toBe(p.bars);
      expect(q.annotations).toBe(p.annotations);
      expect(q.hierarchy).toBe(p.hierarchy);
      expect(q.masks[1]).toBe(p.masks[1]);
      expect(q.scheduleLock).toBe(p.scheduleLock);
      expect(schedule(q)).toEqual(schedule(p));
      expect(toCsv(q)).toBe(toCsv(p));
    },
  );
  it('eixo y=x, sentido invertido e duplo reflexo em máscara girada/escalada/transladada', () => {
    const p = maskManipFixture();
    Object.assign(p.masks[0], {
      rotation: 30,
      scale: 2,
      origin: { x: 750, y: -320 },
      format: 'DXF',
      sourceUnit: 'cm',
    });
    const t = { ...axis, axisEnd: { x: 1000, y: 1000 } },
      back = { ...t, base: t.axisEnd, axisEnd: t.base };
    near(transformPoint({ x: 100, y: 200 }, t), { x: 200, y: 100 });
    const q = mirror(p, true, t),
      r = mirror(p, true, back),
      z = mirror(q, true, t);
    p.masks[0].primitives.forEach((v, i) => {
      const expected = v.points.map((a) =>
        transformPoint(maskPoint(a, p.masks[0]), t),
      );
      // Circles regenerate their display sampling from their analytic center/radius.
      if (v.native?.kind !== 'circle')
        expected.forEach((a, j) =>
          near(maskPoint(q.masks[0].primitives[i].points[j], q.masks[0]), a),
        );
      q.masks[0].primitives[i].points.forEach((a, j) =>
        near(a, r.masks[0].primitives[i].points[j]),
      );
      v.points.forEach((a, j) => near(a, z.masks[0].primitives[i].points[j]));
    });
    validateNativeMask(q.masks[0]);
    expect(q.masks[0].scale).toBe(2);
    expect(q.masks[0].rotation).toBe(30);
  });
  it('arco inverte abertura e conserva início refletido/raio; círculo e retângulo conservam medidas', () => {
    const p = maskManipFixture();
    p.masks[0].primitives[0] = nativePrimitive(
      {
        kind: 'arc',
        center: { x: 100, y: 100 },
        radius: 200,
        startAngle: 30,
        sweepAngle: 80,
      },
      'arc',
    );
    const t = { ...axis, axisEnd: { x: 1000, y: 300 } },
      q = mirror(p, true, t);
    const a = q.masks[0].primitives[0].native!;
    expect(a.kind).toBe('arc');
    if (a.kind !== 'arc') throw Error();
    expect(a.radius).toBe(200);
    expect(a.sweepAngle).toBe(-80);
    near(
      q.masks[0].primitives[0].points[0],
      transformPoint(p.masks[0].primitives[0].points[0], t),
    );
    expect(q.masks[0].primitives[1].native).toMatchObject({
      kind: 'circle',
      radius: 100,
    });
    const rectangle = q.masks[0].primitives[2];
    expect(rectangle.native?.kind).toBe('polyline');
    expect(rectangle.closed).toBe(true);
    expect(rectangle.points).toHaveLength(4);
    expect(
      Math.hypot(
        rectangle.points[1].x - rectangle.points[0].x,
        rectangle.points[1].y - rectangle.points[0].y,
      ),
    ).toBeCloseTo(1000, 8);
    expect(
      Math.hypot(
        rectangle.points[2].x - rectangle.points[1].x,
        rectangle.points[2].y - rectangle.points[1].y,
      ),
    ).toBeCloseTo(200, 8);
    const exported = parseDxf(toDxf(q), 'mirror.dxf').primitives;
    expect(
      exported.some(
        (v) =>
          !v.text &&
          v.points.length === q.masks[0].primitives[0].points.length &&
          v.points.every(
            (a, i) =>
              Math.hypot(
                a.x - q.masks[0].primitives[0].points[i].x,
                a.y - q.masks[0].primitives[0].points[i].y,
              ) < 1e-7,
          ),
      ),
    ).toBe(true);
    expect(toDxf(q)).toContain('LWPOLYLINE');
    expect(toPdf(q).length).toBeGreaterThan(100);
  });
  it('texto importado: reflete âncora, mantém caracteres legíveis e compensa alinhamento; cotas externas ficam estáticas', () => {
    const p = maskManipFixture();
    p.masks[0].format = 'DXF';
    p.masks[0].primitives = [
      {
        id: 'text',
        layer: 'CAD',
        text: 'Cota 100',
        textHeight: 25,
        textRotation: 0,
        textAlign: 'left',
        points: [{ x: 100, y: 200 }],
      },
    ];
    const q = mirror(p, true);
    near(q.masks[0].primitives[0].points[0], { x: -100, y: 200 });
    expect(q.masks[0].primitives[0]).toMatchObject({
      text: 'Cota 100',
      textHeight: 25,
      textAlign: 'right',
      textRotation: 0,
    });
    expect(q.annotations).toBe(p.annotations);
    const z = mirror(q, true);
    expect(z.masks[0].primitives[0]).toEqual(p.masks[0].primitives[0]);
    expect(
      parseDxf(toDxf(q), 'mirror.dxf').primitives.some(
        (v) => v.text === 'Cota 100',
      ),
    ).toBe(true);
  });
  it('prévia não muda projeto/IDs; cópias remapeiam linhagem, substituição conserva; salvar/intercâmbio preservam resultado', () => {
    const p = maskManipFixture();
    p.masks[0].primitives[1].sourceEntityId = 'line';
    p.masks[0].primitives[2].sourceEntityId = 'DXF/42';
    const before = JSON.stringify(p);
    const plan = previewMaskManipulation(
      p,
      p.masks[0].id,
      refs(p),
      'mirror',
      ctx(p),
      axis,
    );
    expect(JSON.stringify(p)).toBe(before);
    expect(plan.result[0].id).toBe('line');
    const q = applyMaskManipulation(p, plan, ctx(p));
    expect(new Set(q.masks[0].primitives.map((v) => v.id)).size).toBe(6);
    expect(q.masks[0].primitives[4].sourceEntityId).toBe(
      q.masks[0].primitives[3].id,
    );
    expect(q.masks[0].primitives[5].sourceEntityId).toBe('DXF/42');
    const z = mirror(p, true);
    expect(z.masks[0].primitives[1].sourceEntityId).toBe('line');
    expect(decodeProject(JSON.stringify(q)).masks).toEqual(q.masks);
    const result = readDetailPackage(
      JSON.stringify(
        createDetailPackage(q, ctx(p).detailId, {
          producer: { app: 'test', version: '1' },
          unit: 'mm',
        }),
      ),
    ).project;
    expect(result.masks[0].primitives.map((v) => v.native)).toEqual(
      q.masks[0].primitives.map((v) => v.native),
    );
  });
  it('recusa eixo degenerado/não finito/fora dos limites, seleção inválida, contexto, máscara e layer protegidos sem cópia parcial', () => {
    const p = maskManipFixture(),
      snapshot = JSON.stringify(p);
    for (const end of [
      { x: 0, y: 0 },
      { x: 0.001, y: 0 },
      { x: NaN, y: 1 },
      { x: Infinity, y: 2 },
      { x: 1e10, y: 0 },
    ])
      expect(() => mirror(p, false, { ...axis, axisEnd: end })).toThrow();
    expect(() => mirror(p, false, axis, [])).toThrow();
    expect(() => mirror(p, false, axis, [refs(p)[0], refs(p)[0]])).toThrow();
    const plan = previewMaskManipulation(
      p,
      p.masks[0].id,
      refs(p),
      'mirror',
      ctx(p),
      axis,
    );
    expect(() => applyMaskManipulation({ ...p }, plan, ctx(p))).toThrow();
    expect(() =>
      applyMaskManipulation(p, plan, { ...ctx(p), key: 'drawing:other' }),
    ).toThrow();
    for (const field of ['visible', 'capture', 'editable'] as const) {
      const q = setLayerState(
        p,
        'model',
        p.layers.find((l) => l.name === 'DESENHO')!.id,
        { [field]: false },
      );
      expect(() => mirror(q)).toThrow();
    }
    expect(() =>
      mirror({ ...p, masks: p.masks.map((m) => ({ ...m, visible: false })) }),
    ).toThrow();
    expect(JSON.stringify(p)).toBe(snapshot);
  });
});
