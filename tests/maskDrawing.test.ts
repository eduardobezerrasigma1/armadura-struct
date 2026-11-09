import { describe, it, expect } from 'vitest';
import {
  emptyProject,
  newBar,
  schedule,
  decodeProject,
  createScheduleLock,
} from '../src/domain/model';
import {
  completeOwnership,
  createHierarchyNode,
} from '../src/domain/hierarchy';
import {
  newNativeMask,
  scaleNativeShape,
  validateNativeMask,
} from '../src/domain/nativeMasks';
import {
  appendMaskShape,
  assertLocalMaskEdit,
  createDrawingMask,
  maskDrawingState,
  localDrawingLayer,
} from '../src/domain/maskDrawing';
import { maskPoint, maskPrimitives } from '../src/cad/import';
import { layerId } from '../src/domain/layers';
import { setLayerState } from '../src/domain/layerProfiles';
import { hideObjects } from '../src/domain/visibility';
import {
  createDetailPackage,
  readDetailPackage,
} from '../src/domain/detailPackage';
import { drawingPrimitives } from '../src/domain/drawingPrimitives';
import { composeSheet } from '../src/domain/paper';
import { placeDrawing } from '../src/domain/sheets';
import { toCsv, toDxf, toPdf } from '../src/lib/exports';

function fixture() {
  let p = emptyProject();
  const a = p.hierarchy.details[0].id;
  const other = createHierarchyNode(
    p,
    'detail',
    'V2',
    p.hierarchy.elements[0].id,
  );
  p = other.project;
  const native = { ...newNativeMask('Fôrma'), id: 'native-mask' };
  const imported = {
    ...newNativeMask('Fôrma'),
    id: 'imported-mask',
    format: 'DXF' as const,
    sourceUnit: 'cm',
    scale: 10,
    rotation: 37,
    origin: { x: 800, y: -300 },
    opacity: 0.45,
    layers: { FORMA: true },
    primitives: [
      {
        layer: 'FORMA',
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
      },
    ],
    warnings: ['Origem de teste'],
  };
  p = completeOwnership(
    {
      ...p,
      bars: [{ ...newBar('N1'), quantity: 2, multiplier: 3 }],
      masks: [native, imported],
      hierarchy: {
        ...p.hierarchy,
        objectDetails: { [native.id]: a, [imported.id]: other.id },
      },
    },
    a,
  );
  return { p, a, b: other.id };
}
describe('destino independente e desenho local nas referências', () => {
  it('cria sem aço, associa um destino explícito e rejeita nome duplicado apenas no mesmo contexto', () => {
    const p = emptyProject(),
      owner = p.hierarchy.details[0].id,
      context = { key: 'model', detailId: owner };
    const q = createDrawingMask(p, ' Fôrma ', owner, context);
    expect(q.project.bars).toEqual([]);
    expect(schedule(q.project)).toEqual([]);
    expect(q.mask.name).toBe('Fôrma');
    expect(q.project.hierarchy.objectDetails[q.mask.id]).toBe(owner);
    expect(p.masks).toEqual([]);
    expect(() => createDrawingMask(q.project, 'fôrma', owner, context)).toThrow(
      /nome/,
    );
    const other = createHierarchyNode(
      q.project,
      'detail',
      'V2',
      p.hierarchy.elements[0].id,
    );
    expect(() =>
      createDrawingMask(other.project, 'Fôrma', other.id, {
        key: 'model',
        detailId: other.id,
      }),
    ).not.toThrow();
    for (const name of [' ', 'x'.repeat(201)])
      expect(() => createDrawingMask(p, name, owner, context)).toThrow();
  });
  it('recusa contexto inexistente, prancha e excesso de máscaras, atomicamente', () => {
    const { p, a } = fixture(),
      before = JSON.stringify(p);
    for (const detailId of ['missing', p.hierarchy.details[1].id])
      expect(() =>
        createDrawingMask(p, 'Nova', detailId, { key: 'model', detailId: a }),
      ).toThrow(/contexto/);
    expect(() =>
      createDrawingMask(p, 'Nova', a, {
        key: `sheet:${p.sheets[0].id}`,
        detailId: a,
      }),
    ).toThrow(/contexto/);
    const full = {
      ...p,
      masks: Array.from({ length: 20 }, (_, i) => ({
        ...p.masks[0],
        id: 'm' + i,
        name: 'M' + i,
      })),
    };
    expect(() =>
      createDrawingMask(full, 'Nova', a, { key: 'model', detailId: a }),
    ).toThrow(/20/);
    expect(JSON.stringify(p)).toBe(before);
  });
  it('uma linha de 1000mm na referência girada/escalada aplica o referencial uma única vez e preserva origem, aço e RA bloqueada', () => {
    let { p, b } = fixture();
    p = { ...p, scheduleLock: createScheduleLock(p) };
    const m = p.masks[1],
      before = JSON.stringify(p),
      csv = toCsv(p),
      context = { key: 'model', detailId: b };
    const from = maskPoint({ x: 0, y: 0 }, m),
      to = maskPoint({ x: 100, y: 0 }, m);
    const q = appendMaskShape(p, m.id, 'line', [from, to], context, m);
    const drawn = maskPrimitives(q.masks[1]).at(-1)!;
    expect(
      Math.hypot(
        drawn.points[1].x - drawn.points[0].x,
        drawn.points[1].y - drawn.points[0].y,
      ),
    ).toBeCloseTo(1000, 10);
    expect(q.masks[0]).toBe(p.masks[0]);
    expect(q.bars).toBe(p.bars);
    expect(q.scheduleLock).toBe(p.scheduleLock);
    expect(schedule(q)).toEqual(schedule(p));
    expect(toCsv(q)).toBe(csv);
    expect(q.masks[1]).toMatchObject({
      id: m.id,
      format: 'DXF',
      sourceUnit: 'cm',
      scale: 10,
      rotation: 37,
      origin: m.origin,
      warnings: m.warnings,
    });
    expect(q.masks[1].primitives[0]).toEqual(m.primitives[0]);
    expect(q.masks[1].primitives.at(-1)?.layer).toBe('AS_DESENHO_LOCAL');
    expect(JSON.stringify(p)).toBe(before);
    expect(() => assertLocalMaskEdit(p, m, q.masks[1], context)).not.toThrow();
  });
  it.each(['rectangle', 'circle', 'polyline'] as const)(
    'persiste %s analítico, escala de unidades no pacote e geometria nas saídas',
    (kind) => {
      const { p, b } = fixture(),
        m = p.masks[1],
        context = { key: 'model', detailId: b };
      const points = (
        kind === 'circle'
          ? [
              { x: 0, y: 0 },
              { x: 25, y: 0 },
            ]
          : [
              { x: 0, y: 0 },
              { x: 100, y: 50 },
            ]
      ).map((q) => maskPoint(q, m));
      const q = appendMaskShape(p, m.id, kind, points, context, m),
        shape = q.masks[1].primitives.at(-1)!.native!;
      expect(shape.kind).toBe(kind);
      if (shape.kind === 'circle')
        expect(scaleNativeShape(shape, m.scale)).toMatchObject({ radius: 250 });
      const restored = decodeProject(JSON.stringify(q));
      expect(restored).toEqual(q);
      for (const unit of ['mm', 'cm', 'm'] as const) {
        const pack = createDetailPackage(q, b, {
          producer: { app: 'Test', version: '1' },
          unit,
        });
        expect(pack.schema).toBe('openstruct.detail/15');
        const r = readDetailPackage(pack).project;
        const original = maskPrimitives(q.masks[1]),
          roundtrip = maskPrimitives(r.masks[0]);
        expect(roundtrip).toHaveLength(original.length);
        for (let i = 0; i < original.length; i++)
          for (let j = 0; j < original[i].points.length; j++) {
            expect(roundtrip[i].points[j].x).toBeCloseTo(
              original[i].points[j].x,
              8,
            );
            expect(roundtrip[i].points[j].y).toBeCloseTo(
              original[i].points[j].y,
              8,
            );
          }
      }
      expect(drawingPrimitives(q).filter((v) => v.native)).toHaveLength(1);
      expect(toDxf(q)).toContain('LWPOLYLINE');
      expect(toPdf(q).length).toBeGreaterThan(100);
      const placed = placeDrawing(
        q,
        q.sheets[0].id,
        q.hierarchy.drawings.find((d) => d.detailId === b)!.id,
      ).project;
      expect(
        composeSheet(placed, placed.sheets[0].id)
          .views.flatMap((view) => view.lines)
          .filter((v) => v.native),
      ).toHaveLength(1);
      expect(toCsv(q)).toBe(toCsv(p));
    },
  );
  it('ocultação, isolamento e layers bloqueados impedem desenhar sem alterar os estados', () => {
    const { p, a, b } = fixture(),
      m = p.masks[0];
    const contexts = [
      { key: 'model', detailId: b },
      { key: 'model', detailId: a, scopeDetailId: b },
      { key: `sheet:${p.sheets[0].id}`, detailId: a },
    ];
    for (const context of contexts)
      expect(maskDrawingState(p, m.id, context).editable).toBe(false);
    const blocked = [
      {
        ...p,
        masks: p.masks.map((o) =>
          o.id === m.id ? { ...o, visible: false } : o,
        ),
      },
      hideObjects(p, 'model', [m.id]),
      setLayerState(p, 'model', layerId('MASCARA'), { editable: false }),
      setLayerState(p, 'model', layerId('DESENHO'), { editable: false }),
      {
        ...p,
        masks: p.masks.map((o) =>
          o.id === m.id ? { ...o, layers: { DESENHO: false } } : o,
        ),
      },
    ];
    for (const q of blocked) {
      const before = JSON.stringify(q),
        mask = q.masks[0];
      expect(() =>
        appendMaskShape(
          q,
          mask.id,
          'line',
          [
            { x: 0, y: 0 },
            { x: 1000, y: 0 },
          ],
          { key: 'model', detailId: a },
          mask,
        ),
      ).toThrow();
      expect(JSON.stringify(q)).toBe(before);
    }
    expect(
      maskDrawingState(p, 'missing', { key: 'model', detailId: a }).editable,
    ).toBe(false);
  });
  it('revalida identidade do alvo, limites e degeneração sem deixar objetos parciais', () => {
    const { p, a } = fixture(),
      m = p.masks[0],
      context = { key: 'model', detailId: a };
    expect(() =>
      appendMaskShape(
        p,
        m.id,
        'line',
        [
          { x: 0, y: 0 },
          { x: 1000, y: 0 },
        ],
        context,
        { ...m },
      ),
    ).toThrow(/mudou/);
    expect(() =>
      appendMaskShape(
        p,
        m.id,
        'circle',
        [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ],
        context,
        m,
      ),
    ).toThrow();
    expect(() =>
      appendMaskShape(
        p,
        m.id,
        'line',
        [
          { x: NaN, y: 0 },
          { x: 1000, y: 0 },
        ],
        context,
        m,
      ),
    ).toThrow();
    const full = {
      ...m,
      primitives: Array(100000).fill({ layer: 'L', points: [] }),
    };
    expect(() =>
      appendMaskShape(
        { ...p, masks: [full] },
        m.id,
        'line',
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
        context,
        full,
      ),
    ).toThrow(/Limite/);
  });
  it('preserva entidades importadas e bloqueia alteração de origem, entidade protegida e perda analítica', () => {
    const { p, b } = fixture(),
      m = p.masks[1],
      context = { key: 'model', detailId: b };
    expect(() =>
      assertLocalMaskEdit(p, m, { ...m, primitives: [] }, context),
    ).toThrow(/importada/);
    expect(() =>
      assertLocalMaskEdit(p, m, { ...m, format: 'NATIVE' }, context),
    ).toThrow(/origem/);
    const q = appendMaskShape(
        p,
        m.id,
        'circle',
        [maskPoint({ x: 0, y: 0 }, m), maskPoint({ x: 25, y: 0 }, m)],
        context,
        m,
      ),
      next = q.masks[1];
    const blocked = setLayerState(q, 'model', layerId('DESENHO'), {
      editable: false,
    });
    expect(() =>
      assertLocalMaskEdit(
        blocked,
        next,
        { ...next, primitives: next.primitives.slice(0, -1) },
        context,
      ),
    ).toThrow(/protegido/);
    const lost = {
      ...next,
      primitives: next.primitives.map((o) =>
        o.native ? { ...o, native: undefined } : o,
      ),
    };
    expect(() => assertLocalMaskEdit(q, next, lost, context)).toThrow(
      /analítica/,
    );
    expect(() =>
      validateNativeMask({
        ...next,
        primitives: [...next.primitives, next.primitives.at(-1)!],
      }),
    ).toThrow(/repetido/);
  });
  it('migra v20 sem tocar os dados; formato/pacote anteriores recusam extensão local em vez de perdê-la', () => {
    const { p, b } = fixture(),
      old = { ...p, schema: 'armadurastruct/20' };
    expect(decodeProject(JSON.stringify(old))).toEqual(p);
    const m = p.masks[1],
      q = appendMaskShape(
        p,
        m.id,
        'line',
        [
          { x: 0, y: 0 },
          { x: 1000, y: 0 },
        ],
        { key: 'model', detailId: b },
        m,
      );
    expect(() =>
      decodeProject(JSON.stringify({ ...q, schema: 'armadurastruct/20' })),
    ).toThrow(/21/);
    const pack = createDetailPackage(q, b, {
      producer: { app: 'test', version: '1' },
    });
    expect(() =>
      readDetailPackage({ ...pack, schema: 'openstruct.detail/11' }),
    ).toThrow(/v12/);
    expect(localDrawingLayer(q.masks[1])).toBe('AS_DESENHO_LOCAL');
  });
});
