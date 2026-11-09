import type { Project, LayerBinding, DrawingStyle, Primitive } from './types';
import {
  layerObjects,
  objectRole,
  resolveStyle,
  stylePrimitive,
} from './layers';
import { objectState, layerState } from './layerProfiles';
import { objectHidden } from './visibility';
import { maskCadEntities } from './maskCadEditing';
import type { MaskDrawingContext } from './maskDrawing';
import { drawingStyleSchema } from './layerSchema';
export type GraphicProperty =
  | 'layer'
  | 'color'
  | 'lineType'
  | 'lineScale'
  | 'lineWidth'
  | 'textHeight'
  | 'textAlign';
export const graphicNames: Record<GraphicProperty, string> = {
  layer: 'Layer',
  color: 'Cor',
  lineType: 'Tipo de linha',
  lineScale: 'Escala de linha',
  lineWidth: 'Espessura de linha',
  textHeight: 'Altura de texto',
  textAlign: 'Alinhamento de texto',
};
export type GraphicRef = {
  key: string;
  label: string;
  object: LayerBinding & {
    id?: string;
    color?: string;
    textHeight?: number;
    textAlign?: Primitive['textAlign'];
  };
  owner: string;
  maskId?: string;
  index?: number;
  role: string;
  scale: number;
  text: boolean;
  align: boolean;
  editable: boolean;
};
export function graphicEntities(
  p: Project,
  ctx: MaskDrawingContext,
  activeMask?: string,
): GraphicRef[] {
  if (ctx.key.startsWith('sheet:')) return [];
  const ordinary = layerObjects(p)
    .filter(
      (o) =>
        !p.masks.some((m) => m.id === o.id) &&
        p.hierarchy.objectDetails[o.id] === ctx.detailId &&
        (!ctx.scopeDetailId ||
          ctx.scopeDetailId === p.hierarchy.objectDetails[o.id]) &&
        !objectHidden(p, ctx.key, o.id) &&
        objectState(p, ctx.key, o).capture,
    )
    .map((o) => ({
      key: o.id,
      label: `${objectRole(p, o)} · ${'mark' in o ? o.mark : 'label' in o ? o.label : o.id.slice(0, 8)} · [${o.id.slice(0, 8)}]`,
      object: o,
      owner: o.id,
      role: objectRole(p, o),
      scale: 1,
      text: 'textHeight' in o,
      align: false,
      editable: objectState(p, ctx.key, o).editable,
    }));
  const primitiveLayer = (e: ReturnType<typeof maskCadEntities>[number]) =>
    stylePrimitive(p, e.mask, e.ref.primitive).layerId!;
  const masks = maskCadEntities(p, ctx)
    .filter(
      (e) =>
        e.mask.id === activeMask &&
        p.hierarchy.objectDetails[e.mask.id] === ctx.detailId,
    )
    .filter((e) => layerState(p, ctx.key, primitiveLayer(e)).capture)
    .map((e) => ({
      key: e.ref.key,
      label: e.label,
      object: e.ref.primitive,
      owner: e.mask.id,
      maskId: e.mask.id,
      index: e.ref.index,
      role: e.ref.primitive.role ?? e.ref.primitive.layer,
      scale: e.mask.scale,
      text: !!e.ref.primitive.text,
      align: !!e.ref.primitive.text,
      editable:
        e.editable && layerState(p, ctx.key, primitiveLayer(e)).editable,
    }));
  return [...ordinary, ...masks];
}
export type MatchOptions = {
  properties: GraphicProperty[];
  mode: 'binding' | 'resolved';
};
export type MatchPlan = {
  base: Project;
  project: Project;
  source: GraphicRef;
  targets: GraphicRef[];
  options: MatchOptions;
  context: MaskDrawingContext;
  activeMask?: string;
  count: number;
  notes: string[];
};
export function previewMatchProperties(
  p: Project,
  source: GraphicRef,
  targets: GraphicRef[],
  options: MatchOptions,
  ctx: MaskDrawingContext,
  activeMask?: string,
): MatchPlan {
  const all = graphicEntities(p, ctx, activeMask),
    live = (r: GraphicRef) =>
      all.find((e) => e.key === r.key && e.object === r.object);
  const src = live(source);
  if (!src) throw new Error('Fonte removida, oculta ou de outro contexto.');
  if (
    !options.properties.length ||
    options.properties.some((k) => !(k in graphicNames)) ||
    !['binding', 'resolved'].includes(options.mode)
  )
    throw new Error('Escolha propriedades e modo válidos.');
  if (!targets.length) throw new Error('Selecione destinos explicitamente.');
  const seen = new Set<string>(),
    replacements = new Map<GraphicRef['object'], GraphicRef['object']>();
  let count = 0;
  const effectiveLayer = (r: GraphicRef) => {
    const m = p.masks.find((m) => m.id === r.maskId);
    if (m) return stylePrimitive(p, m, r.object as Primitive).layerId!;
    const id = r.object.layerId ?? `layer:${r.role}`;
    return p.layers.find((l) => l.id === id)?.id ?? p.layers[0].id;
  };
  const sourceLayer = effectiveLayer(src);
  if (!p.layers.some((l) => l.id === sourceLayer))
    throw new Error('Layer da fonte não foi resolvido.');
  const parent = p.masks.find((m) => m.id === src.maskId);
  const sourceStyle = parent
    ? stylePrimitive(p, parent, src.object as Primitive).resolvedStyle!
    : resolveStyle(p, src.object, src.role);
  const sourceOverrides = {
    ...(!src.object.layerId && src.object.color
      ? { color: src.object.color }
      : {}),
    ...src.object.style,
    ...parent?.style,
  };
  for (const ref of targets) {
    const target = live(ref);
    if (!target || !target.editable)
      throw new Error(
        `Destino removido, protegido ou fora do contexto: ${ref.label}`,
      );
    if (target.key === src.key || seen.has(target.key))
      throw new Error(
        'Fonte não pode ser destino; destinos repetidos não são permitidos.',
      );
    seen.add(target.key);
    const m = p.masks.find((m) => m.id === target.maskId);
    const next = {
      ...target.object,
      style: {
        ...(!target.object.layerId && target.object.color
          ? { color: target.object.color }
          : {}),
        ...target.object.style,
      },
    };
    if (options.properties.includes('layer')) {
      if (m?.layerId && m.layerId !== sourceLayer)
        throw new Error(
          'Layer global da máscara prevalece. Remova esse override no controle antes de igualar o layer de uma entidade.',
        );
      if (!layerState(p, ctx.key, sourceLayer).editable)
        throw new Error('Layer de destino bloqueado/oculto/sem captura.');
      if (m?.layers[p.layers.find((l) => l.id === sourceLayer)!.name] === false)
        throw new Error('Layer desligado na máscara de destino.');
      next.layerId = sourceLayer;
    } else next.layerId = target.object.layerId ?? effectiveLayer(target);
    for (const key of options.properties) {
      if (key === 'layer') continue;
      if (key === 'textHeight' || key === 'textAlign') {
        if (
          !src.text ||
          !target.text ||
          (key === 'textAlign' && (!src.align || !target.align))
        )
          throw new Error(
            `Propriedade de texto incompatível: ${graphicNames[key]} → ${target.label}. Retire essa propriedade do lote.`,
          );
        if (key === 'textHeight')
          next.textHeight =
            ((src.object.textHeight ?? 2.5) * src.scale) / target.scale;
        else next.textAlign = src.object.textAlign ?? 'left';
      } else {
        if (m?.style?.[key] !== undefined)
          throw new Error(
            `Override global da máscara impede ${graphicNames[key]} nessa entidade. Remova-o explicitamente antes de aplicar.`,
          );
        const value =
          options.mode === 'resolved' ? sourceStyle[key] : sourceOverrides[key];
        if (value === undefined) delete next.style[key];
        else Object.assign(next.style, { [key]: structuredClone(value) });
      }
    }
    if (next.style) drawingStyleSchema.partial().parse(next.style);
    if (
      next.textHeight !== undefined &&
      (!Number.isFinite(next.textHeight) ||
        next.textHeight <= 0 ||
        next.textHeight > 1e6)
    )
      throw new Error('Altura de texto fora dos limites.');
    if (JSON.stringify(next) !== JSON.stringify(target.object)) {
      replacements.set(target.object, next);
      count++;
    }
  }
  const change = <T extends LayerBinding>(o: T): T =>
    (replacements.get(o) ?? o) as T;
  const project = count
    ? {
        ...p,
        bars: p.bars.map(change),
        details: p.details.map(change),
        polylines: p.polylines.map(change),
        annotations: p.annotations.map(change),
        masks: p.masks.map((m) => {
          const primitives = m.primitives.map(change);
          return primitives.some((q, i) => q !== m.primitives[i])
            ? { ...m, primitives }
            : m;
        }),
      }
    : p;
  return {
    base: p,
    project,
    source: src,
    targets,
    options: structuredClone(options),
    context: { ...ctx },
    activeMask,
    count,
    notes: [
      'Overrides de impressão existentes são preservados e podem prevalecer no PDF/DXF. Não são copiados preenchimento, conteúdo, rotação, fonte inexistente no contrato ou parâmetros físicos.',
    ],
  };
}
export function applyMatchProperties(
  p: Project,
  plan: MatchPlan,
  ctx: MaskDrawingContext,
  activeMask?: string,
) {
  if (
    p !== plan.base ||
    JSON.stringify(ctx) !== JSON.stringify(plan.context) ||
    activeMask !== plan.activeMask
  )
    throw new Error('Contexto/projeto mudou; reinicie Copiar propriedades.');
  return previewMatchProperties(
    p,
    plan.source,
    plan.targets,
    plan.options,
    ctx,
    activeMask,
  ).project;
}
