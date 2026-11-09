import { z } from 'zod';
import type { Point, Project } from './types';
import { add, sub, rotate, distance, geometry } from './geometry';
import { completeOwnership, contentObjects } from './hierarchy';
import { armatureReferences } from './armatureReferences';
import { annotationError } from './drafting';
import { assertLayerEdit } from './layerProfiles';
import { assertVisibilityEdit } from './visibility';
import { assertDetailEdit } from './detailEditing';
import { scheduleChanged } from './model';
const point = z
  .object({
    x: z.number().finite().min(-1e9).max(1e9),
    y: z.number().finite().min(-1e9).max(1e9),
  })
  .strict();
export const selectionTransformSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('translate'), delta: point }).strict(),
  z
    .object({
      kind: z.literal('rotate'),
      base: point,
      angle: z.number().finite().min(-360000).max(360000),
    })
    .strict(),
  z.object({ kind: z.literal('mirror'), base: point, axisEnd: point }).strict(),
]);
export type SelectionTransform = z.infer<typeof selectionTransformSchema>;
export function angleByPoints(base: Point, reference: Point, target: Point) {
  if (distance(base, reference) < 0.01 || distance(base, target) < 0.01)
    throw new Error('Use pontos distintos da base para definir o ângulo.');
  const a = sub(reference, base),
    b = sub(target, base);
  return (
    (Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y) * 180) / Math.PI
  );
}
export function transformPoint(p: Point, t: SelectionTransform): Point {
  if (t.kind === 'translate') return add(p, t.delta);
  const v = sub(p, t.base);
  if (t.kind === 'rotate') return add(t.base, rotate(v, t.angle));
  const axis =
    (Math.atan2(t.axisEnd.y - t.base.y, t.axisEnd.x - t.base.x) * 180) /
    Math.PI;
  return add(t.base, rotate({ x: v.x, y: -v.y }, axis * 2));
}
export function selectionTransformIds(
  p: Project,
  ids: string[],
  associated = true,
) {
  const live = new Set(contentObjects(p).map((o) => o.id));
  if (!ids.length || ids.some((id) => !live.has(id)))
    throw new Error('Selecione objetos existentes.');
  const chosen = new Set(ids),
    bars = new Set(p.bars.filter((b) => chosen.has(b.id)).map((b) => b.id));
  const shared: string[] = [];
  if (associated)
    for (const o of [...p.annotations, ...p.polylines]) {
      const refs = armatureReferences(o);
      if (refs.length && refs.some((id) => bars.has(id))) {
        if (
          refs.every(
            (id) =>
              bars.has(id) &&
              p.hierarchy.objectDetails[id] === p.hierarchy.objectDetails[o.id],
          )
        )
          chosen.add(o.id);
        else if (!chosen.has(o.id)) shared.push(o.id);
      }
    }
  return { ids: [...chosen], shared };
}
/** One immutable rigid operation. Representations never create physical occurrences. */
export function transformSelection(
  p: Project,
  ids: string[],
  input: SelectionTransform,
  options: {
    associated?: boolean;
    layerContext?: string;
    scopeDetailId?: string;
  } = {},
): Project {
  const t = selectionTransformSchema.parse(input);
  if (t.kind === 'mirror' && distance(t.base, t.axisEnd) < 0.01)
    throw new Error('Defina dois pontos distintos para o eixo do espelho.');
  const chosen = new Set(selectionTransformIds(p, ids, options.associated).ids);
  const flipped = t.kind === 'mirror';
  const spin =
    t.kind === 'translate'
      ? 0
      : t.kind === 'rotate'
        ? t.angle
        : (2 *
            Math.atan2(t.axisEnd.y - t.base.y, t.axisEnd.x - t.base.x) *
            180) /
          Math.PI;
  const angle = (r: number) =>
    t.kind === 'translate'
      ? r
      : (((flipped ? spin - r : r + spin) % 360) + 360) % 360;
  const at = (v: Point) => transformPoint(v, t);
  const reflect = (v: Point) => ({ x: v.x, y: -v.y || 0 });
  let next: Project = {
    ...p,
    bars: p.bars.map((b) =>
      !chosen.has(b.id)
        ? b
        : {
            ...b,
            origin: at(b.origin),
            rotation: angle(b.rotation),
            ...(flipped
              ? b.kind === 'free'
                ? { points: b.points.map(reflect) }
                : { stirrupMirrored: !b.stirrupMirrored }
              : {}),
            distribution: b.distribution
              ? {
                  ...b.distribution,
                  start: b.distribution.start
                    ? at(b.distribution.start)
                    : undefined,
                  end: at(b.distribution.end),
                  ...(flipped && b.distribution.annotationOffset !== undefined
                    ? { annotationOffset: -b.distribution.annotationOffset }
                    : {}),
                }
              : undefined,
          },
    ),
    details: p.details.map((d) =>
      !chosen.has(d.id)
        ? d
        : {
            ...d,
            origin: at(d.origin),
            rotation: angle(d.rotation ?? 0),
            ...(flipped
              ? { mirrored: chosen.has(d.barId) ? !!d.mirrored : !d.mirrored }
              : {}),
            ...(flipped && chosen.has(d.barId) && d.label
              ? {
                  label: {
                    ...d.label,
                    origin: reflect(d.label.origin),
                    rotation: -d.label.rotation,
                  },
                }
              : {}),
          },
    ),
    annotations: p.annotations.map((a) =>
      !chosen.has(a.id)
        ? a
        : {
            ...a,
            points: a.points.map(at),
            ...(a.kind === 'dimension-orthogonal' && t.kind !== 'translate'
              ? { frameRotation: angle(a.frameRotation ?? 0) }
              : {}),
          },
    ),
    polylines: p.polylines.map((l) =>
      !chosen.has(l.id) ? l : { ...l, points: l.points.map(at) },
    ),
    masks: p.masks.map((m) =>
      !chosen.has(m.id)
        ? m
        : {
            ...m,
            origin: at(m.origin),
            rotation: angle(m.rotation),
            primitives: flipped
              ? m.primitives.map((q) => ({
                  ...q,
                  points: q.points.map(reflect),
                  ...(q.textRotation !== undefined
                    ? { textRotation: -q.textRotation }
                    : {}),
                }))
              : m.primitives,
          },
    ),
  };
  for (const b of next.bars.filter((b) => chosen.has(b.id)))
    if (geometry(b).errors.length)
      throw new Error(geometry(b).errors.join(' '));
  for (const a of next.annotations.filter((a) => chosen.has(a.id))) {
    const error = annotationError(a);
    if (error) throw new Error(error);
  }
  next = completeOwnership(next);
  assertLayerEdit(p, next, options.layerContext ?? 'model');
  assertVisibilityEdit(p, next, options.layerContext ?? 'model');
  if (options.scopeDetailId) assertDetailEdit(p, next, options.scopeDetailId);
  if (next.scheduleLock && scheduleChanged(next))
    next = { ...next, scheduleLock: undefined };
  return next;
}
