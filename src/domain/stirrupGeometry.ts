import type { Bar, Geometry, Point, Segment, Primitive } from './types';
import {
  add,
  sub,
  mul,
  unit,
  rotate,
  distance,
  geometryFromPoints,
  sampled,
  world,
} from './geometry';
import type { StirrupProfile } from './stirrupSchema';

export function stirrupEnvelope(b: Bar) {
  const p = b.stirrupProfile;
  const inset = p?.reference === 'concrete' ? p.cover + b.diameter / 2 : 0;
  return { width: b.width - 2 * inset, height: b.height - 2 * inset, inset };
}
const reverse = (s: Segment): Segment =>
  s.type === 'line'
    ? { ...s, a: s.b, b: s.a }
    : {
        ...s,
        a: s.b,
        b: s.a,
        startAngle: s.startAngle + s.angle,
        angle: -s.angle,
      };
const startTangent = (s: Segment) =>
  s.type === 'line'
    ? unit(sub(s.b, s.a))
    : rotate(
        { x: 1, y: 0 },
        ((s.startAngle + (Math.sign(s.angle) * Math.PI) / 2) * 180) / Math.PI,
      );
const endTangent = (s: Segment) =>
  s.type === 'line'
    ? unit(sub(s.b, s.a))
    : rotate(
        { x: 1, y: 0 },
        ((s.startAngle + s.angle + (Math.sign(s.angle) * Math.PI) / 2) * 180) /
          Math.PI,
      );
export function hookGeometry(
  at: Point,
  u: Point,
  h: StirrupProfile['start'],
  b: Pick<Bar, 'diameter' | 'mandrel'>,
): Segment[] {
  if (!h.angle) return [];
  const r = (b.mandrel + b.diameter) / 2,
    theta = (h.turn * h.angle * Math.PI) / 180;
  const center = add(at, mul({ x: -u.y, y: u.x }, h.turn * r));
  const startAngle = Math.atan2(at.y - center.y, at.x - center.x);
  const end = add(center, rotate(sub(at, center), (theta * 180) / Math.PI));
  const length = h.mode === 'diameters' ? h.length * b.diameter : h.length;
  return [
    { type: 'arc', a: at, b: end, center, radius: r, startAngle, angle: theta },
    ...(length
      ? [
          {
            type: 'line' as const,
            a: end,
            b: add(end, mul(rotate(u, (theta * 180) / Math.PI), length)),
          },
        ]
      : []),
  ];
}
function selfIntersects(ps: Point[], closed: boolean) {
  const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x;
  const count = closed ? ps.length : ps.length - 1;
  for (let i = 0; i < count; i++)
    for (let j = i + 2; j < count; j++) {
      if (closed && i === 0 && j === count - 1) continue;
      const a = ps[i],
        b = ps[(i + 1) % ps.length],
        c = ps[j],
        d = ps[(j + 1) % ps.length];
      const u = sub(b, a),
        v = sub(d, c),
        den = cross(u, v);
      if (Math.abs(den) < 1e-9) {
        if (Math.abs(cross(sub(c, a), u)) < 1e-7) {
          const t = (p: Point) =>
            (sub(p, a).x * u.x + sub(p, a).y * u.y) / (u.x * u.x + u.y * u.y);
          if (
            Math.max(Math.min(t(c), t(d)), 0) <=
            Math.min(Math.max(t(c), t(d)), 1) + 1e-9
          )
            return true;
        }
        continue;
      }
      const t = cross(sub(c, a), v) / den,
        s = cross(sub(c, a), u) / den;
      if (t >= -1e-9 && t <= 1 + 1e-9 && s >= -1e-9 && s <= 1 + 1e-9)
        return true;
    }
  return false;
}
/** New family only. Legacy stirrups keep their original vertices/length unchanged. */
export function stirrupGeometry(b: Bar, bodyOnly = false): Geometry {
  const p = b.stirrupProfile!;
  const { width: w, height: h, inset } = stirrupEnvelope(b),
    r = (b.mandrel + b.diameter) / 2;
  let body: Segment[] = [],
    errors: string[] = [];
  if (b.kind !== 'stirrup')
    errors.push('Perfil de estribo exige família estribo.');
  if (b.width > 100000 || b.height > 100000)
    errors.push('Dimensões da seção limitadas a 100.000 mm.');
  if (p.shape === 'free' && p.reference !== 'axis')
    errors.push(
      'Forma livre usa pontos no eixo; não deriva cobrimento automaticamente.',
    );
  if (p.shape === 'circle') {
    const radius = w / 2;
    if (!(radius >= r))
      errors.push('Raio do eixo menor que o raio de dobra informado.');
    const sweep = ((p.closed ? 360 : 360 - p.gapAngle) * Math.PI) / 180;
    for (let i = 0; i < 2; i++) {
      const a = (i * sweep) / 2,
        angle = sweep / 2;
      body.push({
        type: 'arc',
        a: { x: radius * Math.cos(a), y: radius * Math.sin(a) },
        b: { x: radius * Math.cos(a + angle), y: radius * Math.sin(a + angle) },
        center: { x: 0, y: 0 },
        radius,
        startAngle: a,
        angle,
      });
    }
  } else {
    let points =
      p.shape === 'rectangle'
        ? [
            { x: 0, y: 0 },
            { x: w, y: 0 },
            { x: w, y: h },
            { x: 0, y: h },
          ]
        : p.points;
    if (p.shape === 'rectangle' && (!(w > 0) || !(h > 0)))
      errors.push(
        'Seção/cobrimento incompatíveis: envelope do eixo não positivo.',
      );
    if (points.length < (p.closed ? 3 : 2))
      errors.push('Forma fechada exige três vértices; aberta exige dois.');
    if (points.some((q, i) => i > 0 && distance(q, points[i - 1]) < 0.01))
      errors.push('Há vértices repetidos na forma.');
    if (p.closed && distance(points[0], points.at(-1)!) < 0.01)
      errors.push('Não repita o primeiro vértice: o fechamento é automático.');
    if (selfIntersects(points, p.closed))
      errors.push('O contorno cruza ou sobrepõe a si mesmo.');
    if (p.closed) {
      const mid = mul(add(points[0], points[1]), 0.5);
      points = [mid, ...points.slice(1), points[0], mid];
    }
    if (p.shape === 'rectangle')
      points = points.map((q) => add(q, { x: inset, y: inset }));
    const g = geometryFromPoints(points, r);
    body = g.segments;
    errors.push(...g.errors);
  }
  let segments = body;
  if (body.length && !bodyOnly) {
    const start = hookGeometry(
      body[0].a,
      mul(startTangent(body[0]), -1),
      p.start,
      b,
    );
    const end = hookGeometry(
      body.at(-1)!.b,
      endTangent(body.at(-1)!),
      p.end,
      b,
    );
    segments = [...start.reverse().map(reverse), ...body, ...end];
  }
  if (b.stirrupMirrored) {
    const flip = (q: Point) => ({ x: q.x, y: -q.y });
    segments = segments.map((s) =>
      s.type === 'line'
        ? { ...s, a: flip(s.a), b: flip(s.b) }
        : {
            ...s,
            a: flip(s.a),
            b: flip(s.b),
            center: flip(s.center),
            startAngle: -s.startAngle,
            angle: -s.angle,
          },
    );
  }
  const length = segments.reduce(
    (n, s) =>
      n +
      (s.type === 'line' ? distance(s.a, s.b) : Math.abs(s.angle) * s.radius),
    0,
  );
  if (!Number.isFinite(length) || length <= 0)
    errors.push('Comprimento inválido para a forma.');
  return {
    segments,
    length,
    errors: [...new Set(errors)],
    vertices: sampled(segments),
  };
}
export const displayedBarGeometry = (b: Bar) =>
  b.stirrupProfile && b.stirrupDisplay?.hooks === false
    ? stirrupGeometry(b, true)
    : b.stirrupProfile
      ? stirrupGeometry(b)
      : undefined;
/** Shared render chain. Analytic arc data is retained for CAD export; display chords <=0.05 mm. */
export function stirrupPrimitives(
  b: Bar,
  transform: (p: Point) => Point = (p) => world(p, b),
  scale = 1,
  mirrored = false,
): Primitive[] {
  const g = displayedBarGeometry(b)!;
  return g.segments.map((s) => {
    if (s.type === 'line')
      return { layer: 'ARMADURAS', points: [transform(s.a), transform(s.b)] };
    const n = Math.max(
      2,
      Math.ceil(
        Math.abs(s.angle) /
          (2 * Math.acos(Math.max(-1, 1 - 0.05 / Math.max(s.radius, 0.05)))),
      ),
    );
    const points = Array.from({ length: n + 1 }, (_, i) =>
      transform(
        add(s.center, {
          x: s.radius * Math.cos(s.startAngle + (s.angle * i) / n),
          y: s.radius * Math.sin(s.startAngle + (s.angle * i) / n),
        }),
      ),
    );
    const c = transform(s.center),
      a = points[0];
    return {
      layer: 'ARMADURAS',
      points,
      native: {
        kind: 'arc' as const,
        center: c,
        radius: s.radius * scale,
        startAngle: (Math.atan2(a.y - c.y, a.x - c.x) * 180) / Math.PI,
        sweepAngle: ((s.angle * 180) / Math.PI) * (mirrored ? -1 : 1),
      },
    };
  });
}

export function stirrupDimensionLabels(b: Bar): { text: string; at: Point }[] {
  const p = b.stirrupProfile!;
  const fmt = (n: number) => `${Number((n / 10).toFixed(2))}`;
  const g = stirrupGeometry(b, true);
  if (p.shape === 'circle')
    return [
      {
        text: `Ø${fmt(stirrupEnvelope(b).width)} cm (eixo)`,
        at: { x: 0, y: stirrupEnvelope(b).width / 2 + 45 },
      },
    ];
  if (p.shape === 'rectangle') {
    const { width: w, height: h, inset } = stirrupEnvelope(b),
      sign = b.stirrupMirrored ? -1 : 1;
    return [
      {
        text: `${fmt(w)} cm (eixo)`,
        at: { x: inset + w / 2, y: sign * (inset + h + 45) },
      },
      {
        text: `${fmt(h)} cm (eixo)`,
        at: { x: inset - 60, y: sign * (inset + h / 2) },
      },
    ];
  }
  return g.segments
    .filter((s) => s.type === 'line')
    .map((s) => ({
      text: `${fmt(distance(s.a, s.b))} cm reto`,
      at: { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 + 40 },
    }));
}
