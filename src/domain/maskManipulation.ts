import { maskPoint, maskPrimitives } from '../cad/import';
import {
  localMaskPoint,
  nativePrimitive,
  validateNativeMask,
} from './nativeMasks';
import {
  maskCadEntities,
  maskEditTarget,
  sameMaskEntity,
  type MaskEntityRef,
} from './maskCadEditing';
import type { MaskDrawingContext } from './maskDrawing';
import {
  selectionTransformSchema,
  transformPoint,
  type SelectionTransform,
} from './transforms';
import {
  uid,
  type Mask,
  type Point,
  type Primitive,
  type Project,
} from './types';

export type MaskManipMode = 'copy' | 'erase';
export type MaskCopyTransform = Extract<
  SelectionTransform,
  { kind: 'translate' }
>;
export const maskManipNames: Record<MaskManipMode, string> = {
  copy: 'Copiar',
  erase: 'Apagar',
};
/** References are resolved against this exact snapshot, never by a residual steel selection. */
export function maskManipSelection(
  p: Project,
  maskId: string,
  refs: MaskEntityRef[],
  context: MaskDrawingContext,
) {
  const mask = maskEditTarget(p, maskId, context);
  if (!refs.length)
    throw new Error(
      'Selecione entidades da máscara ativa; nenhuma entidade será alterada.',
    );
  const available = new Map(
    maskCadEntities(p, context).map((entity) => [entity.ref.primitive, entity]),
  );
  const seen = new Set<Primitive>();
  const entities = refs.map((ref) => {
    const entity = available.get(ref.primitive);
    if (!entity || !sameMaskEntity(entity.ref, ref) || entity.mask !== mask)
      throw new Error(
        'Seleção inválida ou de outra máscara. Reinicie a seleção no alvo ativo.',
      );
    if (!entity.editable)
      throw new Error(
        'Entidade oculta, sem captura ou bloqueada; libere seu layer explicitamente.',
      );
    if (seen.has(entity.ref.primitive))
      throw new Error('Entidade repetida na seleção.');
    seen.add(entity.ref.primitive);
    return entity;
  });
  return { mask, entities };
}
/** Same rigid transform as the CAD, composed model → local exactly once. */
export function transformMaskPrimitive(
  q: Primitive,
  mask: Mask,
  input: MaskCopyTransform,
): Primitive {
  const t = selectionTransformSchema.parse(input);
  const at = (p: Point) =>
    localMaskPoint(transformPoint(maskPoint(p, mask), t), mask);
  const result = structuredClone(q);
  if (q.native) {
    const s = q.native;
    if (s.kind === 'circle' || s.kind === 'arc') {
      const center = at(s.center);
      result.native = { ...s, center };
    } else {
      result.native = { ...s, points: s.points.map(at) };
    }
    const rendered = nativePrimitive(
      result.native,
      result.id ?? 'preview',
      q.layer,
    );
    result.points = rendered.points;
    result.closed = rendered.closed;
  } else result.points = q.points.map(at);
  const coords = [
    ...result.points,
    ...maskPrimitives({ ...mask, primitives: [result] }).flatMap(
      (v) => v.points,
    ),
  ];
  if (result.native?.kind === 'circle' || result.native?.kind === 'arc') {
    const c = maskPoint(result.native.center, mask),
      r = result.native.radius * mask.scale;
    if (
      ![c.x - r, c.x + r, c.y - r, c.y + r].every(
        (n) => Number.isFinite(n) && Math.abs(n) <= 1e9,
      )
    )
      throw new Error('Curva fora dos limites de coordenadas.');
  }
  if (
    !coords.every((v) =>
      [v.x, v.y].every((n) => Number.isFinite(n) && Math.abs(n) <= 1e9),
    )
  )
    throw new Error(
      'Resultado fora dos limites de coordenadas ±1.000.000.000 mm.',
    );
  return result;
}
export type MaskManipPlan = {
  project: Project;
  mask: Mask;
  refs: MaskEntityRef[];
  mode: MaskManipMode;
  transform?: MaskCopyTransform;
  result: Primitive[];
};
export function previewMaskManipulation(
  p: Project,
  maskId: string,
  refs: MaskEntityRef[],
  mode: MaskManipMode,
  context: MaskDrawingContext,
  transform?: MaskCopyTransform,
): MaskManipPlan {
  const { mask, entities } = maskManipSelection(p, maskId, refs, context);
  if (mode !== 'erase' && !transform)
    throw new Error('Escolha o ponto base e destino da operação.');
  if (mode === 'copy' && transform?.kind !== 'translate')
    throw new Error('Copiar usa translação do ponto base ao destino.');
  if (mode === 'erase' && transform)
    throw new Error('Apagar não aceita transformação.');
  if (mode === 'copy' && mask.primitives.length + entities.length > 100000)
    throw new Error('Limite de 100 mil entidades da máscara atingido.');
  const result =
    mode === 'erase'
      ? []
      : entities.map((e) =>
          transformMaskPrimitive(e.ref.primitive, mask, transform!),
        );
  return { project: p, mask, refs, mode, transform, result };
}
export function applyMaskManipulation(
  p: Project,
  plan: MaskManipPlan,
  context: MaskDrawingContext,
): Project {
  if (p !== plan.project)
    throw new Error('O projeto mudou. Reinicie Manipular no contexto correto.');
  const fresh = previewMaskManipulation(
    p,
    plan.mask.id,
    plan.refs,
    plan.mode,
    context,
    plan.transform,
  );
  if (
    plan.transform?.kind === 'translate' &&
    Math.hypot(plan.transform.delta.x, plan.transform.delta.y) < 1e-6
  )
    return p;
  const chosen = new Set(plan.refs.map((r) => r.primitive));
  let primitives: Primitive[];
  if (plan.mode === 'copy') {
    const idMap = new Map(
      plan.refs.flatMap((r) => (r.id ? [[r.id, uid()] as const] : [])),
    );
    const copies = fresh.result.map((q) => ({
      ...q,
      id: q.id ? idMap.get(q.id)! : uid(),
      ...(q.sourceEntityId
        ? { sourceEntityId: idMap.get(q.sourceEntityId) ?? q.sourceEntityId }
        : {}),
    }));
    primitives = [...plan.mask.primitives, ...copies];
  } else {
    primitives = plan.mask.primitives.filter((q) => !chosen.has(q));
  }
  const mask = { ...plan.mask, primitives };
  validateNativeMask(mask);
  return { ...p, masks: p.masks.map((m) => (m === plan.mask ? mask : m)) };
}
