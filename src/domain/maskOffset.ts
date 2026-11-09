import ClipperLib from 'clipper-lib';
import { maskPoint, maskPrimitives } from '../cad/import';
import {
  add,
  sub,
  mul,
  dot,
  cross,
  unit,
  nearest,
  distance,
  offsetMiterPoint,
} from './geometry';
import {
  maskCurve,
  type MaskEntityRef,
  type MaskCadEntity,
} from './maskCadEditing';
import { maskManipSelection } from './maskManipulation';
import {
  curveIntersections,
  intersectionBudget,
  pathCurve,
  nearestCurve,
  MASK_CAD_TOLERANCE as EPS,
} from './maskCadGeometry';
import {
  localMaskPoint,
  nativePrimitive,
  validateNativeMask,
  type NativeShape,
} from './nativeMasks';
import type { MaskDrawingContext } from './maskDrawing';
import { parseLength } from './segments';
import {
  uid,
  type Point,
  type Primitive,
  type Mask,
  type Project,
} from './types';

const PRECISION = 1e6;
const MITER_LIMIT = 20;
export function validateOffsetDistance(n: number) {
  if (!Number.isFinite(n) || n < EPS || n > 1e9)
    throw new Error(
      'Distância positiva e finita: de 0,000001 a 1.000.000.000 mm.',
    );
  return n;
}
export function parseOffsetDistance(raw: string) {
  if (!/(?:mm|cm|m)\s*$/i.test(raw))
    throw new Error('Informe a unidade explicitamente: mm, cm ou m.');
  return validateOffsetDistance(parseLength(raw));
}
const finitePoint = (p: Point) =>
  [p.x, p.y].every((n) => Number.isFinite(n) && Math.abs(n) <= 1e9);
export function measuredOffsetDistance(a: Point, b: Point) {
  if (!finitePoint(a) || !finitePoint(b))
    throw new Error('Pontos de distância fora dos limites do modelo.');
  return validateOffsetDistance(distance(a, b));
}
function area(pts: Point[]) {
  const origin = pts[0];
  return (
    pts.reduce(
      (s, p, i) =>
        s + cross(sub(p, origin), sub(pts[(i + 1) % pts.length], origin)),
      0,
    ) / 2
  );
}
function inside(p: Point, pts: Point[]) {
  let result = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i],
      b = pts[j];
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    )
      result = !result;
  }
  return result;
}
function simplePath(pts: Point[], closed: boolean) {
  const edgeCount = closed ? pts.length : pts.length - 1;
  const comparisons = closed
    ? (edgeCount * (edgeCount - 3)) / 2
    : ((edgeCount - 1) * (edgeCount - 2)) / 2;
  if (comparisons > 250000)
    throw new Error(
      'Contorno excede o orçamento de 250 mil comparações; sem simplificação automática.',
    );
  const curve = pathCurve(pts, closed),
    count = closed ? pts.length : pts.length - 1;
  const edges = Array.from({ length: count }, (_, i) =>
    pathCurve([pts[i], pts[(i + 1) % pts.length]], false),
  );
  const budget = intersectionBudget();
  for (let i = 0; i < count; i++) {
    if (i + 1 < count || closed) {
      const u = unit(sub(pts[(i + 1) % pts.length], pts[i])),
        v = unit(sub(pts[(i + 2) % pts.length], pts[(i + 1) % pts.length]));
      if (1 + dot(u, v) < 1e-12)
        throw new Error('Retorno de 180° ou canto numericamente indefinido.');
    }
    for (let j = i + 2; j < count; j++) {
      if (closed && i === 0 && j === count - 1) continue;
      try {
        if (curveIntersections(edges[i], edges[j], budget).length)
          throw new Error('cruzamento');
      } catch (error) {
        if ((error as Error).message.includes('250 mil')) throw error;
        throw new Error(
          'Caminho autocruzado, sobreposto ou com contato não adjacente; Offset recusado.',
        );
      }
    }
  }
  if (closed && Math.abs(area(pts)) <= EPS * EPS)
    throw new Error('Contorno sem área válida.');
  return curve;
}
function openSide(pts: Point[], click: Point) {
  const values = pts.slice(1).map((b, i) => {
    const a = pts[i],
      u = unit(sub(b, a));
    return {
      distance: distance(click, nearest(click, a, b)),
      signed: cross(u, sub(click, a)),
    };
  });
  const best = Math.min(...values.map((v) => v.distance));
  const signs = new Set(
    values
      .filter((v) => v.distance <= best + EPS)
      .map((v) => (Math.abs(v.signed) <= EPS ? 0 : Math.sign(v.signed))),
  );
  if (signs.has(0) || signs.size !== 1)
    throw new Error(
      'Lado ambíguo: clique afastado da linha, do prolongamento ou de regiões equidistantes opostas.',
    );
  return [...signs][0];
}
function miterPath(pts: Point[], closed: boolean, signed: number) {
  const dirs = pts
    .slice(0, closed ? pts.length : pts.length - 1)
    .map((p, i) => unit(sub(pts[(i + 1) % pts.length], p)));
  return pts.map((p, i) => {
    if (!closed && i === 0)
      return add(p, mul({ x: -dirs[0].y, y: dirs[0].x }, signed));
    if (!closed && i === pts.length - 1) {
      const u = dirs.at(-1)!;
      return add(p, mul({ x: -u.y, y: u.x }, signed));
    }
    const q = offsetMiterPoint(
      p,
      dirs[(i - 1 + dirs.length) % dirs.length],
      dirs[i % dirs.length],
      signed,
    );
    if (distance(p, q) > Math.abs(signed) * MITER_LIMIT + EPS)
      throw new Error(
        'Canto muito agudo: junção excede 20 vezes a distância. Sem chanfro ou redução automática.',
      );
    return q;
  });
}
export type OffsetGeometry = {
  results: Primitive[];
  side: string;
  notes: string[];
};
/** Pure geometry: distances are model mm; normalized imported curves remain segment chains. */
export function offsetMaskGeometry(
  mask: Mask,
  source: Primitive,
  d: number,
  click: Point,
): OffsetGeometry {
  validateOffsetDistance(d);
  if (source.text)
    throw new Error(
      'Texto/anotação não suporta Offset; selecione uma entidade geométrica.',
    );
  if (!finitePoint(click))
    throw new Error(
      'Escolha um ponto físico finito dentro dos limites do modelo.',
    );
  const c = maskCurve(mask, source),
    notes: string[] = [];
  const make = (shape: NativeShape): Primitive => ({
    ...structuredClone(source),
    ...nativePrimitive(shape, 'offset-preview', source.layer),
  });
  let results: Primitive[], side: string;
  if (c.kind === 'round') {
    const radial = distance(click, c.center);
    if (Math.abs(radial - c.radius) <= EPS)
      throw new Error(
        'Clique sobre a curva: escolha o lado interno ou externo.',
      );
    if (!c.closed) {
      const hit = nearestCurve(c, click);
      if (hit.at <= EPS || hit.at >= c.total - EPS)
        throw new Error(
          'Lado do arco ambíguo: clique diante do trecho curvo, afastado das pontas.',
        );
    }
    const outside = radial > c.radius,
      radius = c.radius + (outside ? d : -d);
    if (radius < EPS)
      throw new Error(
        'Raio interno nulo/negativo ou abaixo da tolerância; distância não foi reduzida.',
      );
    const native = source.native;
    if (!native || (native.kind !== 'circle' && native.kind !== 'arc'))
      throw new Error('Curva sem geometria circular analítica suportada.');
    results = [make({ ...native, radius: radius / mask.scale })];
    side = outside ? 'externo' : 'interno';
  } else {
    const pts = c.points,
      closed = c.closed;
    simplePath(pts, closed);
    if (nearestCurve(c, click).distance <= EPS)
      throw new Error('Clique sobre a entidade: escolha um lado inequívoco.');
    const interior = closed && inside(click, pts);
    const signed =
      d *
      (closed
        ? interior
          ? Math.sign(area(pts))
          : -Math.sign(area(pts))
        : openSide(pts, click));
    side = closed ? (interior ? 'interno' : 'externo') : 'lado físico clicado';
    const raw = miterPath(pts, closed, signed);
    if (raw.some((p) => !finitePoint(p)))
      throw new Error('Junção fora dos limites ±1.000.000.000 mm.');
    let paths: Point[][];
    if (source.native?.kind === 'rectangle') {
      const [a, b] = source.native.points,
        delta = (interior ? -d : d) / mask.scale;
      const lo = {
          x: Math.min(a.x, b.x) - delta,
          y: Math.min(a.y, b.y) - delta,
        },
        hi = { x: Math.max(a.x, b.x) + delta, y: Math.max(a.y, b.y) + delta };
      if (hi.x - lo.x < EPS / mask.scale || hi.y - lo.y < EPS / mask.scale)
        throw new Error(
          'Offset interno colapsa/inverte o retângulo; distância não foi reduzida.',
        );
      results = [make({ kind: 'rectangle', points: [lo, hi], closed: true })];
    } else {
      if (closed) {
        // Integer clipping is restricted to polygon topology; circle/line/open results stay analytic doubles.
        // Translate before scaling, keeping precision independent of the global origin and text formatting.
        const origin = pts[0];
        const path = pts.map((p) => ({
          X: Math.round((p.x - origin.x) * PRECISION),
          Y: Math.round((p.y - origin.y) * PRECISION),
        }));
        if (!ClipperLib.Clipper.Orientation(path)) path.reverse();
        if (path.some((p) => Math.abs(p.X) > 2e15 || Math.abs(p.Y) > 2e15))
          throw new Error('Contorno excede a faixa de precisão do Offset.');
        // The stricter geometric limit above rejects sharp joins before Clipper.
        // Margin prevents its automatic square fallback at the floating-point boundary.
        const offset = new ClipperLib.ClipperOffset(MITER_LIMIT + 2),
          solution: ClipperLib.Paths = [];
        offset.AddPath(
          path,
          ClipperLib.JoinType.jtMiter,
          ClipperLib.EndType.etClosedPolygon,
        );
        offset.Execute(solution, (interior ? -d : d) * PRECISION);
        if (!solution.length)
          throw new Error(
            'Offset interno colapsa o contorno; nenhum remanescente válido.',
          );
        if (solution.some((p) => !ClipperLib.Clipper.Orientation(p)))
          throw new Error(
            'Resultado contém furos: o contrato atual não agrupa contornos com preenchimento. Nada foi criado.',
          );
        paths = solution.map((path) => {
          const p = path.map((q) => ({
            x: q.X / PRECISION + origin.x,
            y: q.Y / PRECISION + origin.y,
          }));
          if (area(pts) < 0) p.reverse();
          return p;
        });
        if (paths.length > 1)
          notes.push(
            `${paths.length} remanescentes fechados independentes; todos serão criados em uma transação.`,
          );
        notes.push(
          'Junções retas (miter); topologia de contornos com precisão de 0,000001 mm.',
        );
      } else {
        for (let i = 1; i < raw.length; i++)
          if (
            dot(sub(raw[i], raw[i - 1]), sub(pts[i], pts[i - 1])) <=
            EPS * distance(pts[i], pts[i - 1])
          )
            throw new Error(
              'Offset colapsa/inverte um trecho curto; nenhuma cópia parcial.',
            );
        simplePath(raw, false);
        paths = [raw];
      }
      results = paths.map((points) => {
        simplePath(points, closed);
        const local = points.map((p) => localMaskPoint(p, mask));
        if (local.length > 500) {
          if (mask.format === 'NATIVE')
            throw new Error(
              'Resultado nativo excede 500 vértices; sem simplificação automática.',
            );
          const result = {
            ...structuredClone(source),
            id: 'offset-preview',
            points: local,
            closed,
          };
          delete result.native;
          return result;
        }
        return make({
          kind: local.length === 2 ? 'line' : 'polyline',
          points: local,
          closed,
        });
      });
    }
    if (!source.native)
      notes.push(
        'Referência importada normalizada: Offset sobre os segmentos disponíveis, sem reconstrução ou nova discretização de curvas.',
      );
  }
  for (const q of results)
    if (q.native?.kind === 'circle' || q.native?.kind === 'arc') {
      const center = maskPoint(q.native.center, mask),
        r = q.native.radius * mask.scale;
      if (
        ![center.x - r, center.x + r, center.y - r, center.y + r].every(
          (n) => Number.isFinite(n) && Math.abs(n) <= 1e9,
        )
      )
        throw new Error('Curva fora dos limites do modelo.');
    }
  for (const q of maskPrimitives({ ...mask, primitives: results }))
    if (q.points.some((p) => !finitePoint(p)))
      throw new Error('Resultado fora dos limites do modelo.');
  return { results, side, notes };
}
export type MaskOffsetPlan = OffsetGeometry & {
  project: Project;
  mask: Mask;
  ref: MaskEntityRef;
  distance: number;
  click: Point;
  context: MaskDrawingContext;
  pickTolerance: number;
};
export function previewMaskOffset(
  p: Project,
  maskId: string,
  ref: MaskEntityRef,
  d: number,
  click: Point,
  context: MaskDrawingContext,
  prepared?: MaskCadEntity[],
  pickTolerance = EPS,
): MaskOffsetPlan {
  const { mask } = maskManipSelection(p, maskId, [ref], context, prepared);
  if (!Number.isFinite(pickTolerance) || pickTolerance < 0)
    throw new Error('Tolerância de captura inválida.');
  if (
    !ref.primitive.text &&
    nearestCurve(maskCurve(mask, ref.primitive), click).distance <=
      Math.max(EPS, pickTolerance)
  )
    throw new Error(
      'Clique sobre a entidade ou próximo demais para escolher o lado. Afaste o ponto ou aproxime o zoom.',
    );
  const result = offsetMaskGeometry(mask, ref.primitive, d, click);
  if (mask.primitives.length + result.results.length > 100000)
    throw new Error('Limite de 100 mil entidades da máscara atingido.');
  return {
    ...result,
    project: p,
    mask,
    ref,
    distance: d,
    click: { ...click },
    context: { ...context },
    pickTolerance,
  };
}
export function applyMaskOffset(
  p: Project,
  plan: MaskOffsetPlan,
  context: MaskDrawingContext,
) {
  if (
    p !== plan.project ||
    context.key !== plan.context.key ||
    context.detailId !== plan.context.detailId ||
    context.scopeDetailId !== plan.context.scopeDetailId
  )
    throw new Error('Projeto/contexto mudou; reinicie Offset.');
  const fresh = previewMaskOffset(
    p,
    plan.mask.id,
    plan.ref,
    plan.distance,
    plan.click,
    context,
    undefined,
    plan.pickTolerance,
  );
  const copies = fresh.results.map((q) => ({
    ...q,
    id: uid(),
    sourceEntityId:
      plan.ref.id ??
      plan.ref.primitive.sourceEntityId ??
      `${plan.mask.id}:import:${plan.ref.index}`,
  }));
  const mask = {
    ...plan.mask,
    primitives: [...plan.mask.primitives, ...copies],
  };
  validateNativeMask(mask);
  return { ...p, masks: p.masks.map((m) => (m === plan.mask ? mask : m)) };
}
