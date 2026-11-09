import { describe, it, expect } from 'vitest';
import {
  pathCurve,
  roundCurve,
  trimCurve,
  extendCurve,
  curvePoint,
  curveIntersections,
  TAU,
  uniquePoints,
} from '../src/domain/maskCadGeometry';
import {
  maskCadEntities,
  previewMaskCadEdit,
  applyMaskCadEdit,
  maskCurve,
  maskEditTarget,
} from '../src/domain/maskCadEditing';
import {
  newNativeMask,
  nativePrimitive,
  validateNativeMask,
  scaleNativeShape,
} from '../src/domain/nativeMasks';
import {
  emptyProject,
  newBar,
  decodeProject,
  schedule,
  createScheduleLock,
} from '../src/domain/model';
import { completeOwnership } from '../src/domain/hierarchy';
import { maskPoint, parseDxf, maskPrimitives } from '../src/cad/import';
import { setLayerState } from '../src/domain/layerProfiles';
import { layerId } from '../src/domain/layers';
import {
  createDetailPackage,
  readDetailPackage,
} from '../src/domain/detailPackage';
import { toCsv, toDxf, toPdf, toSheetPdf } from '../src/lib/exports';
import { composeSheet, alignPlacement } from '../src/domain/paper';
import { placeDrawing } from '../src/domain/sheets';
import { hideObjects } from '../src/domain/visibility';
import type { Point, Mask, Project } from '../src/domain/types';
const path = (x1: number, y1: number, x2: number, y2: number) =>
  pathCurve(
    [
      { x: x1, y: y1 },
      { x: x2, y: y2 },
    ],
    false,
  );
const vertical = (x: number) => path(x, -1000, x, 1000);
function fixture(imported = false) {
  const mask: Mask = {
    ...newNativeMask('Alvo'),
    id: 'target-mask',
    format: imported ? 'DXF' : 'NATIVE',
    primitives: [
      nativePrimitive(
        {
          kind: 'line',
          points: [
            { x: 0, y: 0 },
            { x: 1000, y: 0 },
          ],
          closed: false,
        },
        'target',
        'DESENHO',
      ),
      nativePrimitive(
        {
          kind: 'line',
          points: [
            { x: 300, y: -500 },
            { x: 300, y: 500 },
          ],
          closed: false,
        },
        'limit-a',
        'DESENHO',
      ),
      nativePrimitive(
        {
          kind: 'line',
          points: [
            { x: 700, y: -500 },
            { x: 700, y: 500 },
          ],
          closed: false,
        },
        'limit-b',
        'DESENHO',
      ),
    ],
  };
  if (imported)
    mask.primitives = mask.primitives.map(({ native, id, ...p }) => p);
  let p = completeOwnership({
    ...emptyProject(),
    bars: [{ ...newBar('N1'), quantity: 8 }],
    masks: [mask, { ...newNativeMask('Outra'), id: 'other-mask' }],
  });
  p = { ...p, scheduleLock: createScheduleLock(p) };
  const context = { key: 'model', detailId: p.hierarchy.details[0].id };
  return { p, mask: p.masks[0], context };
}
describe('Ajustar / Trim em coordenadas físicas', () => {
  it.each([false, true])(
    'lado do clique independe da orientação reversa=%s',
    (reverse) => {
      const line = reverse ? path(1000, 0, 0, 0) : path(0, 0, 1000, 0);
      const a = trimCurve(line, [vertical(400)], { x: 800, y: 0 }).remaining[0];
      expect(
        [curvePoint(a, 0).x, curvePoint(a, a.total).x].sort((a, b) => a - b),
      ).toEqual([0, 400]);
      const b = trimCurve(line, [vertical(400)], { x: 100, y: 0 }).remaining[0];
      expect(
        [curvePoint(b, 0).x, curvePoint(b, b.total).x].sort((a, b) => a - b),
      ).toEqual([400, 1000]);
    },
  );
  it('dois limites removem só o intervalo central', () => {
    const r = trimCurve(path(0, 0, 1000, 0), [vertical(300), vertical(700)], {
      x: 500,
      y: 0,
    });
    expect(r.remaining.map((c) => c.total)).toEqual([300, 300]);
    expect(r.change.total).toBe(400);
  });
  it('retângulo fechado abre com caminho remanescente sem diagonais nem fechamento duplicado', () => {
    const c = pathCurve(
      [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { x: 1000, y: 500 },
        { x: 0, y: 500 },
      ],
      true,
    );
    const r = trimCurve(c, [path(300, -10, 300, 10), path(700, -10, 700, 10)], {
      x: 500,
      y: 0,
    });
    expect(r.remaining[0].closed).toBe(false);
    expect(r.remaining[0].total).toBe(2600);
    expect(r.change.total).toBe(400);
    const wrap = trimCurve(
      c,
      [path(300, -10, 300, 10), path(700, -10, 700, 10)],
      { x: 0, y: 250 },
    );
    expect(wrap.remaining[0].total).toBe(400);
    expect(wrap.change.total).toBe(2600);
  });
  it('círculo secante vira arco analítico, tangência única não apaga o círculo', () => {
    const c = roundCurve({ x: 0, y: 0 }, 100, 0, TAU, true);
    const r = trimCurve(c, [vertical(0)], { x: 100, y: 0 });
    expect(r.remaining[0].kind).toBe('round');
    expect(r.remaining[0].total).toBeCloseTo(100 * Math.PI, 9);
    expect(curvePoint(r.remaining[0], r.remaining[0].total / 2).x).toBeCloseTo(
      -100,
      9,
    );
    expect(() => trimCurve(c, [vertical(100)], { x: -100, y: 0 })).toThrow(
      /tangência/,
    );
  });
  it('não encontra interseção, encontro só em ponta e sobreposição não apagam nada', () => {
    for (const limits of [
      [vertical(1000)],
      [vertical(1500)],
      [path(300, 0, 700, 0)],
    ])
      expect(() =>
        trimCurve(path(0, 0, 1000, 0), limits, { x: 100, y: 0 }),
      ).toThrow();
    expect(() =>
      trimCurve(path(0, 0, 1000, 0), [vertical(400)], { x: 400, y: 0 }),
    ).toThrow(/dentro/);
  });
  it('círculos/linhas resolvem tangências e arcos limitadores finitos', () => {
    const c = roundCurve({ x: 700, y: 100 }, 100, 0, TAU, true);
    expect(curveIntersections(path(0, 0, 1000, 0), c)).toEqual([
      { x: 700, y: 0 },
    ]);
    const arc = roundCurve({ x: 700, y: 0 }, 100, 0, Math.PI / 2);
    expect(curveIntersections(path(0, 0, 1000, 0), arc)).toHaveLength(1);
  });
});
describe('Estender / Extend até limite finito', () => {
  it('primeiro encontro adiante, ponta selecionada e orientação invertida', () => {
    const c = path(0, 0, 400, 0),
      r = extendCurve(c, [vertical(1000), vertical(700)], { x: 390, y: 0 });
    expect(r.remaining[0].total).toBe(700);
    expect(r.change.total).toBe(300);
    const reversed = extendCurve(path(400, 0, 0, 0), [vertical(1000)], {
      x: 390,
      y: 0,
    });
    expect(curvePoint(reversed.remaining[0], 0).x).toBe(1000);
    expect(
      curvePoint(reversed.remaining[0], reversed.remaining[0].total).x,
    ).toBe(0);
  });
  it('limite paralelo, atrás, ponta já no limite e alvo fechado são neutros com orientação', () => {
    const c = path(0, 0, 400, 0);
    for (const bounds of [
      [vertical(-100)],
      [path(0, 100, 1000, 100)],
      [vertical(400), vertical(700)],
    ])
      expect(() => extendCurve(c, bounds, { x: 390, y: 0 })).toThrow();
    expect(() =>
      extendCurve(
        pathCurve(
          [
            { x: 0, y: 0 },
            { x: 1000, y: 0 },
            { x: 0, y: 500 },
          ],
          true,
        ),
        [vertical(1200)],
        { x: 900, y: 0 },
      ),
    ).toThrow(/fechados/);
    expect(() =>
      extendCurve(
        roundCurve({ x: 0, y: 0 }, 100, 0, TAU, true),
        [vertical(200)],
        { x: 100, y: 0 },
      ),
    ).toThrow(/Círculos/);
  });
  it('polilinha conserva os demais vértices e recusa nova autointerseção', () => {
    const c = pathCurve(
      [
        { x: 0, y: 0 },
        { x: 400, y: 0 },
        { x: 400, y: 300 },
      ],
      false,
    );
    const r = extendCurve(c, [path(0, 600, 1000, 600)], { x: 400, y: 290 });
    expect(r.remaining[0].kind).toBe('path');
    if (r.remaining[0].kind === 'path')
      expect(r.remaining[0].points).toEqual([
        { x: 0, y: 0 },
        { x: 400, y: 0 },
        { x: 400, y: 600 },
      ]);
    const u = pathCurve(
      [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { x: 1000, y: 500 },
        { x: 500, y: 500 },
      ],
      false,
    );
    expect(() =>
      extendCurve(u, [vertical(-200)], { x: 510, y: 500 }),
    ).not.toThrow();
    const crossing = pathCurve(
      [
        { x: 0, y: 0 },
        { x: 0, y: 1000 },
        { x: 500, y: 1000 },
        { x: 500, y: 500 },
        { x: 200, y: 500 },
      ],
      false,
    );
    expect(() =>
      extendCurve(crossing, [vertical(-200)], { x: 210, y: 500 }),
    ).toThrow(/autointersectaria/);
  });
  it('círculo limitador e tangência escolhem o encontro finito mais próximo', () => {
    const a = extendCurve(
      path(0, 0, 400, 0),
      [roundCurve({ x: 1000, y: 0 }, 100, 0, TAU, true)],
      { x: 390, y: 0 },
    );
    expect(a.remaining[0].total).toBe(900);
    const b = extendCurve(
      path(0, 0, 400, 0),
      [roundCurve({ x: 1000, y: 100 }, 100, 0, TAU, true)],
      { x: 390, y: 0 },
    );
    expect(b.remaining[0].total).toBe(1000);
  });
  it('arco prolonga na mesma circunferência e mantém a tangência', () => {
    const c = roundCurve({ x: 0, y: 0 }, 100, 0, Math.PI / 2),
      r = extendCurve(c, [path(-200, 0, -1, 0)], curvePoint(c, c.total - 5));
    expect(r.remaining[0].kind).toBe('round');
    if (r.remaining[0].kind === 'round') {
      expect(r.remaining[0].radius).toBe(100);
      expect(r.remaining[0].sweep).toBeCloseTo(Math.PI, 10);
    }
  });
});
describe('transação CAD, persistência e integridade', () => {
  it.each([false, true])(
    'corte com dois remanescentes, origem importada=%s, preserva aço/RA e dados das outras máscaras',
    (imported) => {
      const { p, context, mask } = fixture(imported),
        before = JSON.stringify(p),
        entities = maskCadEntities(p, context);
      const plan = previewMaskCadEdit(
        p,
        mask.id,
        'trim',
        entities[0].ref,
        [entities[1].ref, entities[2].ref],
        false,
        { x: 500, y: 0 },
        context,
      );
      expect(JSON.stringify(p)).toBe(before);
      const q = applyMaskCadEdit(p, plan, context);
      expect(q.masks[0].primitives).toHaveLength(4);
      expect(
        q.masks[0].primitives
          .slice(0, 2)
          .map((p) => maskCurve(q.masks[0], p).total),
      ).toEqual([300, 300]);
      expect(
        new Set(q.masks[0].primitives.map((p) => p.id).filter(Boolean)).size,
      ).toBe(imported ? 2 : 4);
      if (!imported) expect(q.masks[0].primitives[0].id).toBe('target');
      expect(q.masks[0].primitives[1].sourceEntityId).toBe(
        q.masks[0].primitives[0].sourceEntityId,
      );
      expect(q.masks[0].format).toBe(mask.format);
      expect(q.masks[0].sourceUnit).toBe(mask.sourceUnit);
      expect(q.bars).toBe(p.bars);
      expect(q.scheduleLock).toBe(p.scheduleLock);
      expect(toCsv(q)).toBe(toCsv(p));
      expect(q.masks[1]).toBe(p.masks[1]);
      expect(schedule(q)).toEqual(schedule(p));
      expect(decodeProject(JSON.stringify(q)).masks).toEqual(q.masks);
    },
  );
  it('transformação em cm, rotacionada/transladada, corta a mesma posição física sem dupla escala', () => {
    const f = fixture(true),
      mask = {
        ...f.mask,
        scale: 10,
        rotation: 37,
        origin: { x: 800, y: -300 },
      },
      p = { ...f.p, masks: [mask, f.p.masks[1]] },
      es = maskCadEntities(p, f.context);
    const plan = previewMaskCadEdit(
      p,
      mask.id,
      'trim',
      es[0].ref,
      [es[1].ref],
      false,
      maskPoint({ x: 800, y: 0 }, mask),
      f.context,
    );
    const q = applyMaskCadEdit(p, plan, f.context);
    expect(maskCurve(q.masks[0], q.masks[0].primitives[0]).total).toBeCloseTo(
      3000,
      8,
    );
    expect(q.masks[0].scale).toBe(10);
    expect(q.masks[0].rotation).toBe(37);
  });
  it('Estender referência inclinada/importada preserva a ponta oposta e a transformação da máscara', () => {
    const f = fixture(true);
    const m = {
      ...f.mask,
      scale: 10,
      sourceUnit: 'cm' as const,
      rotation: 37,
      origin: { x: 800, y: -300 },
      primitives: [
        {
          ...f.mask.primitives[0],
          points: [
            { x: 0, y: 0 },
            { x: 400, y: 0 },
          ],
        },
        f.mask.primitives[2],
      ],
    };
    const p = { ...f.p, masks: [m, f.p.masks[1]] },
      es = maskCadEntities(p, f.context);
    const plan = previewMaskCadEdit(
      p,
      m.id,
      'extend',
      es[0].ref,
      [es[1].ref],
      false,
      maskPoint({ x: 390, y: 0 }, m),
      f.context,
    );
    const q = applyMaskCadEdit(p, plan, f.context);
    expect(maskCurve(q.masks[0], q.masks[0].primitives[0]).total).toBeCloseTo(
      7000,
      7,
    );
    expect(q.masks[0].primitives[0].points[0].x).toBeCloseTo(0, 9);
    expect(q.masks[0].rotation).toBe(37);
    expect(q.masks[0].scale).toBe(10);
    expect(q.masks[0].sourceUnit).toBe('cm');
    expect(q.bars).toBe(p.bars);
  });
  it('bloqueios, limites protegidos de outra máscara e prévia obsoleta', () => {
    const { p, context, mask } = fixture(),
      es = maskCadEntities(p, context),
      plan = previewMaskCadEdit(
        p,
        mask.id,
        'trim',
        es[0].ref,
        [es[1].ref],
        false,
        { x: 800, y: 0 },
        context,
      );
    expect(() => applyMaskCadEdit({ ...p }, plan, context)).toThrow(/mudou/);
    expect(() =>
      maskEditTarget(p, mask.id, { ...context, key: 'sheet:x' }),
    ).toThrow(/papel/);
    const blocked = setLayerState(
      p,
      'model',
      mask.layerId ?? layerId('MASCARA'),
      { editable: false },
    );
    expect(() => maskEditTarget(blocked, mask.id, context)).toThrow(
      /bloqueada/,
    );
  });
  it('círculo vira arco, salva, intercambia e exporta sem perder centro/raio ou estilo', () => {
    const f = fixture(),
      circle = nativePrimitive(
        { kind: 'circle', center: { x: 500, y: 0 }, radius: 200 },
        'circle',
        'DESENHO',
      ),
      m = {
        ...f.mask,
        primitives: [
          circle,
          nativePrimitive(
            {
              kind: 'line',
              points: [
                { x: 500, y: -500 },
                { x: 500, y: 500 },
              ],
              closed: false,
            },
            'limit',
            'DESENHO',
          ),
        ],
      },
      p = { ...f.p, masks: [m, f.p.masks[1]] },
      es = maskCadEntities(p, f.context);
    const q = applyMaskCadEdit(
        p,
        previewMaskCadEdit(
          p,
          m.id,
          'trim',
          es[0].ref,
          [es[1].ref],
          false,
          { x: 700, y: 0 },
          f.context,
        ),
        f.context,
      ),
      arc = q.masks[0].primitives[0];
    expect(arc.native?.kind).toBe('arc');
    expect(arc.id).toBe('circle');
    validateNativeMask(q.masks[0]);
    expect(
      decodeProject(JSON.stringify(q)).masks[0].primitives[0].native,
    ).toEqual(arc.native);
    const pack = createDetailPackage(q, f.context.detailId, {
        producer: { app: 'test', version: '1' },
        unit: 'cm',
      }),
      back = readDetailPackage(JSON.stringify(pack)).project;
    expect(back.masks[0].primitives[0].native?.kind).toBe('arc');
    expect(back.masks[0].primitives[0].native).toEqual(arc.native);
    expect(pack.schema).toBe('openstruct.detail/15');
    expect(() =>
      readDetailPackage({ ...pack, schema: 'openstruct.detail/13' }),
    ).toThrow(/v14/);
    expect(toPdf(q).length).toBeGreaterThan(100);
    expect(parseDxf(toDxf(q), 'out.dxf').primitives.length).toBeGreaterThan(0);
    expect(scaleNativeShape(arc.native!, 2).kind).toBe('arc');
  });
  it('migra v22 sem alterar objetos e rejeita arco/linhagem falsamente etiquetados como legado', () => {
    const { p, context } = fixture(),
      raw = { ...p, schema: 'armadurastruct/22' };
    const legacyPack = {
      ...createDetailPackage(p, context.detailId, {
        producer: { app: 'test', version: '1' },
      }),
      schema: 'openstruct.detail/13',
    };
    expect(
      readDetailPackage(legacyPack).project.masks[0].primitives,
    ).toMatchObject(p.masks[0].primitives);
    expect(decodeProject(JSON.stringify(raw)).schema).toBe('armadurastruct/24');
    const shape = {
      kind: 'arc' as const,
      center: { x: 0, y: 0 },
      radius: 100,
      startAngle: 0,
      sweepAngle: 90,
    };
    const bad = {
      ...raw,
      masks: [
        {
          ...p.masks[0],
          primitives: [nativePrimitive(shape, 'arc', 'DESENHO')],
        },
      ],
    };
    expect(() => decodeProject(JSON.stringify(bad))).toThrow(/23/);
  });
});

describe('regressões de precisão e contexto CAD', () => {
  it('cruzamento e clique equidistante não escolhem um trecho pela ordem dos vértices', () => {
    const c = pathCurve(
      [
        { x: 0, y: 0 },
        { x: 1000, y: 1000 },
        { x: 0, y: 1000 },
        { x: 1000, y: 0 },
      ],
      false,
    );
    for (const curve of [c, pathCurve([...c.points].reverse(), false)]) {
      expect(() =>
        trimCurve(curve, [vertical(300)], { x: 500, y: 500 }),
      ).toThrow(/ambíguo/);
      expect(() =>
        trimCurve(curve, [vertical(500)], { x: 100, y: 100 }),
      ).toThrow(/ambígua/);
      expect(() =>
        extendCurve(curve, [vertical(1200)], { x: 500, y: 500 }),
      ).toThrow(/ambígua/);
    }
    expect(() =>
      trimCurve(roundCurve({ x: 0, y: 0 }, 100, 0, TAU, true), [vertical(0)], {
        x: 0,
        y: 0,
      }),
    ).toThrow(/ambíguo/);
  });
  it.each([1, -1])(
    'arco com orientação %s prolonga ambas as pontas sem mudar raio/centro',
    (sign) => {
      const c = roundCurve({ x: 0, y: 0 }, 100, 0, (sign * Math.PI) / 2);
      for (const first of [true, false]) {
        const limit = first ? path(0, -200, 0, 200) : path(-200, 0, -1, 0);
        const r = extendCurve(
          c,
          [limit],
          curvePoint(c, first ? 5 : c.total - 5),
        );
        expect(r.remaining[0].kind).toBe('round');
        if (r.remaining[0].kind !== 'round') throw Error('arc');
        expect(r.remaining[0].radius).toBe(100);
        expect(r.remaining[0].center).toEqual(c.center);
        expect(r.remaining[0].sweep).toBeCloseTo(sign * Math.PI, 10);
        expect(
          curvePoint(r.remaining[0], first ? r.remaining[0].total : 0).x,
        ).toBeCloseTo(curvePoint(c, first ? c.total : 0).x, 9);
      }
    },
  );
  it('interseções deduplicadas usam tolerância física sem busca quadrática', () => {
    const values = Array.from({ length: 10000 }, (_, i) => ({
      x: i * 10,
      y: i % 13,
    }));
    expect(
      uniquePoints([
        ...values,
        ...values.map((p) => ({ x: p.x + 1e-7, y: p.y })),
      ]),
    ).toHaveLength(10000);
    expect(() =>
      trimCurve(path(0, 0, 1000, 0), [vertical(400)], { x: NaN, y: 0 }),
    ).toThrow(/finitas/);
    expect(() =>
      extendCurve(path(0, 0, 400, 0), [vertical(700)], { x: Infinity, y: 0 }),
    ).toThrow(/finitas/);
  });
  it('segmentos inferiores à tolerância e parâmetros não finitos são recusados', () => {
    expect(() => path(0, 0, 1e-8, 0)).toThrow(/curto/);
    expect(() => path(0, 0, Infinity, 0)).toThrow(/finito/);
    expect(() => roundCurve({ x: 0, y: 0 }, 0, 0, Math.PI)).toThrow(/inválida/);
    expect(() =>
      trimCurve(path(0, 0, 1000, 0), [vertical(400)], { x: 400 + 1e-8, y: 0 }),
    ).toThrow(/dentro/);
  });
  it('limites bloqueados podem referenciar; ocultos/sem captura ou fora do isolamento não participam', () => {
    const f = fixture();
    const m = {
      ...f.p.masks[1],
      layerId: layerId('COTAS'),
      primitives: [f.mask.primitives[1]],
    };
    let p = {
      ...f.p,
      masks: [{ ...f.mask, primitives: [f.mask.primitives[0]] }, m],
    };
    p = setLayerState(p, 'model', m.layerId, { editable: false });
    const es = maskCadEntities(p, f.context);
    expect(es.find((e) => e.mask.id === m.id)?.editable).toBe(false);
    const plan = previewMaskCadEdit(
      p,
      f.mask.id,
      'trim',
      es[0].ref,
      [es[1].ref],
      false,
      { x: 800, y: 0 },
      f.context,
    );
    expect(applyMaskCadEdit(p, plan, f.context).masks[1]).toBe(m);
    expect(
      maskCadEntities(
        setLayerState(p, 'model', m.layerId, { capture: false }),
        f.context,
      ),
    ).toHaveLength(1);
    expect(
      maskCadEntities(hideObjects(p, 'model', [m.id]), f.context),
    ).toHaveLength(1);
    const foreign = {
      ...p,
      hierarchy: {
        ...p.hierarchy,
        objectDetails: {
          ...p.hierarchy.objectDetails,
          [m.id]: 'foreign-detail',
        },
      },
    };
    expect(
      maskCadEntities(foreign, {
        ...f.context,
        scopeDetailId: f.context.detailId,
      }),
    ).toHaveLength(1);
    expect(() =>
      applyMaskCadEdit(p, plan, {
        ...f.context,
        scopeDetailId: 'foreign-detail',
      }),
    ).toThrow();
  });
  it('texto sem suporte permanece intacto e todos os remanescentes conservam os overrides', () => {
    const f = fixture();
    const text = {
      layer: 'DESENHO',
      points: [{ x: 100, y: 100 }],
      text: 'Não aparar',
      textHeight: 25,
    };
    const original = {
      ...f.mask.primitives[0],
      style: {
        color: '#123456',
        lineType: { name: 'DASHED', pattern: [100, -50] },
        lineScale: 2,
        lineWidth: 0.35,
      },
    };
    const p = {
      ...f.p,
      masks: [
        {
          ...f.mask,
          format: 'DXF' as const,
          primitives: [original, ...f.mask.primitives.slice(1), text],
        },
        f.p.masks[1],
      ],
    };
    const es = maskCadEntities(p, f.context);
    expect(() =>
      previewMaskCadEdit(
        p,
        f.mask.id,
        'trim',
        es[3].ref,
        [],
        true,
        { x: 100, y: 100 },
        f.context,
      ),
    ).toThrow(/Texto/);
    const q = applyMaskCadEdit(
      p,
      previewMaskCadEdit(
        p,
        f.mask.id,
        'trim',
        es[0].ref,
        [],
        true,
        { x: 500, y: 0 },
        f.context,
      ),
      f.context,
    );
    expect(q.masks[0].primitives[0].style).toEqual(original.style);
    expect(q.masks[0].primitives[1].style).toEqual(original.style);
    expect(q.masks[0].primitives.at(-1)).toBe(text);
  });
  it('um corte aparece nas duas vistas sem alterar escalas de papel ou quantitativos; PDF/DXF usam os remanescentes', () => {
    const f = fixture();
    let p = placeDrawing(
      f.p,
      f.p.sheets[0].id,
      f.p.hierarchy.drawings[0].id,
    ).project;
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
    const es = maskCadEntities(p, f.context);
    const q = applyMaskCadEdit(
      p,
      previewMaskCadEdit(
        p,
        f.mask.id,
        'trim',
        es[0].ref,
        [es[1].ref],
        false,
        { x: 800, y: 0 },
        f.context,
      ),
      f.context,
    );
    const views = composeSheet(q, p.sheets[0].id).views;
    const lengths = views.map((v) =>
      v.lines
        .filter((l) => !l.text && l.layer === 'DESENHO')
        .map((l) =>
          Math.hypot(
            l.points[1].x - l.points[0].x,
            l.points[1].y - l.points[0].y,
          ),
        ),
    );
    expect(lengths[0]).toContain(6);
    expect(lengths[1]).toContain(3);
    expect(q.hierarchy.placements).toBe(p.hierarchy.placements);
    const aligned = q.hierarchy.placements.reduce(
      (p, v) => alignPlacement(p, v.id),
      q,
    );
    expect(toSheetPdf(aligned).length).toBeGreaterThan(100);
    const out = parseDxf(toDxf(q), 'corte.dxf');
    expect(
      maskPrimitives(out).some(
        (l) =>
          !l.text &&
          Math.abs(
            Math.hypot(
              l.points[1].x - l.points[0].x,
              l.points[1].y - l.points[0].y,
            ) - 300,
          ) < 1e-7,
      ),
    ).toBe(true);
    expect(toCsv(q)).toBe(toCsv(p));
  });
});
