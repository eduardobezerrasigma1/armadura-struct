import { describe, it, expect } from 'vitest';
import { maskManipFixture } from './fixtures/maskManipulation';
import { maskCadEntities } from '../src/domain/maskCadEditing';
import {
  applyMaskManipulation,
  previewMaskManipulation,
} from '../src/domain/maskManipulation';
import { decodeProject, schedule } from '../src/domain/model';
import { maskPoint, parseDxf } from '../src/cad/import';
import { nativePrimitive, validateNativeMask } from '../src/domain/nativeMasks';
import {
  createDetailPackage,
  readDetailPackage,
} from '../src/domain/detailPackage';
import { setLayerState } from '../src/domain/layerProfiles';
import { toCsv, toDxf, toPdf } from '../src/lib/exports';
import { placeDrawing } from '../src/domain/sheets';
import { composeSheet, modelToPaper } from '../src/domain/paper';
import type { Project } from '../src/domain/types';
const context = (p: Project) => ({
  key: 'model',
  detailId: p.hierarchy.objectDetails[p.masks[0].id],
});
const refs = (p: Project) =>
  maskCadEntities(p, context(p))
    .filter((e) => e.mask.id === p.masks[0].id)
    .map((e) => e.ref);
const copy = (
  p: Project,
  x: number,
  y: number,
  selected = refs(p).slice(0, 2),
) =>
  applyMaskManipulation(
    p,
    previewMaskManipulation(p, p.masks[0].id, selected, 'copy', context(p), {
      kind: 'translate',
      delta: { x, y },
    }),
    context(p),
  );
const erase = (p: Project, selected = refs(p).slice(0, 2)) =>
  applyMaskManipulation(
    p,
    previewMaskManipulation(p, p.masks[0].id, selected, 'erase', context(p)),
    context(p),
  );
describe('Manipular entidades de máscaras', () => {
  it('apaga duas entidades, preserva terceira, máscara, outro alvo, aço, cotas estáticas e RA bloqueada', () => {
    const p = maskManipFixture();
    const q = erase(p);
    expect(q.masks[0].primitives).toEqual([p.masks[0].primitives[2]]);
    expect(q.masks[0].id).toBe(p.masks[0].id);
    expect(q.masks[1]).toBe(p.masks[1]);
    expect(q.bars).toBe(p.bars);
    expect(q.annotations).toBe(p.annotations);
    expect(q.hierarchy).toBe(p.hierarchy);
    expect(q.scheduleLock).toBe(p.scheduleLock);
    expect(schedule(q)).toEqual(schedule(p));
    expect(toCsv(q)).toBe(toCsv(p));
    expect(p.masks[0].primitives).toHaveLength(3);
  });
  it('última entidade pode ser apagada e a máscara nativa vazia continua válida no arquivo', () => {
    const p = maskManipFixture(),
      q = erase(p, refs(p));
    expect(q.masks[0].primitives).toEqual([]);
    validateNativeMask(q.masks[0]);
    expect(decodeProject(JSON.stringify(q)).masks[0]).toEqual(q.masks[0]);
  });
  it('linha e círculo em dois destinos: IDs independentes, forma, raio, estilo e originais preservados', () => {
    const p = maskManipFixture();
    p.masks[0].primitives[0].style = { color: '#123456', lineWidth: 0.35 };
    const r = refs(p).slice(0, 2),
      q = copy(p, 1000, 0, r),
      z = copy(q, 0, 1000, r);
    expect(z.masks).toHaveLength(2);
    expect(z.masks[0].primitives).toHaveLength(7);
    expect(new Set(z.masks[0].primitives.map((q) => q.id)).size).toBe(7);
    expect(z.masks[0].primitives.slice(0, 3)).toEqual(p.masks[0].primitives);
    expect(z.masks[0].primitives[3].points).toEqual([
      { x: 1000, y: 0 },
      { x: 2000, y: 0 },
    ]);
    expect(z.masks[0].primitives[4].native).toEqual({
      kind: 'circle',
      center: { x: 1000, y: 500 },
      radius: 100,
    });
    expect(z.masks[0].primitives[5].points).toEqual([
      { x: 0, y: 1000 },
      { x: 1000, y: 1000 },
    ]);
    expect(z.masks[0].primitives[3].style).toEqual(
      p.masks[0].primitives[0].style,
    );
    expect(z.masks[0].primitives[3].style).not.toBe(
      p.masks[0].primitives[0].style,
    );
    expect(toCsv(z)).toBe(toCsv(p));
    expect(erase(z, [refs(z)[3]]).masks[0].primitives.slice(0, 3)).toEqual(
      p.masks[0].primitives,
    );
  });
  it.each([30, -137])(
    'máscara girada %s°, transladada e escalada 2: vetor global é aplicado uma vez',
    (rotation) => {
      const p = maskManipFixture();
      Object.assign(p.masks[0], {
        rotation,
        scale: 2,
        origin: { x: 100, y: 250 },
      });
      const q = copy(p, 250, -50);
      const original = maskPoint(
        p.masks[0].primitives[0].points[0],
        p.masks[0],
      );
      const result = maskPoint(q.masks[0].primitives[3].points[0], q.masks[0]);
      expect(result.x).toBeCloseTo(original.x + 250, 9);
      expect(result.y).toBeCloseTo(original.y - 50, 9);
      expect(q.masks[0].rotation).toBe(rotation);
      expect(q.masks[0].scale).toBe(2);
      expect(q.masks[0].primitives[4].native?.kind).toBe('circle');
    },
  );
  it('referência DXF sem IDs e texto são copiados localmente sem mudar unidade/origem', () => {
    const p = maskManipFixture();
    p.masks[0] = {
      ...p.masks[0],
      format: 'DXF',
      sourceUnit: 'cm',
      scale: 10,
      primitives: [
        {
          layer: 'CAD',
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
          ],
        },
        {
          layer: 'CAD',
          points: [{ x: 0, y: 20 }],
          text: 'Fôrma',
          textHeight: 5,
          textRotation: 30,
        },
      ],
    };
    const q = copy(p, 1000, 0);
    expect(q.masks[0].primitives[2].points[0]).toEqual({ x: 100, y: 0 });
    expect(q.masks[0].primitives[3]).toMatchObject({
      text: 'Fôrma',
      textHeight: 5,
      textRotation: 30,
      points: [{ x: 100, y: 20 }],
    });
    expect(q.masks[0].sourceUnit).toBe('cm');
    expect(q.masks[0].format).toBe('DXF');
    expect(q.masks[0].primitives.slice(0, 2)).toEqual(p.masks[0].primitives);
    expect(erase(q, refs(q).slice(0, 2)).masks[0].primitives).toHaveLength(2);
  });
  it('linhagem interna é remapeada; linhagem externa é proveniência, sem dependência viva', () => {
    const p = maskManipFixture();
    p.masks[0].primitives[1].sourceEntityId = 'line';
    p.masks[0].primitives[2].sourceEntityId = 'source-file/42';
    const q = copy(p, 100, 0, refs(p));
    expect(q.masks[0].primitives[4].sourceEntityId).toBe(
      q.masks[0].primitives[3].id,
    );
    expect(q.masks[0].primitives[5].sourceEntityId).toBe('source-file/42');
  });
  it('recusa seleção vazia, estrangeira, removida, duplicada e snapshot concorrente', () => {
    const p = maskManipFixture(),
      r = refs(p);
    expect(() => erase(p, [])).toThrow(/Selecione/);
    expect(() => erase(p, [r[0], r[0]])).toThrow(/repetida/);
    expect(() => erase(p, [{ ...r[0], maskId: 'external-mask' }])).toThrow(
      /Seleção/,
    );
    const plan = previewMaskManipulation(
      p,
      p.masks[0].id,
      [r[0]],
      'erase',
      context(p),
    );
    expect(() => applyMaskManipulation({ ...p }, plan, context(p))).toThrow(
      /mudou/,
    );
    expect(() => erase(erase(p, [r[0]]), [r[0]])).toThrow(/Seleção/);
  });
  it.each(['capture', 'editable', 'visible'] as const)(
    'proteção %s não é contornada',
    (field) => {
      let p = maskManipFixture();
      p.masks[0].primitives[0].layerId = p.layers[0].id;
      const r = refs(p).slice(0, 1);
      p = setLayerState(p, 'model', p.layers[0].id, { [field]: false });
      expect(() => erase(p, r)).toThrow();
      expect(() => copy(p, 100, 0, r)).toThrow();
    },
  );
  it('isola desenho e papel; máscara oculta não é desbloqueada', () => {
    const p = maskManipFixture(),
      r = refs(p);
    for (const ctx of [
      { ...context(p), key: 'sheet:x' },
      { ...context(p), scopeDetailId: 'foreign' },
      { ...context(p), detailId: 'foreign' },
    ])
      expect(() =>
        previewMaskManipulation(p, p.masks[0].id, r, 'erase', ctx),
      ).toThrow();
    const hidden = {
      ...p,
      masks: p.masks.map((m) => ({ ...m, visible: false })),
    };
    expect(() => erase(hidden, r)).toThrow(/oculta/);
  });
  it('prévia não aloca IDs nem muda dados; zero é neutro; inválidos e excesso não deixam cópia parcial', () => {
    const p = maskManipFixture(),
      snapshot = JSON.stringify(p);
    const plan = previewMaskManipulation(
      p,
      p.masks[0].id,
      refs(p),
      'copy',
      context(p),
      { kind: 'translate', delta: { x: 100, y: 0 } },
    );
    expect(JSON.stringify(p)).toBe(snapshot);
    expect(plan.result[0].id).toBe('line');
    expect(copy(p, 0, 0)).toBe(p);
    for (const x of [NaN, Infinity, 1e9]) expect(() => copy(p, x, 0)).toThrow();
    const full = {
      ...p,
      masks: [
        {
          ...p.masks[0],
          primitives: Array.from({ length: 100000 }, (_, i) => ({
            ...p.masks[0].primitives[0],
            id: `p${i}`,
          })),
        },
        p.masks[1],
      ],
    };
    expect(() => copy(full, 1, 0, refs(full).slice(0, 1))).toThrow(/100 mil/);
    expect(JSON.stringify(p)).toBe(snapshot);
  });
  it('arco, retângulo, fechamento e texto preservam dados analíticos ao copiar', () => {
    const p = maskManipFixture();
    p.masks[0].primitives[0] = nativePrimitive(
      {
        kind: 'arc',
        center: { x: 0, y: 0 },
        radius: 200,
        startAngle: 40,
        sweepAngle: -80,
      },
      'arc',
    );
    const q = copy(p, 100, 50, refs(p));
    validateNativeMask(q.masks[0]);
    expect(q.masks[0].primitives[3].native).toEqual({
      kind: 'arc',
      center: { x: 100, y: 50 },
      radius: 200,
      startAngle: 40,
      sweepAngle: -80,
    });
    expect(q.masks[0].primitives[5].native?.kind).toBe('rectangle');
    expect(q.masks[0].primitives[5].closed).toBe(true);
  });
  it('arquivo, intercâmbio, PDF/DXF e duas vistas transportam somente os resultados confirmados', () => {
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
    const q = copy(p, 1000, 0),
      z = erase(q, [refs(q)[0]]);
    expect(decodeProject(JSON.stringify(z)).masks).toEqual(z.masks);
    const back = readDetailPackage(
      JSON.stringify(
        createDetailPackage(z, context(z).detailId, {
          producer: { app: 'test', version: '1' },
          unit: 'cm',
        }),
      ),
    ).project;
    expect(back.masks[0].primitives).toEqual(
      z.masks[0].primitives.map((q) => ({
        ...q,
        textHeight: q.textHeight ?? 2.5,
      })),
    );
    const samePoints = (
      a: { x: number; y: number }[],
      b: { x: number; y: number }[],
    ) =>
      a.length === b.length &&
      a.every((q, i) => Math.hypot(q.x - b[i].x, q.y - b[i].y) < 1e-7);
    const copiedLine = [
      { x: 1000, y: 0 },
      { x: 2000, y: 0 },
    ];
    const exported = parseDxf(toDxf(z), 'result.dxf').primitives.filter(
      (q) => !q.text,
    );
    expect(exported.some((q) => samePoints(q.points, copiedLine))).toBe(true);
    expect(
      exported.some((q) =>
        samePoints(q.points, p.masks[0].primitives[0].points),
      ),
    ).toBe(false);
    expect(toPdf(z).length).toBeGreaterThan(100);
    for (const v of z.hierarchy.placements) {
      const a = modelToPaper({ x: 0, y: 0 }, v),
        b = modelToPaper({ x: 1000, y: 0 }, v);
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(1000 / v.scale, 9);
      const view = composeSheet(z, z.sheets[0].id).views.find(
        (view) => view.placement.id === v.id,
      )!;
      expect(
        view.content.some(
          (q) =>
            !q.text &&
            samePoints(
              q.points,
              copiedLine.map((p) => modelToPaper(p, v)),
            ),
        ),
      ).toBe(true);
    }
    expect(
      composeSheet(z, z.sheets[0].id).views.flatMap((v) => v.content).length,
    ).toBeGreaterThan(0);
    expect(z.hierarchy.placements).toBe(p.hierarchy.placements);
    expect(toCsv(z)).toBe(toCsv(p));
  });
});
