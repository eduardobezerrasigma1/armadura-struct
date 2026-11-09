import { describe, expect, it } from 'vitest';
import {
  emptyProject,
  newBar,
  decodeProject,
  schedule,
  createScheduleLock,
  scheduleChanged,
} from '../src/domain/model';
import {
  completeOwnership,
  createHierarchyNode,
} from '../src/domain/hierarchy';
import {
  assignLayer,
  createLayer,
  editLayers,
  removeLayer,
  layerUsage,
  resolveStyle,
  LINE_TYPES,
  validateLayers,
} from '../src/domain/layers';
import { drawingPrimitives } from '../src/domain/drawingPrimitives';
import { toDxf, toPdf } from '../src/lib/exports';
import { parseDxf, normalizeCad, maskPrimitives } from '../src/cad/import';
import { dxfStyleTables } from '../src/cad/layerStyles';
import {
  createDetailPackage,
  readDetailPackage,
} from '../src/domain/detailPackage';
import {
  previewDetailTransfer,
  applyDetailTransfer,
} from '../src/domain/detailTransfer';
import { executeRebarBatch, applyRebarBatch } from '../src/api';
import {
  groupFabrication,
  fabricationSignature,
} from '../src/domain/fabrication';
import { assertDetailEdit } from '../src/domain/detailEditing';
import { cloneArmatureGraph } from '../src/domain/editing';
import type { Project } from '../src/domain/types';
function fixture() {
  let p = emptyProject();
  p = completeOwnership({
    ...p,
    bars: [
      { ...newBar('N1'), id: 'a', quantity: 4 },
      { ...newBar('N2'), id: 'b', origin: { x: 2000, y: 0 }, quantity: 3 },
    ],
    polylines: [
      {
        id: 'poly',
        points: [
          { x: 0, y: -200 },
          { x: 500, y: -200 },
          { x: 500, y: -600 },
          { x: 0, y: -600 },
        ],
        closed: true,
        color: '#777777',
      },
    ],
    annotations: [
      {
        id: 'call',
        barId: 'a',
        kind: 'leader',
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
          { x: 500, y: 100 },
        ],
        label: '',
        textHeight: 40,
        color: '#777777',
      },
    ],
    details: [
      {
        id: 'r',
        barId: 'a',
        origin: { x: 0, y: -1000 },
        rotation: 90,
        scale: 2,
      },
    ],
  });
  const made = createLayer(p, 'Vigas · aço');
  return {
    p: assignLayer(made.project, ['a', 'b', 'poly', 'call', 'r'], made.id),
    id: made.id,
  };
}
const mass = (p: Project) =>
  schedule({ ...p, scheduleLock: undefined }).reduce((s, r) => s + r.weight, 0);
describe('AS-19 · layers nativos e estilos', () => {
  it('edita herança e conserva overrides, IDs, geometria, quantitativos e posições de fabricação', () => {
    const { p, id } = fixture();
    const original = JSON.stringify(p);
    let q = assignLayer(p, ['b'], id, { color: '#ff0000', lineWidth: 0.7 });
    q = groupFabrication(q, ['a', 'b'], 'a');
    q.scheduleLock = createScheduleLock(q);
    const next = editLayers(q, [id], {
      color: '#123456',
      lineType: LINE_TYPES[1],
      lineWidth: 0.5,
      lineScale: 2,
    });
    expect(JSON.stringify(p)).toBe(original);
    expect(resolveStyle(next, next.bars[0], 'ARMADURAS')).toMatchObject({
      color: '#123456',
      lineWidth: 0.5,
      lineScale: 2,
    });
    expect(resolveStyle(next, next.bars[1], 'ARMADURAS')).toMatchObject({
      color: '#ff0000',
      lineWidth: 0.7,
      lineScale: 2,
    });
    expect(next.bars).toEqual(q.bars);
    expect(next.fabricationPositions).toEqual(q.fabricationPositions);
    expect(fabricationSignature(next.bars[0])).toBe(
      fabricationSignature(p.bars[0]),
    );
    expect(mass(next)).toBe(mass(p));
    expect(scheduleChanged(next)).toBe(false);
    const ink = drawingPrimitives(next);
    expect(
      ink
        .filter((l) => l.layerId === id)
        .every((l) => l.resolvedStyle?.lineType.name === 'DASHED'),
    ).toBe(true);
    expect(ink.some((l) => l.resolvedStyle?.color === '#ff0000')).toBe(true);
  });
  it('renomeia em uso, edita vários layers numa transação e filtra uso sem confundir pavimentos', () => {
    const { p, id } = fixture();
    const made = createLayer(p, 'Sem uso');
    const q = editLayers(made.project, [id, made.id], { color: '#abcdef' });
    expect(layerUsage(q).get(id)?.size).toBe(5);
    expect(layerUsage(q).get(made.id)?.size).toBe(0);
    const renamed = editLayers(q, [id], { name: 'Vigas revisadas' });
    expect(renamed.bars).toEqual(p.bars);
    expect(renamed.hierarchy.floors).toEqual(p.hierarchy.floors);
    expect(
      drawingPrimitives(renamed)
        .filter((l) => l.layerId === id)
        .every((l) => l.layer === 'Vigas revisadas'),
    ).toBe(true);
    expect(() =>
      editLayers(p, [id, p.layers[0].id], { name: 'Mesmo nome' }),
    ).toThrow();
    expect(() => createLayer(p, 'vigas · AÇO')).toThrow();
  });
  it('excluir layer em uso exige reassociação e não remove qualquer objeto físico ou gráfico', () => {
    const { p, id } = fixture();
    expect(() => removeLayer(p, id)).toThrow(/reassociação/);
    const q = removeLayer(p, id, 'layer:DESENHO');
    expect(q.layers.some((l) => l.id === id)).toBe(false);
    expect(q.bars.map((b) => b.layerId)).toEqual([
      'layer:DESENHO',
      'layer:DESENHO',
    ]);
    expect(q.bars.map((b) => b.id)).toEqual(['a', 'b']);
    expect(q.details).toHaveLength(1);
    expect(mass(q)).toBe(mass(p));
    expect(decodeProject(JSON.stringify(q))).toEqual(q);
    const unused = createLayer(q, 'Descartável');
    expect(removeLayer(unused.project, unused.id).layers).toEqual(q.layers);
  });
  it('a migração v1/v2/v13 preserva cores explícitas, coordenadas, IDs, distribuições e quadro de aço', () => {
    const { p } = fixture();
    const legacy = structuredClone(p);
    legacy.bars.forEach((b) => {
      delete b.layerId;
      delete b.style;
      b.color = '#d12345';
    });
    legacy.polylines.forEach((b) => delete b.layerId);
    legacy.annotations.forEach((b) => delete b.layerId);
    legacy.details.forEach((b) => delete b.layerId);
    for (const schema of [
      'armadurastruct/1',
      'armadurastruct/2',
      'armadurastruct/13',
    ]) {
      const q = decodeProject(
        JSON.stringify({
          ...legacy,
          schema,
          layers: undefined,
          details: schema.endsWith('/13') ? legacy.details : [],
        }),
      );
      expect(q.schema).toBe('armadurastruct/25');
      expect(q.bars[0].id).toBe('a');
      expect(q.bars[0].points).toEqual(p.bars[0].points);
      expect(resolveStyle(q, q.bars[0], 'ARMADURAS').color).toBe('#d12345');
      expect(mass(q)).toBe(mass(p));
      expect(decodeProject(JSON.stringify(q))).toEqual(q);
    }
  });
  it('recusa vínculos órfãos, estilos inválidos, catálogo ausente e nomes duplicados sem alterar o projeto', () => {
    const { p, id } = fixture(),
      before = JSON.stringify(p);
    for (const patch of [
      { lineScale: 0 },
      { lineWidth: -1 },
      { name: 'bad\nname' },
      { color: 'red' },
    ])
      expect(() => editLayers(p, [id], patch as never)).toThrow();
    expect(() =>
      decodeProject(JSON.stringify({ ...p, layers: undefined })),
    ).toThrow(/catálogo/);
    expect(() =>
      decodeProject(
        JSON.stringify({ ...p, layers: p.layers.filter((l) => l.id !== id) }),
      ),
    ).toThrow(/Layer inexistente/);
    expect(JSON.stringify(p)).toBe(before);
    const result = executeRebarBatch(
      p,
      [
        {
          type: 'bar.update',
          id: 'a',
          patch: { kind: 'free', layerId: 'missing' },
        },
      ],
      { units: 'mm' },
    );
    expect(result.ok).toBe(false);
    expect(result.project).toBe(p);
  });
  it.each(['mm', 'cm', 'm'] as const)(
    'pacotes v8 em %s preservam estilos, unidades, IDs e vínculos na importação seletiva',
    (unit) => {
      const { p, id } = fixture();
      const q = editLayers(p, [id], {
        lineType: LINE_TYPES[3],
        lineScale: 2,
        lineWidth: 0.35,
      });
      q.bars[1].style = { lineType: LINE_TYPES[1] };
      const pack = createDetailPackage(q, q.hierarchy.details[0].id, {
        unit,
        producer: { app: 'AS19', version: '1' },
      });
      expect(pack.schema).toBe('openstruct.detail/16');
      const source = readDetailPackage(pack).project;
      expect(source.layers).toEqual(q.layers);
      expect(source.bars[1].style).toEqual(q.bars[1].style);
      const target = emptyProject();
      const plan = previewDetailTransfer(target, source, {
        mode: 'insert',
        sourceDetailId: source.hierarchy.details[0].id,
        targetElementId: target.hierarchy.elements[0].id,
      });
      expect(plan.issues).toEqual([]);
      const imported = applyDetailTransfer(target, plan);
      expect(mass(imported)).toBe(mass(p));
      expect(
        resolveStyle(imported, imported.bars[0], 'ARMADURAS').lineType,
      ).toEqual(LINE_TYPES[3]);
      expect(decodeProject(JSON.stringify(imported))).toEqual(imported);
    },
  );
  it('colisões de ID/nome no intercâmbio não sobrescrevem estilos locais e cópias mantêm associação', () => {
    const { p, id } = fixture();
    const source = editLayers(p, [id], { color: '#123456' });
    const target = {
      ...editLayers(p, [id], { color: '#654321' }),
      id: 'local-project',
    };
    const plan = previewDetailTransfer(target, source, {
      mode: 'insert',
      sourceDetailId: source.hierarchy.details[0].id,
      targetElementId: target.hierarchy.elements[0].id,
    });
    expect(plan.issues).toEqual([]);
    const q = applyDetailTransfer(target, plan);
    expect(q.layers.find((l) => l.id === id)?.color).toBe('#654321');
    expect(q.bars[2].layerId).not.toBe(id);
    expect(resolveStyle(q, q.bars[2], 'ARMADURAS').color).toBe('#123456');
    const clone = cloneArmatureGraph(q, {
      barIds: [q.bars[2].id],
      delta: { x: 1000, y: 0 },
    });
    expect(clone.project.bars.at(-1)?.layerId).toBe(q.bars[2].layerId);
  });
  it('protege o catálogo global durante edição isolada, permitindo reassociar apenas objetos próprios', () => {
    const { p, id } = fixture(),
      scope = p.hierarchy.details[0].id;
    expect(() =>
      assertDetailEdit(p, editLayers(p, [id], { color: '#123456' }), scope),
    ).toThrow();
    expect(() =>
      assertDetailEdit(p, assignLayer(p, ['a'], 'layer:ARMADURAS'), scope),
    ).not.toThrow();
  });
  it('DXF UTF-8 conserva nomes, RGB, espessuras, padrões simples, escala, herança e overrides', () => {
    const { p, id } = fixture();
    let q = editLayers(p, [id], {
      color: '#1278ab',
      lineType: LINE_TYPES[1],
      lineScale: 2,
      lineWidth: 0.35,
    });
    q = assignLayer(q, ['b'], id, {
      color: '#ef1234',
      lineType: LINE_TYPES[2],
      lineScale: 3,
      lineWidth: 0.7,
    });
    const dxf = toDxf(q);
    expect(dxf).toContain('AC1021');
    expect(dxf).toContain('Vigas · aço');
    expect(dxf).toContain('BYLAYER');
    const tables = dxfStyleTables(dxf);
    expect(tables.layers['Vigas · aço']).toMatchObject({
      trueColor: 0x1278ab,
      lineweight: 35,
      lineType: 'DASHED',
    });
    expect(tables.types.DASHED.pattern).toEqual([100, -50]);
    const mask = parseDxf(dxf, 'retorno.dxf');
    const loaded = completeOwnership({ ...emptyProject(), masks: [mask] });
    const lines = drawingPrimitives(loaded);
    expect(
      lines.some(
        (l) =>
          l.resolvedStyle?.color === '#1278ab' &&
          l.resolvedStyle.lineWidth === 0.35 &&
          l.resolvedStyle.lineScale === 2,
      ),
    ).toBe(true);
    expect(
      lines.some(
        (l) =>
          l.resolvedStyle?.color === '#ef1234' &&
          l.resolvedStyle.lineWidth === 0.7 &&
          l.resolvedStyle.lineType.name === 'DOTTED',
      ),
    ).toBe(true);
    expect(decodeProject(JSON.stringify(loaded))).toEqual(loaded);
    expect(loaded.bars).toHaveLength(0);
  });
  it('máscara conserva layers originais e filtros ao renomear/reassociar catálogo, sem reunir tudo em MASCARA', () => {
    const mask = normalizeCad(
      {
        header: { $INSUNITS: 4 },
        tables: {
          LAYER: {
            entries: [
              {
                name: 'Fôrmas',
                color: 0x123456,
                lineType: 'CONTINUOUS',
                lineweight: 50,
              },
              {
                name: 'Eixos',
                color: 0xff0000,
                lineType: 'CONTINUOUS',
                lineweight: 18,
              },
            ],
          },
        },
        entities: [
          {
            type: 'LINE',
            layer: 'Fôrmas',
            vertices: [
              { x: 0, y: 0 },
              { x: 500, y: 0 },
            ],
          },
          {
            type: 'LINE',
            layer: 'Eixos',
            vertices: [
              { x: 0, y: 100 },
              { x: 500, y: 100 },
            ],
          },
        ],
      },
      'Ref',
      'DWG',
    );
    mask.layers.Eixos = false;
    const p = completeOwnership({ ...emptyProject(), masks: [mask] });
    const form = p.layers.find((l) => l.name === 'Fôrmas')!;
    const q = editLayers(p, [form.id], { name: 'Concreto', color: '#abcdef' });
    expect(q.masks[0].layers).toEqual(mask.layers);
    expect(maskPrimitives(q.masks[0])).toHaveLength(1);
    expect(drawingPrimitives(q)[0]).toMatchObject({
      layer: 'Concreto',
      resolvedStyle: { color: '#abcdef', lineWidth: 0.5 },
    });
    expect(toDxf(q)).toContain('Concreto');
    expect(() => removeLayer(q, form.id)).toThrow();
    const reassigned = removeLayer(q, form.id, 'layer:DESENHO');
    expect(reassigned.masks[0].primitives[0].layerId).toBe('layer:DESENHO');
    expect(reassigned.masks[0].layers).toEqual(mask.layers);
  });
  it('preenchimento sólido é vetor no PDF e retorna pelo contorno simples do HATCH DXF', () => {
    const { p, id } = fixture();
    const q = editLayers(p, [id], { fill: 'solid', fillColor: '#321abc' });
    const dxf = toDxf(q);
    expect(dxf).toContain('HATCH');
    const mask = parseDxf(dxf, 'filled.dxf');
    expect(
      mask.primitives.some(
        (l) => l.style?.fill === 'solid' && l.style.fillColor === '#321abc',
      ),
    ).toBe(true);
    const pdf = toPdf(q);
    expect(new TextDecoder().decode(pdf).slice(0, 4)).toBe('%PDF');
    expect(mass(q)).toBe(mass(p));
  });
});

it('API de estilos continua atômica, aceita ByLayer e conserva cor legada explícita', () => {
  const p = emptyProject(),
    detailId = p.hierarchy.details[0].id;
  const result = executeRebarBatch(
    p,
    [
      {
        type: 'bar.create',
        id: 'api',
        detailId,
        definition: {
          kind: 'free',
          diameter: 10,
          mandrel: 50,
          steel: 'CA-50',
          quantity: 2,
          color: '#123456',
          points: [
            { x: 0, y: 0 },
            { x: 1000, y: 0 },
          ],
        },
      },
    ],
    { units: 'mm' },
  );
  expect(result.ok).toBe(true);
  const q = applyRebarBatch(p, result);
  expect(resolveStyle(q, q.bars[0], 'ARMADURAS').color).toBe('#123456');
  const edited = applyRebarBatch(
    q,
    executeRebarBatch(
      q,
      [
        {
          type: 'bar.update',
          id: 'api',
          patch: { kind: 'free', style: {}, layerId: 'layer:ARMADURAS' },
        },
      ],
      { units: 'mm' },
    ),
  );
  expect(resolveStyle(edited, edited.bars[0], 'ARMADURAS').color).toBe(
    edited.layers[0].color,
  );
  expect(() =>
    toDxf(editLayers(edited, ['layer:ARMADURAS'], { lineWidth: 0.333 })),
  ).toThrow(/Espessura/);
});
it('escala global CAD, padrões DWG e nomes de referência legados são normalizados sem perder geometria', () => {
  const m = normalizeCad(
    {
      header: { $INSUNITS: 5, $LTSCALE: 2 },
      tables: {
        LAYER: {
          entries: [
            {
              name: 'xref|Eixos',
              color: 0x123456,
              lineType: 'CENTRO',
              lineweight: 25,
            },
          ],
        },
        LTYPE: {
          entries: [
            {
              name: 'CENTRO',
              pattern: [
                { elementLength: 1, elementTypeFlag: 0 },
                { elementLength: -0.5, elementTypeFlag: 0 },
              ],
            },
          ],
        },
      },
      entities: [
        {
          type: 'LINE',
          layer: 'xref|Eixos',
          vertices: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
          ],
        },
      ],
    },
    'Escala',
    'DWG',
  );
  const p = completeOwnership({ ...emptyProject(), masks: [m] });
  expect(
    p.layers.find((l) => l.name === 'xref_Eixos')?.lineType.pattern,
  ).toEqual([20, -10]);
  expect(drawingPrimitives(p)[0].points).toEqual([
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ]);
  expect(p.masks[0].warnings.some((s) => s.includes('normalizado'))).toBe(true);
  expect(decodeProject(JSON.stringify(p))).toEqual(p);
});
