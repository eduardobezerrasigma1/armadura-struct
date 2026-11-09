import { stirrupPrimitives } from './stirrupGeometry';
import { dimensionReferenceIssue, formatDimension } from './maskDimensions';
import {
  add,
  rotate,
  sub,
  mul,
  unit,
  dot,
  distance,
  format,
  geometry,
  world,
  sampled,
} from './geometry';
import { quantityLabel, assemblyLabel } from './detailQuantities';
import type { Annotation, Bar, Point, Primitive, Project } from './types';

const line = (points: Point[], layer = 'COTAS'): Primitive => ({
  layer,
  points,
});
const text = (
  value: string,
  at: Point,
  height: number,
  angle = 0,
  layer = 'COTAS',
): Primitive => ({
  layer,
  points: [at],
  text: value,
  textHeight: height,
  textRotation: angle,
});
const normal = (u: Point) => ({ x: -u.y, y: u.x });
const angleOf = (u: Point) => {
  let angle = (Math.atan2(u.y, u.x) * 180) / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  return angle;
};
export function barCaption(b: Bar, project?: Project) {
  return `${quantityLabel(project, b)} ${b.mark} Ø${format(b.diameter, b.diameter % 1 ? 1 : 0)} C=${format(geometry(b).length / 10, 0)}${assemblyLabel(b) ? ` · ${assemblyLabel(b)}` : ''}`;
}
function tick(at: Point, u: Point, height: number, layer = 'COTAS') {
  const diagonal = mul(add(u, normal(u)), height * 0.25);
  return line([sub(at, diagonal), add(at, diagonal)], layer);
}
export function arcThrough(a: Point, m: Point, b: Point): Point[] | null {
  const x = sub(m, a),
    y = sub(b, a),
    den = 2 * (x.x * y.y - x.y * y.x);
  if (Math.abs(den) < 1e-8) return null;
  const xx = dot(x, x),
    yy = dot(y, y);
  const center = add(a, {
    x: (xx * y.y - yy * x.y) / den,
    y: (x.x * yy - y.x * xx) / den,
  });
  const radius = distance(a, center);
  const start = Math.atan2(a.y - center.y, a.x - center.x);
  const mid = Math.atan2(m.y - center.y, m.x - center.x);
  const end = Math.atan2(b.y - center.y, b.x - center.x);
  const positive = (n: number) => (n + Math.PI * 4) % (Math.PI * 2);
  const sweep =
    positive(mid - start) <= positive(end - start)
      ? positive(end - start)
      : positive(end - start) - Math.PI * 2;
  return Array.from({ length: 49 }, (_, i) =>
    add(center, {
      x: radius * Math.cos(start + (sweep * i) / 48),
      y: radius * Math.sin(start + (sweep * i) / 48),
    }),
  );
}
export function annotationError(a: Annotation): string | undefined {
  if (a.kind === 'dimension-orthogonal' && a.frameRotation)
    return annotationError({
      ...a,
      frameRotation: undefined,
      points: a.points.map((v) =>
        add(a.points[0], rotate(sub(v, a.points[0]), -a.frameRotation!)),
      ),
    });
  const [p, q, r] = a.points;
  if (distance(p, q) < 0.01)
    return 'Os dois primeiros pontos da anotação precisam ser distintos.';
  if (a.kind === 'section-arc' && !arcThrough(p, q, r))
    return 'Os três pontos do arco não podem estar alinhados.';
  if (a.kind === 'dimension-orthogonal') {
    const mid = mul(add(p, q), 0.5),
      span =
        Math.abs(r.y - mid.y) + 1e-8 >= Math.abs(r.x - mid.x)
          ? Math.abs(q.x - p.x)
          : Math.abs(q.y - p.y);
    if (span < 0.01)
      return 'Posicione a cota do outro lado para medir uma projeção diferente de zero.';
  }
}
/** Conservative text bounds for fit-to-view; exported drawings use the same anchors. */
export function primitiveBounds(p: Primitive): Point[] {
  if (!p.text || !p.points.length) return p.points;
  const anchor = p.points[0],
    h = p.textHeight ?? 50,
    w = p.text.length * h * 0.65;
  const centered = ['COTAS', 'DISTRIBUICAO'].includes(p.role ?? p.layer),
    left =
      p.textAlign === 'right'
        ? -w
        : p.textAlign === 'center' || (!p.textAlign && centered)
          ? -w / 2
          : 0;
  const angle = ((p.textRotation ?? 0) * Math.PI) / 180;
  return [
    { x: left, y: -h * 0.3 },
    { x: left + w, y: -h * 0.3 },
    { x: left + w, y: h },
    { x: left, y: h },
  ].map((v) =>
    add(anchor, {
      x: v.x * Math.cos(angle) - v.y * Math.sin(angle),
      y: v.x * Math.sin(angle) + v.y * Math.cos(angle),
    }),
  );
}
function rawAnnotationPrimitives(a: Annotation, project: Project): Primitive[] {
  if (a.kind === 'dimension-orthogonal' && a.frameRotation) {
    const origin = a.points[0],
      angle = a.frameRotation;
    return annotationPrimitives(
      {
        ...a,
        frameRotation: undefined,
        points: a.points.map((v) =>
          add(origin, rotate(sub(v, origin), -angle)),
        ),
      },
      project,
    ).map((v) => ({
      ...v,
      points: v.points.map((p) => add(origin, rotate(sub(p, origin), angle))),
      ...(v.text ? { textRotation: (v.textRotation ?? 0) + angle } : {}),
    }));
  }
  const [p, q, r] = a.points;
  const h = a.textHeight;
  const bar = project.bars.find((b) => b.id === a.barId);
  if (a.kind.startsWith('dimension-')) {
    let start = p,
      end = q,
      axis = unit(sub(q, p));
    if (a.kind === 'dimension-orthogonal') {
      const mid = mul(add(p, q), 0.5);
      if (Math.abs(r.y - mid.y) + 1e-8 >= Math.abs(r.x - mid.x)) {
        axis = { x: 1, y: 0 };
        start = { x: p.x, y: r.y };
        end = { x: q.x, y: r.y };
      } else {
        axis = { x: 0, y: 1 };
        start = { x: r.x, y: p.y };
        end = { x: r.x, y: q.y };
      }
    } else {
      const n = normal(axis),
        offset = dot(sub(r, p), n);
      start = add(p, mul(n, offset));
      end = add(q, mul(n, offset));
    }
    const n = normal(axis);
    return [
      line([p, start]),
      line([q, end]),
      line([start, end]),
      tick(start, axis, h),
      tick(end, axis, h),
      text(
        (dimensionReferenceIssue(project, a) ? '[REFERÊNCIA ALTERADA] ' : '') +
          (a.label ||
            (a.dimensionPresentation
              ? formatDimension(distance(start, end), a.dimensionPresentation)
              : format(distance(start, end) / 10, 1))),
        add(mul(add(start, end), 0.5), mul(n, h * 0.55)),
        h,
        angleOf(axis),
      ),
      ...(bar
        ? [
            text(
              barCaption(bar, project),
              add(mul(add(start, end), 0.5), mul(n, -h * 1.25)),
              h,
              angleOf(axis),
            ),
          ]
        : []),
    ];
  }
  if (a.kind === 'leader') {
    const u = unit(sub(q, p)),
      n = normal(u);
    return [
      line([p, q, r], 'CHAMADAS'),
      line(
        [
          add(p, add(mul(u, h * 0.6), mul(n, h * 0.2))),
          p,
          add(p, sub(mul(u, h * 0.6), mul(n, h * 0.2))),
        ],
        'CHAMADAS',
      ),
      text(
        a.label || (bar ? barCaption(bar, project) : 'Chamada'),
        add(r, { x: h * 0.3, y: h * 0.3 }),
        h,
        0,
        'CHAMADAS',
      ),
    ];
  }
  const caption = a.label || (bar ? barCaption(bar, project) : 'A');
  if (a.kind === 'section-arc') {
    const points = arcThrough(p, q, r) ?? [p, q, r];
    const tangent = unit(sub(points[1], points[0]));
    return [
      line(points, 'CORTES'),
      tick(p, tangent, h, 'CORTES'),
      tick(r, unit(sub(points.at(-1)!, points.at(-2)!)), h, 'CORTES'),
      text(caption, add(q, { x: h * 0.4, y: h * 0.5 }), h, 0, 'CORTES'),
    ];
  }
  const u = unit(sub(q, p)),
    n = normal(u);
  return [
    line([p, q], 'CORTES'),
    line([add(p, mul(n, -h * 0.45)), add(p, mul(n, h * 0.45))], 'CORTES'),
    line([add(q, mul(n, -h * 0.45)), add(q, mul(n, h * 0.45))], 'CORTES'),
    line([mul(add(p, q), 0.5), r], 'CHAMADAS'),
    text(caption, add(r, { x: h * 0.3, y: h * 0.3 }), h, 0, 'CHAMADAS'),
  ];
}
export function distributionStart(b: Bar) {
  return b.distribution?.start ?? b.origin;
}
export function distributionStep(b: Bar): number {
  if (!b.distribution) return 0;
  return b.quantitySource.kind === 'distribution' &&
    b.quantitySource.mode === 'spacing' &&
    b.quantitySource.fit === 'fixed'
    ? b.quantitySource.spacing
    : distance(distributionStart(b), b.distribution.end) /
        Math.max(1, b.quantity - 1);
}
export function distributionOrigins(b: Bar, limit = 200): Point[] {
  if (!b.distribution) return [b.origin];
  const count = Math.min(b.quantity, limit),
    start = distributionStart(b);
  return Array.from({ length: count }, (_, i) => {
    const index = Math.round((i * (b.quantity - 1)) / Math.max(1, count - 1));
    return add(
      start,
      mul(unit(sub(b.distribution!.end, start)), index * distributionStep(b)),
    );
  });
}
export function distributionPrimitives(
  b: Bar,
  paperTextHeight?: number,
  project?: Project,
): Primitive[] {
  if (!b.distribution) return [];
  const start = distributionStart(b),
    physicalEnd = b.distribution.end,
    u = unit(sub(physicalEnd, start)),
    end = add(start, mul(u, distributionStep(b) * Math.max(0, b.quantity - 1))),
    n = normal(u),
    h = paperTextHeight ?? b.drafting?.distributionHeight ?? 50;
  const shift = mul(n, b.distribution.annotationOffset ?? 0),
    graphicStart = add(start, shift),
    graphicEnd = add(end, shift);
  const pts = distributionOrigins(b).map((p) => add(p, shift));
  const result = [
    ...(b.distribution.annotationOffset
      ? [
          line([start, graphicStart], 'DISTRIBUICAO'),
          line([end, graphicEnd], 'DISTRIBUICAO'),
        ]
      : []),
    line([graphicStart, graphicEnd], 'DISTRIBUICAO'),
    ...pts.map((p) =>
      line([sub(p, mul(n, h / 2)), add(p, mul(n, h / 2))], 'DISTRIBUICAO'),
    ),
  ];
  result.push(
    text(
      `${quantityLabel(project, b)} ${b.mark}${b.stirrupProfile ? ` Ø${format(b.diameter, 1)}` : ''} c/${format(distributionStep(b) / 10, 1)}${b.stirrupProfile ? ' cm' : ''}${b.quantity > 200 ? ' (vista abreviada)' : ''}`,
      add(mul(add(graphicStart, graphicEnd), 0.5), mul(n, h * 1.3)),
      h,
      angleOf(u),
      'DISTRIBUICAO',
    ),
  );
  return result;
}
export function repeatedGeometry(b: Bar, limit = 2000): Primitive[] {
  if (b.quantity > limit)
    throw new Error(
      `${b.mark}: exportação de estribos repetidos limitada a ${limit} peças por faixa. Use a representação por traços.`,
    );
  if (b.stirrupProfile)
    return distributionOrigins(b, limit).flatMap((origin) =>
      stirrupPrimitives({ ...b, origin }),
    );
  return distributionOrigins(b, limit).map((origin) => ({
    layer: 'ARMADURAS',
    points: sampled(geometry(b).segments).map((v) =>
      world(v, { ...b, origin }),
    ),
  }));
}

export function annotationPrimitives(
  a: Annotation,
  project: Project,
): Primitive[] {
  return rawAnnotationPrimitives(a, project).map((q) =>
    q.text && a.drafting?.align ? { ...q, textAlign: a.drafting.align } : q,
  );
}
