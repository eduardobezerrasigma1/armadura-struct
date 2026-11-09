import { describe, it, expect } from 'vitest';
import { maskManipFixture } from './fixtures/maskManipulation';
import {
  graphicEntities,
  previewMatchProperties,
  applyMatchProperties,
  type MatchOptions,
} from '../src/domain/matchProperties';
import { decodeProject } from '../src/domain/model';
import { toCsv, toDxf, toPdf } from '../src/lib/exports';
import { setLayerState } from '../src/domain/layerProfiles';
const setup = () => {
  const p = maskManipFixture();
  const ctx = {
    key: 'model',
    detailId: p.hierarchy.objectDetails[p.masks[0].id],
  };
  return { p, ctx, active: p.masks[0].id };
};
const options: MatchOptions = {
  mode: 'binding',
  properties: ['color', 'lineType', 'lineWidth', 'lineScale'],
};
describe('Copiar propriedades gráficas', () => {
  it('prévia pura e aplicação parcial preservam geometria, IDs, aço, RA e CSV', () => {
    const { p, ctx, active } = setup();
    p.masks[0].primitives[0].style = {
      color: '#123456',
      lineWidth: 0.5,
      lineScale: 2,
      lineType: { name: 'DASHED', pattern: [100, -50] },
    };
    const all = graphicEntities(p, ctx, active),
      source = all.find((e) => e.object.id === 'line')!,
      target = all.find((e) => e.object.id === 'circle')!;
    const before = JSON.stringify(p);
    const plan = previewMatchProperties(
      p,
      source,
      [target],
      options,
      ctx,
      active,
    );
    expect(JSON.stringify(p)).toBe(before);
    const q = applyMatchProperties(p, plan, ctx, active);
    expect(q.masks[0].primitives[1].style).toEqual(
      p.masks[0].primitives[0].style,
    );
    expect(q.masks[0].primitives[1].native).toEqual(
      p.masks[0].primitives[1].native,
    );
    expect(q.masks[0].primitives[1].id).toBe('circle');
    expect(q.masks[0].primitives[2]).toBe(p.masks[0].primitives[2]);
    expect(q.bars).toEqual(p.bars);
    expect(q.scheduleLock).toBe(p.scheduleLock);
    expect(toCsv(q)).toBe(toCsv(p));
    expect(q.masks[1]).toBe(p.masks[1]);
    expect(decodeProject(JSON.stringify(q)).masks).toEqual(q.masks);
    expect(toDxf(q)).toContain('DASHED');
    expect(toPdf(q).length).toBeGreaterThan(100);
  });
  it.each(['binding', 'resolved'] as const)(
    'ByLayer e aparência resolvida: %s',
    (mode) => {
      const { p, ctx, active } = setup();
      p.masks[0].primitives[1].style = { color: '#ff0000' };
      const all = graphicEntities(p, ctx, active);
      const source = all.find((e) => e.object.id === 'line')!,
        target = all.find((e) => e.object.id === 'circle')!;
      const q = applyMatchProperties(
        p,
        previewMatchProperties(
          p,
          source,
          [target],
          { mode, properties: ['color'] },
          ctx,
          active,
        ),
        ctx,
        active,
      );
      expect(q.masks[0].primitives[1].style?.color === undefined).toBe(
        mode === 'binding',
      );
      expect(
        decodeProject(JSON.stringify(q)).masks[0].primitives[1].style,
      ).toEqual(q.masks[0].primitives[1].style);
    },
  );
  it('cópia seletiva conserva atributos não escolhidos e copia o vínculo de layer', () => {
    const { p, ctx, active } = setup();
    const source = p.masks[0].primitives[0],
      target = p.masks[0].primitives[1];
    source.layerId = p.layers[0].id;
    source.style = { color: '#123456', lineWidth: 0.5 };
    target.style = { color: '#ffffff', lineWidth: 0.7, lineScale: 3 };
    const all = graphicEntities(p, ctx, active);
    const q = previewMatchProperties(
      p,
      all.find((e) => e.object === source)!,
      [all.find((e) => e.object === target)!],
      { mode: 'binding', properties: ['layer', 'color'] },
      ctx,
      active,
    ).project;
    expect(q.masks[0].primitives[1].layerId).toBe(source.layerId);
    expect(q.masks[0].primitives[1].style).toEqual({
      color: '#123456',
      lineWidth: 0.7,
      lineScale: 3,
    });
    expect(q.masks[0].primitives[1].points).toBe(target.points);
  });
  it('referência importada sem layer catalogado usa o mesmo fallback da renderização', () => {
    const { p, ctx, active } = setup();
    p.masks[0].format = 'DXF';
    p.masks[0].primitives[0].layer = 'ORIGEM_DESCONHECIDA';
    const all = graphicEntities(p, ctx, active);
    const q = previewMatchProperties(
      p,
      all.find((e) => e.object.id === 'line')!,
      [all.find((e) => e.object.id === 'circle')!],
      { mode: 'resolved', properties: ['color'] },
      ctx,
      active,
    ).project;
    expect(q.masks[0].primitives[1].style?.color).toBe(p.layers[0].color);
    expect(q.masks[0].primitives[1].native).toBe(
      p.masks[0].primitives[1].native,
    );
  });
  it('objetos com a mesma marca têm IDs e rótulos distintos para escolha explícita', () => {
    const { p, ctx, active } = setup();
    const bar = { ...p.bars[0], id: 'another-bar' };
    p.bars.push(bar);
    p.hierarchy.objectDetails[bar.id] = ctx.detailId;
    const all = graphicEntities(p, ctx, active).filter((e) =>
      p.bars.some((b) => b.id === e.owner),
    );
    expect(new Set(all.map((e) => e.label)).size).toBe(2);
    expect(new Set(all.map((e) => e.key)).size).toBe(2);
  });
  it('altura de texto usa mm físicos; alinhamento é compatível somente entre textos de máscara', () => {
    const { p, ctx, active } = setup();
    p.masks[0].scale = 2;
    p.masks[0].format = 'DXF';
    p.masks[0].primitives = [
      {
        id: 'text',
        layer: 'DESENHO',
        points: [{ x: 0, y: 0 }],
        text: 'Fonte',
        textHeight: 4,
        textAlign: 'right',
      },
    ];
    const all = graphicEntities(p, ctx, active),
      source = all.find((e) => e.object.id === 'text')!,
      target = all.find((e) => e.object.id === 'static-dimension')!;
    const plan = previewMatchProperties(
      p,
      source,
      [target],
      { mode: 'binding', properties: ['textHeight'] },
      ctx,
      active,
    );
    expect(plan.project.annotations[0].textHeight).toBe(8);
    expect(() =>
      previewMatchProperties(
        p,
        source,
        [target],
        { mode: 'binding', properties: ['textAlign'] },
        ctx,
        active,
      ),
    ).toThrow(/incompatível/);
  });
  it('atributos gráficos de uma barra não alteram os parâmetros físicos', () => {
    const { p, ctx, active } = setup();
    p.masks[0].primitives[0].style = { color: '#123456' };
    const all = graphicEntities(p, ctx, active);
    const plan = previewMatchProperties(
      p,
      all.find((e) => e.object.id === 'line')!,
      [all.find((e) => e.owner === p.bars[0].id)!],
      { mode: 'resolved', properties: ['color'] },
      ctx,
      active,
    );
    expect({ ...plan.project.bars[0], style: p.bars[0].style }).toEqual(
      p.bars[0],
    );
    expect(toCsv(plan.project)).toBe(toCsv(p));
  });
  it('recusa lote incompatível, repetido, protegido, seleção da fonte e mudança de contexto', () => {
    const { p, ctx, active } = setup();
    const all = graphicEntities(p, ctx, active),
      source = all.find((e) => e.object.id === 'line')!,
      target = all.find((e) => e.object.id === 'circle')!;
    for (const dest of [[], [source], [target, target]])
      expect(() =>
        previewMatchProperties(p, source, dest, options, ctx, active),
      ).toThrow();
    expect(() =>
      previewMatchProperties(
        p,
        source,
        [target],
        { ...options, properties: ['textHeight'] },
        ctx,
        active,
      ),
    ).toThrow(/incompatível/);
    const plan = previewMatchProperties(
      p,
      source,
      [target],
      options,
      ctx,
      active,
    );
    expect(() => applyMatchProperties({ ...p }, plan, ctx, active)).toThrow(
      /mudou/,
    );
    expect(() =>
      applyMatchProperties(p, plan, { ...ctx, key: 'sheet:x' }, active),
    ).toThrow();
    expect(
      graphicEntities(p, { ...ctx, scopeDetailId: 'other' }, active),
    ).toHaveLength(0);
    const locked = setLayerState(
      p,
      'model',
      p.layers.find((l) => l.name === 'DESENHO')!.id,
      { editable: false },
    );
    expect(() =>
      previewMatchProperties(locked, source, [target], options, ctx, active),
    ).toThrow();
  });
  it('override global da máscara e layer de destino bloqueado recebem aviso antes do commit', () => {
    const { p, ctx, active } = setup();
    p.masks[0].style = { color: '#111111' };
    const all = graphicEntities(p, ctx, active);
    expect(() =>
      previewMatchProperties(
        p,
        all.find((e) => e.object.id === 'line')!,
        [all.find((e) => e.object.id === 'circle')!],
        options,
        ctx,
        active,
      ),
    ).toThrow(/global/);
  });
});
