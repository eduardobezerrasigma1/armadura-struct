import { describe, expect, it } from 'vitest';
import DxfParser from 'dxf-parser';
import { dxfStyleTables } from '../src/cad/layerStyles';
import { parseDxf } from '../src/cad/import';
import {
  emptyProject,
  newBar,
  decodeProject,
  schedule,
  createScheduleLock,
  scheduleChanged,
} from '../src/domain/model';
import { completeOwnership } from '../src/domain/hierarchy';
import {
  editLayerPlotStyles,
  editLayers,
  resolveStyle,
  mergePlotStyle,
} from '../src/domain/layers';
import {
  plotPrimitives,
  setPlotSettings,
  PLOT_LINE_TYPES,
} from '../src/domain/plotting';
import { drawingPrimitives } from '../src/domain/drawingPrimitives';
import { toDxf, toPdf, toSheetPdf } from '../src/lib/exports';
import {
  placeDrawing,
  updatePlacement,
  duplicatePlacement,
} from '../src/domain/sheets';
import { alignPlacement, composeSheet } from '../src/domain/paper';
import {
  createDetailPackage,
  readDetailPackage,
} from '../src/domain/detailPackage';
import { executeRebarBatch } from '../src/domain/rebarApi';
import { fabricationSignature } from '../src/domain/fabrication';
import { cloneArmatureGraph } from '../src/domain/editing';
import { setLayerState, assertLayerEdit } from '../src/domain/layerProfiles';
import type { Project } from '../src/domain/types';

const steel = 'layer:ARMADURAS';
function fixture() {
  return completeOwnership({
    ...emptyProject(),
    name: 'Plotagem',
    bars: [
      {
        ...newBar('N1'),
        id: 'a',
        points: [
          { x: 0, y: 0 },
          { x: 1000, y: 0 },
        ],
        quantity: 8,
      },
    ],
  });
}
const mass = (p: Project) => schedule(p).reduce((n, r) => n + r.weight, 0);
const ink = (p: Project) =>
  drawingPrimitives(p).find((l) => !l.text && l.role === 'ARMADURAS')!;
const print = (p: Project) => plotPrimitives(p, [ink(p)])[0]?.resolvedStyle;
const pdfRaw = (v: Uint8Array) => new TextDecoder('latin1').decode(v);
const pens = (pdf: string) =>
  [...pdf.matchAll(/^([\d.]+) w$/gm)].map((m) => (Number(m[1]) * 25.4) / 72);
const dashes = (pdf: string) =>
  [...pdf.matchAll(/\[([\d. ]+)\] [\d.]+ d/g)].map((m) =>
    m[1]
      .trim()
      .split(/\s+/)
      .map((n) => (Number(n) * 25.4) / 72),
  );

describe('AS-21 · aparência de tela e plotagem', () => {
  it('barra azul imprime preta com 0,35 mm; herança, overrides e RA permanecem independentes', () => {
    const p = fixture();
    p.scheduleLock = createScheduleLock(p);
    let q = editLayerPlotStyles(p, [steel], {
      color: '#000000',
      lineWidth: 0.35,
      lineType: PLOT_LINE_TYPES[1],
    });
    expect(resolveStyle(q, q.bars[0], 'ARMADURAS').color).toBe('#4a88ff');
    expect(print(q)).toMatchObject({
      color: '#000000',
      lineWidth: 0.35,
      lineType: { pattern: [2, -1] },
    });
    q = {
      ...q,
      bars: q.bars.map((b) => ({
        ...b,
        plot: { color: '#ff0000', lineWidth: 0.5 },
      })),
    };
    expect(print(q)).toMatchObject({ color: '#ff0000', lineWidth: 0.5 });
    expect(scheduleChanged(q)).toBe(false);
    expect(mass(q)).toBe(mass(p));
    expect(fabricationSignature(q.bars[0])).toBe(
      fabricationSignature(p.bars[0]),
    );
    expect(decodeProject(JSON.stringify(q))).toEqual(q);
  });
  it('restaurar herança não deixa valores undefined invalidarem o resolvedor ou outra propriedade em lote', () => {
    let p = editLayerPlotStyles(fixture(), [steel], {
      color: '#123456',
      lineWidth: 0.35,
    });
    p = editLayerPlotStyles(p, ['layer:COTAS'], {
      color: '#abcdef',
      lineWidth: 0.18,
    });
    p = editLayerPlotStyles(p, [steel, 'layer:COTAS'], {
      lineType: PLOT_LINE_TYPES[1],
      color: undefined,
    });
    expect(p.layers.find((l) => l.id === steel)?.plot).toEqual({
      lineWidth: 0.35,
      lineType: PLOT_LINE_TYPES[1],
    });
    expect(p.layers.find((l) => l.id === 'layer:COTAS')?.plot?.lineWidth).toBe(
      0.18,
    );
    expect(
      mergePlotStyle(
        { color: '#ffffff', include: false },
        { color: undefined },
      ),
    ).toEqual({ include: false });
    expect(print(p)?.color).toBe('#4a88ff');
    expect(
      print(editLayerPlotStyles(p, [steel], {}, true))?.lineType.pattern,
    ).toEqual([]);
  });
  it.each(['color', 'monochrome', 'grayscale'] as const)(
    'preset %s usa o mesmo estilo para tela de prévia, PDF e DXF sem alterar o CAD',
    (preset) => {
      const p = fixture();
      const q = setPlotSettings(p, { preset, referenceScale: 50 });
      const expected =
        preset === 'color'
          ? '#4a88ff'
          : preset === 'monochrome'
            ? '#000000'
            : '#838383';
      expect(print(q)?.color).toBe(expected);
      const parsed = dxfStyleTables(toDxf(q));
      expect(parsed.layers.ARMADURAS.trueColor).toBe(
        parseInt(expected.slice(1), 16),
      );
      expect(ink(q).resolvedStyle?.color).toBe('#4a88ff');
      expect(mass(q)).toBe(mass(p));
    },
  );
  it('padrões de tela herdados usam referência 1:50 sem modificar o catálogo CAD', () => {
    const p = editLayers(fixture(), [steel], {
      lineType: { name: 'DASHED', pattern: [100, -50] },
      lineScale: 2,
    });
    expect(print(p)).toMatchObject({
      lineType: { pattern: [2, -1] },
      lineScale: 2,
    });
    expect(ink(p).resolvedStyle?.lineType.pattern).toEqual([100, -50]);
  });
  it('preenchimentos e branco explícito são preservados pelos presets e pelo HATCH vetorial', () => {
    let p = fixture();
    p = completeOwnership({
      ...p,
      polylines: [
        {
          id: 'form',
          layerId: 'layer:DESENHO',
          color: '#00ff00',
          points: [
            { x: 0, y: -500 },
            { x: 500, y: -500 },
            { x: 500, y: -800 },
          ],
          closed: true,
          style: { fill: 'solid' },
          plot: { color: '#ff0000', fillColor: '#ffffff' },
        },
      ],
    });
    p = setPlotSettings(p, { preset: 'monochrome', referenceScale: 50 });
    const line = plotPrimitives(p, drawingPrimitives(p)).find(
      (l) => l.layerId === 'layer:DESENHO',
    )!;
    expect(line.resolvedStyle).toMatchObject({
      color: '#000000',
      fillColor: '#ffffff',
      fill: 'solid',
    });
    const dxf = new DxfParser().parseSync(toDxf(p))!;
    expect(dxfStyleTables(toDxf(p)).hatches[0]?.trueColor).toBe(0xffffff);
  });
  it('não imprimir layer ou objeto exclui entidades dos dois exportadores, sem retirar aço do quadro', () => {
    const p = fixture();
    const q = editLayerPlotStyles(p, [steel], { include: false });
    q.bars = q.bars.map((b) => ({ ...b, plot: { include: true } }));
    expect(print(q)).toBeUndefined();
    expect(drawingPrimitives(q).length).toBeGreaterThan(0);
    const dxf = new DxfParser().parseSync(toDxf(q))!;
    expect(dxf.entities.some((e) => e.layer === 'ARMADURAS')).toBe(false);
    expect(
      dxf.entities.some((e) => e.type === 'TEXT' && e.layer === 'QUADRO_ACO'),
    ).toBe(true);
    expect(pdfRaw(toPdf(q))).toContain('Quadro de a');
    const noRA = editLayerPlotStyles(q, ['layer:QUADRO_ACO'], {
      include: false,
    });
    expect(new DxfParser().parseSync(toDxf(noRA))!.entities).toEqual([]);
    expect(pdfRaw(toPdf(noRA))).not.toContain('Quadro de a');
    expect(mass(noRA)).toBe(mass(p));
    const own = {
      ...p,
      bars: p.bars.map((b) => ({ ...b, plot: { include: false } })),
    };
    expect(print(own)).toBeUndefined();
  });
  it('duas vistas 1:25 e 1:100 mantêm pena e tracejado em papel, com comprimentos 40 e 10 mm', () => {
    let p = editLayerPlotStyles(fixture(), [steel], {
      color: '#000000',
      lineWidth: 0.35,
      lineType: PLOT_LINE_TYPES[1],
    });
    const a = placeDrawing(p, p.sheets[0].id, p.hierarchy.drawings[0].id);
    p = updatePlacement(a.project, a.id, {
      scale: 25,
      origin: { x: 25, y: 70 },
      frame: { width: 150, height: 100 },
    });
    p = alignPlacement(p, a.id);
    const b = duplicatePlacement(p, a.id);
    p = alignPlacement(
      updatePlacement(b.project, b.id, {
        scale: 100,
        origin: { x: 230, y: 70 },
      }),
      b.id,
    );
    const page = composeSheet(p, p.sheets[0].id);
    expect(page.issues).toEqual([]);
    const lengths = page.views.map((v) => {
      const line = v.content.find((l) => l.role === 'ARMADURAS' && !l.text)!;
      expect(line.resolvedStyle).toMatchObject({
        color: '#000000',
        lineWidth: 0.35,
        lineType: { pattern: [2, -1] },
      });
      return Math.hypot(
        line.points[1].x - line.points[0].x,
        line.points[1].y - line.points[0].y,
      );
    });
    expect(lengths[0]).toBeCloseTo(40);
    expect(lengths[1]).toBeCloseTo(10);
    const pdf = pdfRaw(toSheetPdf(p));
    expect(
      pens(pdf).filter((n) => Math.abs(n - 0.35) < 1e-7).length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      dashes(pdf).filter(
        (v) => Math.abs(v[0] - 2) < 1e-7 && Math.abs(v[1] - 1) < 1e-7,
      ).length,
    ).toBeGreaterThanOrEqual(2);
    expect(mass(p)).toBe(mass(fixture()));
    p = editLayerPlotStyles(p, [steel], { include: false });
    expect(
      composeSheet(p, p.sheets[0].id).views.every(
        (v) => !v.content.some((l) => l.layerId === steel),
      ),
    ).toBe(true);
  });
  it.each([25, 100])(
    'DXF em 1:%s usa o padrão em mm de modelo e preserva geometria e pena',
    (referenceScale) => {
      let p = editLayerPlotStyles(fixture(), [steel], {
        color: '#000000',
        lineWidth: 0.35,
        lineType: PLOT_LINE_TYPES[1],
      });
      p = setPlotSettings(p, { preset: 'color', referenceScale });
      const dxf = new DxfParser().parseSync(toDxf(p))!;
      const tables = dxfStyleTables(toDxf(p));
      const l = tables.layers.ARMADURAS;
      const type = tables.types[String(l.lineType)];
      expect(type.pattern).toEqual([2 * referenceScale, -referenceScale]);
      const bar = dxf.entities.find(
        (e) => e.layer === 'ARMADURAS' && e.type === 'LWPOLYLINE',
      )!;
      expect(
        (bar as unknown as { vertices: { x: number; y: number }[] }).vertices,
      ).toMatchObject([
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
      ]);
      expect(toDxf(p)).toContain('370\r\n35\r\n');
      const pdf = pdfRaw(
        toPdf({ ...p, drawing: { ...p.drawing, scale: referenceScale } }),
      );
      expect(pens(pdf).some((n) => Math.abs(n - 0.35) < 0.01)).toBe(true);
      expect(
        dashes(pdf).some(
          (v) => Math.abs(v[0] - 2) < 0.01 && Math.abs(v[1] - 1) < 0.01,
        ),
      ).toBe(true);
    },
  );
  it.each(['mm', 'cm', 'm'] as const)(
    'pacote v9 em %s converte o modelo, mantém mm de papel e remapeia impressão sem duplicar aço',
    (unit) => {
      let p = editLayerPlotStyles(fixture(), [steel], {
        lineType: PLOT_LINE_TYPES[1],
        lineWidth: 0.35,
      });
      p = {
        ...p,
        bars: p.bars.map((b) => ({
          ...b,
          plot: { color: '#000000', lineType: PLOT_LINE_TYPES[3] },
        })),
      };
      const pack = createDetailPackage(p, p.hierarchy.details[0].id, {
        producer: { app: 'AS21', version: '1' },
        unit,
      });
      const q = readDetailPackage(pack).project;
      expect(pack.schema).toBe('openstruct.detail/15');
      expect(q.bars[0].points).toEqual(p.bars[0].points);
      expect(q.bars[0].plot).toEqual(p.bars[0].plot);
      expect(q.layers.find((l) => l.id === steel)?.plot).toEqual(
        p.layers.find((l) => l.id === steel)?.plot,
      );
      expect(mass(q)).toBe(mass(p));
      expect(() =>
        readDetailPackage({ ...pack, schema: 'openstruct.detail/8' }),
      ).toThrow(/v9/);
    },
  );
  it.each([1, 2, 14, 15])(
    'migração v%s mantém IDs, aço e aparência, sem inventar overrides de plotagem',
    (v) => {
      const p = fixture();
      const q = decodeProject(
        JSON.stringify({ ...p, schema: `armadurastruct/${v}` }),
      );
      expect(q.schema).toBe('armadurastruct/24');
      expect(q.bars[0].id).toBe('a');
      expect(q.bars[0].points).toEqual(p.bars[0].points);
      expect(q.bars[0].plot).toBeUndefined();
      expect(ink(q).resolvedStyle?.color).toBe(ink(p).resolvedStyle?.color);
      expect(mass(q)).toBe(mass(p));
    },
  );
  it('API valida overrides atomically e clone conserva somente apresentação da cópia', () => {
    const p = fixture();
    const failed = executeRebarBatch(
      p,
      [
        {
          type: 'bar.update',
          id: 'a',
          patch: { kind: 'free', plot: { color: '#000000' } },
        },
        {
          type: 'bar.update',
          id: 'a',
          patch: { kind: 'free', plot: { lineWidth: -1 } },
        },
      ],
      { units: 'mm' },
    );
    expect(failed.ok).toBe(false);
    expect(failed.project).toBe(p);
    const ok = executeRebarBatch(
      p,
      [
        {
          type: 'bar.update',
          id: 'a',
          patch: { kind: 'free', plot: { color: '#000000' } },
        },
      ],
      { units: 'mm' },
    );
    expect(ok.ok).toBe(true);
    expect(print(ok.project)?.color).toBe('#000000');
    const cloned = cloneArmatureGraph(ok.project, {
      barIds: ['a'],
      delta: { x: 2000, y: 0 },
    }).project;
    expect(cloned.bars[1].plot).toEqual({ color: '#000000' });
    expect(cloned.bars[1].id).not.toBe('a');
    expect(cloned.bars[1].plot).not.toBe(cloned.bars[0].plot);
    expect(mass(cloned)).toBeCloseTo(mass(p) * 2);
    const locked = setLayerState(ok.project, 'model', steel, {
      editable: false,
    });
    expect(() =>
      assertLayerEdit(
        locked,
        editLayerPlotStyles(locked, [steel], { color: '#ff0000' }),
        'model',
      ),
    ).toThrow();
  });
  it('representações aceitam overrides pela API, conservam transformações e nunca multiplicam aço', () => {
    const p = fixture();
    const result = executeRebarBatch(
      p,
      [
        {
          type: 'representation.create',
          id: 'r',
          barId: 'a',
          origin: { x: 0, y: -1500 },
          scale: 2,
          rotation: 90,
          plot: { color: '#112233', lineWidth: 0.5 },
        },
        {
          type: 'representation.update',
          id: 'r',
          plot: {
            color: '#445566',
            lineWidth: 0.7,
            lineType: PLOT_LINE_TYPES[1],
          },
        },
      ],
      { units: 'mm' },
    );
    expect(result.ok).toBe(true);
    const q = result.project;
    expect(q.details[0].plot).toEqual({
      color: '#445566',
      lineWidth: 0.7,
      lineType: PLOT_LINE_TYPES[1],
    });
    const repr = plotPrimitives(q, drawingPrimitives(q)).find(
      (l) => l.role === 'REBATIMENTOS' && !l.text,
    )!;
    expect(repr.resolvedStyle).toMatchObject({
      color: '#445566',
      lineWidth: 0.7,
      lineType: { pattern: [2, -1] },
    });
    expect(mass(q)).toBe(mass(p));
    expect(decodeProject(JSON.stringify(q)).details[0]).toEqual(q.details[0]);
    const cloned = cloneArmatureGraph(q, {
      barIds: ['a'],
      delta: { x: 2500, y: 0 },
    }).project;
    expect(cloned.details[1].plot).toEqual(q.details[0].plot);
    expect(cloned.details[1].barId).not.toBe('a');
  });
  it('referências CAD e estilos das suas entidades preservam overrides e exclusão de impressão', () => {
    const mask = parseDxf(toDxf(fixture()), 'referencia.dxf');
    let p = completeOwnership({
      ...emptyProject(),
      masks: [{ ...mask, plot: { color: '#000000', lineWidth: 0.18 } }],
    });
    expect(
      plotPrimitives(p, drawingPrimitives(p)).every(
        (l) => l.resolvedStyle?.color === '#000000',
      ),
    ).toBe(true);
    expect(decodeProject(JSON.stringify(p)).masks[0].plot).toEqual(
      p.masks[0].plot,
    );
    p = {
      ...p,
      masks: p.masks.map((m) => ({ ...m, plot: { include: false } })),
    };
    expect(drawingPrimitives(p).length).toBeGreaterThan(0);
    expect(plotPrimitives(p, drawingPrimitives(p))).toEqual([]);
    expect(schedule(p)).toEqual([]);
  });
  it('recusa cor, largura, padrão e versão inválidos sem mutação; defaults herdados preservam a hierarquia visual', () => {
    const p = fixture(),
      original = JSON.stringify(p);
    for (const plot of [
      { color: 'red' },
      { lineWidth: -1 },
      { lineScale: 0 },
      { lineType: { name: 'bad', pattern: [2, 1] } },
    ]) {
      expect(() => editLayerPlotStyles(p, [steel], plot as never)).toThrow();
      expect(() =>
        decodeProject(
          JSON.stringify({ ...p, bars: p.bars.map((b) => ({ ...b, plot })) }),
        ),
      ).toThrow();
    }
    expect(() =>
      setPlotSettings(p, { preset: 'invalid', referenceScale: 0 } as never),
    ).toThrow();
    expect(() =>
      decodeProject(
        JSON.stringify({
          ...editLayerPlotStyles(p, [steel], { color: '#000000' }),
          schema: 'armadurastruct/15',
        }),
      ),
    ).toThrow(/16/);
    expect(JSON.stringify(p)).toBe(original);
    const styles = p.layers.map(
      (l) =>
        plotPrimitives(p, [{ layer: l.name, layerId: l.id, points: [] }])[0]
          .resolvedStyle!,
    );
    expect(styles[0].lineWidth).toBe(0.35);
    expect(styles[1].lineWidth).toBe(0.25);
    expect(styles[2].lineWidth).toBe(0.18);
  });
});
