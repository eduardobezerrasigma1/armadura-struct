import { stylePrimitive } from './layers';
import { layerState } from './layerProfiles';
import { z } from 'zod';
import type { Annotation, Mask, Point, Primitive, Project } from './types';
import { maskPoint } from '../cad/import';
import { localMaskPoint } from './nativeMasks';
import { maskCadEntities, hitMaskCadEntity } from './maskCadEditing';
import type { MaskDrawingContext } from './maskDrawing';
export const dimensionPresentationSchema = z
  .object({
    unit: z.enum(['mm', 'cm', 'm']),
    precision: z.number().int().min(0).max(6),
  })
  .strict();
export type DimensionPresentation = z.infer<typeof dimensionPresentationSchema>;
const coordinate = z.number().finite().min(-1e9).max(1e9);
export const maskDimensionReferencesSchema = z
  .array(
    z
      .object({
        pointIndex: z.union([z.literal(0), z.literal(1)]),
        maskId: z.string().min(1).max(200),
        entityId: z.string().min(1).max(200).optional(),
        index: z.number().int().min(0).max(99999),
        local: z.object({ x: coordinate, y: coordinate }).strict(),
        signature: z.string().regex(/^[0-9a-f]{16}$/),
      })
      .strict(),
  )
  .min(1)
  .max(2)
  .refine(
    (v) => new Set(v.map((r) => r.pointIndex)).size === v.length,
    'Referências repetidas.',
  );
export type MaskDimensionReference = z.infer<
  typeof maskDimensionReferencesSchema
>[number];
export const dimensionTool = (t: string) =>
  t === 'measure' || t === 'dimension-aligned' || t === 'dimension-orthogonal';
export function measuredDistance(a: Point, b: Point) {
  if (
    ![a.x, a.y, b.x, b.y].every((n) => Number.isFinite(n) && Math.abs(n) <= 1e9)
  )
    throw new Error('Informe pontos finitos dentro dos limites do modelo.');
  const dx = b.x - a.x,
    dy = b.y - a.y;
  return { distance: Math.hypot(dx, dy), dx, dy };
}
export function formatDimension(mm: number, options: DimensionPresentation) {
  const o = dimensionPresentationSchema.parse(options);
  return `${(mm / { mm: 1, cm: 10, m: 1000 }[o.unit]).toLocaleString('pt-BR', { minimumFractionDigits: o.precision, maximumFractionDigits: o.precision, useGrouping: false })} ${o.unit}`;
}
/** Diagnostic tolerance only. Geometry is never rounded or rewritten by this fingerprint. */
function geometrySignature(q: Primitive, scale: number) {
  const pt = (p: Point) => [
    Math.round(p.x * scale * 1e4),
    Math.round(p.y * scale * 1e4),
  ];
  const n = q.native;
  const value = n
    ? n.kind === 'circle' || n.kind === 'arc'
      ? [
          n.kind,
          pt(n.center),
          Math.round(n.radius * scale * 1e4),
          n.kind === 'arc' ? [n.startAngle, n.sweepAngle] : null,
        ]
      : [n.kind, n.closed, n.points.map(pt)]
    : [q.points.map(pt), !!q.closed];
  const s = JSON.stringify(value);
  let a = 2166136261,
    b = 0x9e3779b9;
  for (let i = 0; i < s.length; i++) {
    a = Math.imul(a ^ s.charCodeAt(i), 16777619);
    b = Math.imul(b ^ s.charCodeAt(i), 2246822519);
  }
  return (
    (a >>> 0).toString(16).padStart(8, '0') +
    (b >>> 0).toString(16).padStart(8, '0')
  );
}
export function captureMaskReference(
  p: Project,
  ctx: MaskDrawingContext,
  maskId: string | undefined,
  at: Point,
  pointIndex: 0 | 1,
): MaskDimensionReference | undefined {
  const all = maskCadEntities(p, ctx).filter(
    (e) =>
      e.mask.id === maskId &&
      layerState(
        p,
        ctx.key,
        e.ref.primitive.layerId ??
          stylePrimitive(p, e.mask, e.ref.primitive).layerId!,
      ).capture &&
      p.hierarchy.objectDetails[e.mask.id] === ctx.detailId,
  );
  const hit = hitMaskCadEntity(all, at, 1e-4);
  if (!hit) return;
  return {
    pointIndex,
    maskId: hit.mask.id,
    entityId: hit.ref.id,
    index: hit.ref.index,
    local: localMaskPoint(at, hit.mask),
    signature: geometrySignature(hit.ref.primitive, hit.mask.scale),
  };
}
export function dimensionReferenceIssue(
  p: Project,
  a: Annotation,
): string | undefined {
  for (const r of a.maskReferences ?? []) {
    const m = p.masks.find((m) => m.id === r.maskId);
    const q =
      m &&
      (r.entityId
        ? m.primitives.find((q) => q.id === r.entityId)
        : m.primitives[r.index]);
    if (
      !m ||
      !q ||
      p.hierarchy.objectDetails[m.id] !== p.hierarchy.objectDetails[a.id]
    )
      return 'Referência de máscara ausente ou em outro detalhamento. Cota estática: revise as referências.';
    const at = maskPoint(r.local, m),
      old = a.points[r.pointIndex];
    if (
      geometrySignature(q, m.scale) !== r.signature ||
      Math.hypot(at.x - old.x, at.y - old.y) > 1e-4
    )
      return 'Referência de máscara alterada. Cota estática: revise as referências; o valor não acompanha a geometria.';
  }
}
export function remapDimensionMasks<
  T extends { maskReferences?: MaskDimensionReference[] },
>(a: T, ids: Record<string, string>): T {
  return a.maskReferences
    ? {
        ...a,
        maskReferences: a.maskReferences.map((r) => ({
          ...r,
          maskId: ids[r.maskId] ?? r.maskId,
        })),
      }
    : a;
}
export function scaleDimensionReferences(a: Annotation, k: number) {
  return a.maskReferences?.map((r) => ({
    ...r,
    local: { x: r.local.x * k, y: r.local.y * k },
  }));
}
