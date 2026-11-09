import type { Bar, Geometry, Point, Segment } from './types';
export const add = (a: Point, b: Point): Point => ({
  x: a.x + b.x,
  y: a.y + b.y,
});
export const sub = (a: Point, b: Point): Point => ({
  x: a.x - b.x,
  y: a.y - b.y,
});
export const mul = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;
export const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x;
export const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y);
export const unit = (p: Point) => mul(p, 1 / (Math.hypot(p.x, p.y) || 1));
export const rotate = (p: Point, deg: number): Point => ({
  x:
    p.x * Math.cos((deg * Math.PI) / 180) -
    p.y * Math.sin((deg * Math.PI) / 180),
  y:
    p.x * Math.sin((deg * Math.PI) / 180) +
    p.y * Math.cos((deg * Math.PI) / 180),
});
export const world = (p: Point, bar: Pick<Bar, 'origin' | 'rotation'>) =>
  add(bar.origin, rotate(p, bar.rotation));
export const local = (p: Point, bar: Pick<Bar, 'origin' | 'rotation'>) =>
  rotate(sub(p, bar.origin), -bar.rotation);
const numberFormats = new Map<number, Intl.NumberFormat>();
export const format = (n: number, digits = 1) => {
  let formatter = numberFormats.get(digits);
  if (!formatter) {
    formatter = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    // Presentation only. Keep arbitrary API precisions from growing the cache.
    if (numberFormats.size < 32) numberFormats.set(digits, formatter);
  }
  return formatter.format(n);
};
export function vertices(bar: Bar): Point[] {
  if (bar.kind === 'free') return bar.points;
  const r = (bar.mandrel + bar.diameter) / 2;
  const h = (bar.hook + r * Math.tan((3 * Math.PI) / 8)) / Math.SQRT2;
  const points = [
    { x: h, y: h },
    { x: 0, y: 0 },
    { x: bar.width, y: 0 },
    { x: bar.width, y: bar.height },
    { x: 0, y: bar.height },
    { x: 0, y: 0 },
    { x: h, y: h },
  ];
  return bar.stirrupMirrored
    ? points.map((p) => ({ x: p.x, y: -p.y }))
    : points;
}
/** Physical centerline: trim straight legs by R tan(theta/2), then insert circular bends. */
export function geometry(bar: Bar): Geometry {
  const pts = vertices(bar);
  const errors: string[] = [];
  const segments: Segment[] = [];
  const r = (bar.mandrel + bar.diameter) / 2;
  if (pts.length < 2)
    return {
      segments,
      length: 0,
      errors: ['A barra precisa de ao menos dois vértices.'],
      vertices: pts,
    };
  const corners = pts.map((p, i) => {
    if (i === 0 || i === pts.length - 1)
      return { a: p, b: p, t: 0, angle: 0, center: p, startAngle: 0 };
    const u = unit(sub(p, pts[i - 1])),
      v = unit(sub(pts[i + 1], p));
    const angle = Math.atan2(cross(u, v), dot(u, v));
    if (Math.abs(angle) > Math.PI - 0.001)
      errors.push('Retorno de 180°: use dois cantos para definir a dobra.');
    const t = r * Math.tan(Math.abs(angle) / 2);
    const a = sub(p, mul(u, t)),
      b = add(p, mul(v, t));
    const center = add(a, mul({ x: -u.y, y: u.x }, Math.sign(angle) * r));
    return {
      a,
      b,
      t,
      angle,
      center,
      startAngle: Math.atan2(a.y - center.y, a.x - center.x),
    };
  });
  let length = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const len = distance(pts[i], pts[i + 1]);
    if (len < 0.01) errors.push(`Trecho ${i + 1} com comprimento nulo.`);
    if (corners[i].t + corners[i + 1].t > len + 0.001)
      errors.push(`Trecho ${i + 1} insuficiente para o diâmetro de dobra.`);
    segments.push({ type: 'line', a: corners[i].b, b: corners[i + 1].a });
    length += Math.max(0, len - corners[i].t - corners[i + 1].t);
    const c = corners[i + 1];
    if (Math.abs(c.angle) > 1e-8) {
      segments.push({
        type: 'arc',
        a: c.a,
        b: c.b,
        center: c.center,
        radius: r,
        angle: c.angle,
        startAngle: c.startAngle,
      });
      length += r * Math.abs(c.angle);
    }
  }
  return { segments, length, errors: [...new Set(errors)], vertices: pts };
}
export function sampled(segments: Segment[], step = Math.PI / 24): Point[] {
  const out: Point[] = [];
  for (const s of segments) {
    if (!out.length) out.push(s.a);
    if (s.type === 'line') out.push(s.b);
    else {
      const n = Math.max(1, Math.ceil(Math.abs(s.angle) / step));
      for (let i = 1; i <= n; i++) {
        const a = s.startAngle + (s.angle * i) / n;
        out.push(
          add(s.center, {
            x: s.radius * Math.cos(a),
            y: s.radius * Math.sin(a),
          }),
        );
      }
    }
  }
  return out;
}
export function path(segments: Segment[]): string {
  return segments
    .map(
      (s, i) =>
        `${i === 0 ? `M ${s.a.x} ${s.a.y} ` : ''}${s.type === 'line' ? `L ${s.b.x} ${s.b.y}` : `A ${s.radius} ${s.radius} 0 ${Math.abs(s.angle) > Math.PI ? 1 : 0} ${s.angle > 0 ? 1 : 0} ${s.b.x} ${s.b.y}`}`,
    )
    .join(' ');
}
export function bounds(points: Point[]) {
  if (!points.length) return { x: 0, y: 0, width: 1000, height: 1000 };
  let x = Infinity,
    y = Infinity,
    right = -Infinity,
    top = -Infinity;
  for (const p of points) {
    x = Math.min(x, p.x);
    y = Math.min(y, p.y);
    right = Math.max(right, p.x);
    top = Math.max(top, p.y);
  }
  return { x, y, width: right - x, height: top - y };
}
export function nearest(p: Point, a: Point, b: Point): Point {
  const d = sub(b, a),
    t = Math.max(0, Math.min(1, dot(sub(p, a), d) / (dot(d, d) || 1)));
  return add(a, mul(d, t));
}
export function intersection(
  a: Point,
  b: Point,
  c: Point,
  d: Point,
): Point | null {
  const u = sub(b, a),
    v = sub(d, c),
    den = cross(u, v);
  if (Math.abs(den) < 1e-8) return null;
  const t = cross(sub(c, a), v) / den,
    s = cross(sub(c, a), u) / den;
  return t >= 0 && t <= 1 && s >= 0 && s <= 1 ? add(a, mul(u, t)) : null;
}
/** Intersection of two offset lines, using unit directions and a signed left distance. */
export function offsetMiterPoint(
  p: Point,
  u: Point,
  v: Point,
  signed: number,
): Point {
  const denominator = 1 + dot(u, v);
  if (denominator < 1e-12)
    throw new Error('Retorno de 180°: junção paralela indefinida.');
  return add(p, mul({ x: -u.y - v.y, y: u.x + v.x }, signed / denominator));
}
/** Offset a polygon towards its interior or an open chain to its left. Reject intersections. */
export function offsetChain(
  raw: Point[],
  distanceMm: number,
  closed: boolean,
): Point[] {
  const pts = raw.filter((p, i) => i === 0 || distance(p, raw[i - 1]) > 0.001);
  if (closed && pts.length > 1 && distance(pts[0], pts.at(-1)!) < 0.001)
    pts.pop();
  if (pts.length < (closed ? 3 : 2))
    throw new Error('Selecione um contorno com pelo menos dois segmentos.');
  let signed = distanceMm;
  if (closed) {
    const area = pts.reduce(
      (s, p, i) => s + cross(p, pts[(i + 1) % pts.length]),
      0,
    );
    signed *= Math.sign(area) || 1;
  }
  const lines = pts
    .slice(0, closed ? pts.length : pts.length - 1)
    .map((p, i) => {
      const q = pts[(i + 1) % pts.length],
        u = unit(sub(q, p)),
        v = mul({ x: -u.y, y: u.x }, signed);
      return { a: add(p, v), b: add(q, v) };
    });
  const out = pts.map((p, i) => {
    if (!closed && i === 0) return lines[0].a;
    if (!closed && i === pts.length - 1) return lines.at(-1)!.b;
    const l = lines[(i - 1 + lines.length) % lines.length],
      m = lines[i % lines.length];
    const u = sub(l.b, l.a),
      v = sub(m.b, m.a),
      den = cross(u, v);
    if (Math.abs(den) < 1e-8) return m.a;
    const q = offsetMiterPoint(p, unit(u), unit(v), signed);
    if (distance(q, p) > Math.abs(signed) * 20 + 0.01)
      throw new Error('Canto muito agudo para este cobrimento.');
    return q;
  });
  for (let i = 0; i < lines.length; i++) {
    const j = (i + 1) % out.length;
    if (dot(sub(out[j], out[i]), sub(lines[i].b, lines[i].a)) <= 0)
      throw new Error('Cobrimento excessivo para este contorno.');
  }
  for (let i = 0; i < lines.length; i++)
    for (let j = i + 2; j < lines.length; j++) {
      if (closed && i === 0 && j === lines.length - 1) continue;
      if (
        intersection(
          out[i],
          out[(i + 1) % out.length],
          out[j],
          out[(j + 1) % out.length],
        )
      )
        throw new Error('O contorno deslocado cruza a si mesmo.');
    }
  return closed ? [...out, { ...out[0] }] : out;
}
