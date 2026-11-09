import { stirrupPrimitives, stirrupDimensionLabels } from './stirrupGeometry';
import { styledDrafting } from './cadDefaults';
import { stylePrimitive } from './layers';
import {
  representationPrimitives,
  showsPhysicalDescription,
} from './representations';
import { quantityLabel, detailTitle, assemblyLabel } from './detailQuantities';
import { format, geometry, sampled, world, bounds } from './geometry';
import { maskPrimitives } from '../cad/import';
import {
  annotationPrimitives,
  distributionPrimitives,
  repeatedGeometry,
} from './drafting';
import type { Bar, Point, Primitive, Project } from './types';

/** Content heights are model mm; camera zoom never participates. */
export function physicalBarTextPrimitives(
  b: Bar,
  p: Project,
  paperHeight?: number,
): Primitive[] {
  const h = paperHeight ?? b.drafting?.height ?? 40,
    offset = (legacy: number, factor: number) =>
      paperHeight === undefined ? legacy : h * factor;
  const text = (
    text: string,
    at: Point,
    layer: string,
    align: 'left' | 'center' | 'right' = b.drafting?.align ?? 'left',
  ): Primitive => ({
    layer,
    text,
    points: [world(at, b)],
    textHeight:
      layer === 'COTAS' ? (paperHeight ?? b.drafting?.dimensionHeight ?? h) : h,
    textRotation: b.rotation,
    textAlign: align,
  });
  const out: Primitive[] = [];
  if (
    b.stirrupDisplay?.identification !== false &&
    showsPhysicalDescription(p, b.id)
  )
    out.push(
      text(
        `${b.mark} - ${quantityLabel(p, b)} x %%c${b.diameter} - C=${format(geometry(b).length / 10)} cm${assemblyLabel(b) ? ` · ${assemblyLabel(b)}` : ''}`,
        { x: 0, y: -offset(100, 1.8) },
        'IDENTIFICACAO',
      ),
    );
  if (b.stirrupProfile && b.stirrupDisplay?.dimensions !== false) {
    for (const d of stirrupDimensionLabels(b))
      out.push(text(d.text, d.at, 'COTAS', 'center'));
  }
  if (b.kind === 'stirrup' && !b.stirrupProfile)
    out.push(
      text(
        format(b.width / 10),
        { x: b.width / 2, y: b.height + offset(45, 1.1) },
        'COTAS',
        'center',
      ),
      text(
        format(b.height / 10),
        { x: -offset(60, 1.2), y: b.height / 2 },
        'COTAS',
        'center',
      ),
    );
  return out;
}

export function drawingPrimitives(
  p: Project,
  references: Project = p,
  options: { minTextHeight?: number } = {},
): Primitive[] {
  const h = options.minTextHeight ?? 40;
  const lines = p.masks.flatMap((m) =>
    maskPrimitives(m).map((l) => stylePrimitive(references, m, l)),
  );
  lines.push(
    ...p.polylines.map((l) =>
      stylePrimitive(references, l, { ...l, layer: 'DESENHO' }),
    ),
    ...p.annotations.flatMap((a) =>
      annotationPrimitives(
        {
          ...a,
          textHeight: options.minTextHeight ?? a.textHeight,
        },
        references,
      ).map((item) => stylePrimitive(references, a, item)),
    ),
  );
  const label = (text: string, at: Point, layer: string) => ({
    layer,
    points: [at],
    text,
    textHeight: h,
  });
  for (const b of p.bars) {
    const start = lines.length;
    if (b.distribution?.render === 'bars') lines.push(...repeatedGeometry(b));
    else if (b.stirrupProfile) lines.push(...stirrupPrimitives(b));
    else
      lines.push({
        layer: 'ARMADURAS',
        points: sampled(geometry(b).segments).map((v) => world(v, b)),
      });
    lines.push(
      ...physicalBarTextPrimitives(b, references, options.minTextHeight),
    );
    lines.push(...distributionPrimitives(b, options.minTextHeight, references));
    for (let i = start; i < lines.length; i++)
      lines[i] = styledDrafting(references, b, lines[i], 'ARMADURAS');
  }
  for (const d of p.details) {
    const b = references.bars.find((b) => b.id === d.barId);
    if (b)
      lines.push(
        ...representationPrimitives(
          b,
          d,
          references,
          options.minTextHeight,
        ).map((item) => styledDrafting(references, d, item, 'REBATIMENTOS')),
      );
  }
  for (const d of p.hierarchy.details.filter((d) => d.repetition)) {
    const bars = p.bars.filter((b) => p.hierarchy.objectDetails[b.id] === d.id);
    if (!bars.length) continue;
    const box = bounds(
      bars.flatMap((b) => geometry(b).vertices.map((v) => world(v, b))),
    );
    lines.push(
      label(
        detailTitle(references, d.id),
        { x: box.x, y: box.y + box.height + h * 2 },
        'IDENTIFICACAO',
      ),
    );
  }
  return lines;
}

export function objectPrimitives(p: Project, ids: string[]): Primitive[] {
  const set = new Set(ids);
  return drawingPrimitives(
    {
      ...p,
      bars: p.bars.filter((o) => set.has(o.id)),
      details: p.details.filter((o) => set.has(o.id)),
      annotations: p.annotations.filter((o) => set.has(o.id)),
      polylines: p.polylines.filter((o) => set.has(o.id)),
      masks: p.masks.filter((o) => set.has(o.id)),
    },
    p,
  );
}
