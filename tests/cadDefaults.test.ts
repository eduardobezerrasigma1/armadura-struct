import { describe, it, expect } from 'vitest';
import {
  cadDefaults,
  factoryCadDefaults,
  setCadDefaults,
  barCadDefaults,
  annotationCadDefaults,
  styledDrafting,
} from '../src/domain/cadDefaults';
import {
  emptyProject,
  newBar,
  decodeProject,
  schedule,
} from '../src/domain/model';
import { completeOwnership } from '../src/domain/hierarchy';
import {
  executeRebarBatch,
  applyRebarBatch,
  rebarDefinition,
} from '../src/domain/rebarApi';
import { drawingPrimitives } from '../src/domain/drawingPrimitives';
import { physicalBarTextPrimitives } from '../src/domain/drawingPrimitives';
import { createDrawingMask, appendMaskShape } from '../src/domain/maskDrawing';
import {
  layerId,
  LINE_TYPES,
  remapLayer,
  stylePrimitive,
} from '../src/domain/layers';
import {
  createDetailPackage,
  readDetailPackage,
} from '../src/domain/detailPackage';
import { toDxf, toCsv, toPdf } from '../src/lib/exports';
import { composeSheet } from '../src/domain/paper';
import { placeDrawing, updatePlacement } from '../src/domain/sheets';
function configured() {
  let p = completeOwnership({ ...emptyProject(), bars: [newBar('N1')] });
  const c = factoryCadDefaults();
  c.armatures.diameter = 12.5;
  c.armatures.steel = 'CA-60';
  c.armatures.quantity = 4;
  c.armatures.cover = 42;
  c.armatures.bar = {
    commonLine: true,
    layerId: layerId('ARMADURAS'),
    style: { color: '#ff0000' },
  };
  c.lines = { lineType: LINE_TYPES[1], lineScale: 1.3, lineWidth: 0.35 };
  c.texts.identificationHeight = 65;
  c.texts.identification = { commonLine: false, style: { color: '#00ff00' } };
  c.dimensions.autoHeight = 32;
  c.dimensions.height = 77;
  c.texts.height = 88;
  c.texts.align = 'right';
  c.masks.opacity = 0.6;
  c.masks.entity = {
    commonLine: true,
    layerId: layerId('DESENHO'),
    style: { color: '#ff0000' },
  };
  return { p, c };
}
describe('padrões CAD documentais e snapshots de criação', () => {
  it('fábrica preserva alturas/valores anteriores e migrar v21 não reestiliza o desenho', () => {
    const { p } = configured();
    const old = { ...p, schema: 'armadurastruct/21' };
    const q = decodeProject(JSON.stringify(old));
    expect(q.bars).toEqual(p.bars);
    expect(q.cadDefaults).toBeUndefined();
    expect(cadDefaults(q).texts.height).toBe(50);
    expect(cadDefaults(q).texts.identificationHeight).toBe(40);
    expect(cadDefaults(q).armatures.cover).toBe(30);
    expect(drawingPrimitives(q)).toEqual(drawingPrimitives(p));
  });
  it('salvar padrões mantém aço, CSV, atributos existentes e layers; próximos objetos materializam estilo e altura', () => {
    const { p, c } = configured(),
      before = JSON.stringify(p),
      q = setCadDefaults(p, c);
    expect(toCsv(q)).toBe(toCsv(p));
    expect(q.bars).toBe(p.bars);
    expect(q.layers).toBe(p.layers);
    const b = barCadDefaults(q, newBar('N2'), true);
    expect(b.steel).toBe('CA-60');
    expect(b.style?.color).toBe('#ff0000');
    expect(b.style?.lineType).toEqual(LINE_TYPES[1]);
    expect(b.style?.lineType).not.toBe(q.cadDefaults!.lines.lineType);
    expect(b.drafting?.height).toBe(65);
    expect(b.drafting?.distributionHeight).toBe(88);
    expect(JSON.stringify(p)).toBe(before);
    const texts = physicalBarTextPrimitives(b, q);
    expect(texts[0].textHeight).toBe(65);
    expect(texts[0].textAlign).toBe('right');
    expect(styledDrafting(q, b, texts[0]).resolvedStyle?.color).toBe('#00ff00');
  });
  it('API, cópia e edição preservam snapshots, sem reinterpretação por novos padrões', () => {
    const { p, c } = configured(),
      q = setCadDefaults(p, c);
    const batch = executeRebarBatch(
      q,
      [
        {
          type: 'bar.create',
          detailId: q.hierarchy.details[0].id,
          definition: rebarDefinition(newBar('N2')),
        },
      ],
      { units: 'mm' },
    );
    const created = applyRebarBatch(q, batch);
    const repBatch = executeRebarBatch(
      created,
      [
        {
          type: 'representation.create',
          barId: created.bars[1].id,
          origin: { x: 2000, y: 0 },
        },
      ],
      { units: 'mm' },
    );
    const withRep = applyRebarBatch(created, repBatch);
    expect(withRep.details[0].drafting?.height).toBe(65);
    expect(
      decodeProject(JSON.stringify(withRep)).details[0].drafting?.height,
    ).toBe(65);
    const bar = created.bars[1];
    expect(bar.drafting?.height).toBe(65);
    const changed = structuredClone(c);
    changed.texts.identificationHeight = 99;
    const later = setCadDefaults(created, changed);
    expect(later.bars[1]).toEqual(bar);
    expect(decodeProject(JSON.stringify(later))).toEqual(later);
  });
  it('salvar somente um parâmetro não altera a aparência de fábrica em novos objetos', () => {
    const p = emptyProject(),
      b = newBar('N1'),
      c = factoryCadDefaults();
    c.armatures.cover = 42;
    const q = setCadDefaults(p, c),
      next = barCadDefaults(q, b, true),
      item = physicalBarTextPrimitives(b, p)[0];
    expect(
      styledDrafting(q, next, item, 'ARMADURAS').resolvedStyle?.color,
    ).toBe(stylePrimitive(p, b, item, 'ARMADURAS').resolvedStyle?.color);
  });
  it('layer configurado vale na UI e API sem sobrepor um layer explicitamente informado', () => {
    const { p, c } = configured();
    c.armatures.bar.layerId = layerId('DESENHO');
    const q = setCadDefaults(p, c);
    expect(barCadDefaults(q, newBar('N2'), true).layerId).toBe(
      layerId('DESENHO'),
    );
    const result = executeRebarBatch(
      q,
      [
        {
          type: 'bar.create',
          detailId: q.hierarchy.details[0].id,
          definition: { ...rebarDefinition(newBar('N2')), layerId: undefined },
        },
      ],
      { units: 'mm' },
    );
    expect(applyRebarBatch(q, result).bars[1].layerId).toBe(layerId('DESENHO'));
  });
  it('novas anotações e cotas usam alturas/alinhamento próprios', () => {
    const { p, c } = configured(),
      q = setCadDefaults(p, c);
    const a = {
      id: 'a',
      kind: 'leader' as const,
      points: [
        { x: 0, y: 0 },
        { x: 1000, y: 1000 },
        { x: 2000, y: 1000 },
      ],
      label: 'Chamada',
      textHeight: 50,
      color: '#7c91b7',
    };
    expect(annotationCadDefaults(q, a).textHeight).toBe(88);
    expect(
      annotationCadDefaults(q, { ...a, kind: 'dimension-aligned' }).textHeight,
    ).toBe(77);
    expect(a.textHeight).toBe(50);
  });
  it('máscara inteira e entidade têm padrões separados; importadas não são reestilizadas', () => {
    const { p, c } = configured(),
      q = setCadDefaults(p, c),
      owner = q.hierarchy.details[0].id,
      ctx = { key: 'model', detailId: owner };
    const created = createDrawingMask(q, 'Nova', owner, ctx);
    expect(created.mask.opacity).toBe(0.6);
    const drawn = appendMaskShape(
      created.project,
      created.mask.id,
      'line',
      [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
      ],
      ctx,
      created.mask,
    );
    expect(drawn.masks[0].primitives[0].style?.lineType).toEqual(LINE_TYPES[1]);
    expect(schedule(drawn)).toEqual(schedule(q));
  });
  it.each(['mm', 'cm', 'm'] as const)(
    'pacote em %s preserva alturas, estilos e remapeamento; padrões globais do produtor não viajam',
    (unit) => {
      const { p, c } = configured(),
        q = setCadDefaults(p, c),
        bar = barCadDefaults(q, newBar('N2'), true),
        r = completeOwnership({ ...q, bars: [bar] });
      const pack = createDetailPackage(r, r.hierarchy.details[0].id, {
        producer: { app: 'test', version: '1' },
        unit,
      });
      expect(pack.schema).toBe('openstruct.detail/16');
      const restored = readDetailPackage(pack).project;
      expect(restored.cadDefaults).toBeUndefined();
      expect(restored.bars[0].drafting?.height).toBeCloseTo(65, 7);
      expect(restored.bars[0].drafting?.distributionHeight).toBeCloseTo(88, 7);
      expect(restored.bars[0].style?.lineType?.pattern[0]).toBeCloseTo(100, 7);
      const mapped = remapLayer(bar, new Map([[layerId('ARMADURAS'), 'dest']]));
      expect(mapped.layerId).toBe('dest');
      expect(() =>
        readDetailPackage({ ...pack, schema: 'openstruct.detail/12' }),
      ).toThrow(/v13/);
    },
  );
  it('valida números/cores/tipos e layers; origem inválida/versionamento não descarta atributos', () => {
    const { p, c } = configured();
    for (const field of [NaN, 0, -1]) {
      const invalid = structuredClone(c);
      invalid.texts.height = field;
      expect(() => setCadDefaults(p, invalid)).toThrow();
    }
    const bad = structuredClone(c);
    bad.armatures.bar.layerId = 'missing';
    expect(() => setCadDefaults(p, bad)).toThrow(/Layer/);
    expect(() =>
      decodeProject(
        JSON.stringify({
          ...setCadDefaults(p, c),
          schema: 'armadurastruct/21',
        }),
      ),
    ).toThrow(/22/);
    expect(() =>
      decodeProject(JSON.stringify({ ...p, schema: 'armadurastruct/99' })),
    ).toThrow();
  });
  it('customização ByLayer e tipo importado persistem; cores/tipos saem nos exportadores sem afetar pesos', () => {
    const { p, c } = configured();
    c.lines.lineType = { name: 'CUSTOM', pattern: [15, -8, 0, -3] };
    const q = setCadDefaults(p, c),
      b = barCadDefaults(q, newBar('N2'), true),
      drawn = completeOwnership({ ...q, bars: [b] });
    expect(toDxf(drawn)).toContain('CUSTOM');
    expect(toPdf(drawn).length).toBeGreaterThan(100);
    const later = setCadDefaults(drawn, factoryCadDefaults());
    expect(toCsv(later)).toBe(toCsv(drawn));
    expect(later.bars[0].style?.lineType?.name).toBe('CUSTOM');
    expect(
      decodeProject(JSON.stringify(later)).bars[0].style?.lineType?.name,
    ).toBe('CUSTOM');
  });
  it('prancha preserva altura de papel por vista, sem duplicar quantitativos ou aplicar zoom', () => {
    const { p, c } = configured(),
      q = setCadDefaults(p, c),
      b = barCadDefaults(q, newBar('N2'), true),
      r = completeOwnership({ ...q, bars: [b] });
    const placed = placeDrawing(
      r,
      r.sheets[0].id,
      r.hierarchy.drawings[0].id,
    ).project;
    const sheet = composeSheet(placed, placed.sheets[0].id);
    expect(sheet.views[0].content.some((l) => l.text)).toBe(true);
    expect(schedule(placed)).toEqual(schedule(r));
    for (const scale of [50, 100]) {
      const paper = updatePlacement(placed, placed.hierarchy.placements[0].id, {
        scale,
        textHeight: 2.5,
      });
      const texts = composeSheet(
        paper,
        paper.sheets[0].id,
      ).views[0].content.filter((l) => l.text);
      expect(texts.every((t) => Math.abs(t.textHeight! - 2.5) < 1e-8)).toBe(
        true,
      );
    }
  });
});
