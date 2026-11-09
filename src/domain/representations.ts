import {
  stirrupPrimitives,
  stirrupDimensionLabels,
  displayedBarGeometry,
} from './stirrupGeometry';
import { geometry, sampled, rotate, format } from './geometry';
import { quantityLabel, assemblyLabel } from './detailQuantities';
import { barCaption } from './drafting';
import type { Bar, Detail, Point, Primitive, Project } from './types';
export function representationPoint(d: Detail, p: Point): Point {
  const v = rotate(
    {
      x: p.x * (d.scale ?? 1),
      y: p.y * (d.scale ?? 1) * (d.mirrored ? -1 : 1),
    },
    d.rotation ?? 0,
  );
  return { x: v.x + d.origin.x, y: v.y + d.origin.y };
}
export function representationPoints(b: Bar, d: Detail) {
  return sampled((displayedBarGeometry(b) ?? geometry(b)).segments).map((p) =>
    representationPoint(d, p),
  );
}
export function showsPhysicalDescription(p: Project, id: string) {
  return !p.details.some(
    (d) => d.barId === id && d.identification === 'primary',
  );
}
export function representationPrimitives(
  b: Bar,
  d: Detail,
  p: Project,
  paperHeight?: number,
): Primitive[] {
  const h = paperHeight ?? d.drafting?.height ?? 40;
  const text = (text: string, at: Point, layer: string): Primitive => ({
    layer,
    text,
    points: [representationPoint(d, at)],
    textHeight:
      (layer === 'COTAS'
        ? (paperHeight ?? d.drafting?.dimensionHeight ?? h)
        : h) * (d.scale ?? 1),
    textAlign: d.drafting?.align,
    textRotation: d.rotation ?? 0,
  });
  const out: Primitive[] = b.stirrupProfile
    ? stirrupPrimitives(
        b,
        (p) => representationPoint(d, p),
        d.scale ?? 1,
        !!d.mirrored,
      ).map((p) => ({ ...p, layer: 'REBATIMENTOS' }))
    : [{ layer: 'REBATIMENTOS', points: representationPoints(b, d) }];
  const mode = d.identification ?? 'legacy';
  if (
    d.label &&
    mode !== 'none' &&
    b.stirrupDisplay?.identification !== false
  ) {
    const mark =
      d.label.omitPrefix && b.mark.startsWith(d.label.omitPrefix)
        ? b.mark.slice(d.label.omitPrefix.length)
        : b.mark;
    out.push({
      layer: 'IDENTIFICACAO',
      points: [representationPoint(d, d.label.origin)],
      text:
        mode === 'mark'
          ? mark
          : barCaption(
              {
                ...b,
                mark,
                comment: undefined,
                columnLevel: undefined,
                showRibbed: false,
              },
              p,
            ),
      textHeight: d.label.height * (d.scale ?? 1),
      textRotation:
        d.label.rotation * (d.mirrored ? -1 : 1) + (d.rotation ?? 0),
      textAlign: 'center',
    });
  }
  if (mode !== 'none' && !d.label && b.stirrupDisplay?.identification !== false)
    out.push(
      text(
        mode === 'mark'
          ? b.mark
          : `${b.mark} - ${quantityLabel(p, b)} x %%c${b.diameter} - C=${format(geometry(b).length / 10)} cm${assemblyLabel(b) ? ` · ${assemblyLabel(b)}` : ''}`,
        { x: 0, y: -110 },
        'IDENTIFICACAO',
      ),
    );
  if (b.stirrupProfile) {
    if (d.showDimensions !== false && b.stirrupDisplay?.dimensions !== false)
      for (const v of stirrupDimensionLabels(b))
        out.push(text(v.text, v.at, 'COTAS'));
    return out;
  }
  const v = geometry(b).vertices;
  for (let i = 0; d.showDimensions !== false && i < v.length - 1; i++) {
    if (b.kind === 'stirrup' && ![3, 4].includes(i)) continue;
    const a = v[i],
      c = v[i + 1];
    out.push(
      text(
        format(Math.hypot(a.x - c.x, a.y - c.y) / 10),
        { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 + 40 },
        'COTAS',
      ),
    );
  }
  return out;
}
