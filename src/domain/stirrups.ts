import type { Bar, Point } from './types';
import { add, sub, mul, unit, distance, dot, geometry } from './geometry';
import { quantityForSpacing } from './detailQuantities';
import {
  defaultStirrupCriteria,
  stirrupCriteriaSchema,
  type StirrupCriteria,
} from './stirrupSchema';

/** Criteria describe a physical centerline. No structural design or code checking is implied. */
export function criteriaBar(
  value: StirrupCriteria,
  origin: Point,
  mark: string,
  id: string,
): Bar {
  const parsed = stirrupCriteriaSchema.safeParse(value);
  if (!parsed.success) {
    const names: Record<string, string> = {
      width: 'base/diâmetro da seção',
      height: 'altura',
      diameter: 'bitola',
      mandrel: 'mandril',
      rotation: 'rotação',
      quantity: 'quantidade',
      spacing: 'espaçamento',
      startInset: 'afastamento inicial',
      endInset: 'afastamento final',
      cover: 'cobrimento',
      gapAngle: 'abertura circular',
      points: 'vértices',
      length: 'trecho reto do gancho',
    };
    const path = parsed.error.issues[0].path.map(String),
      key = [...path].reverse().find((k) => names[k]);
    throw Error(
      `Revise ${key ? names[key] : 'os critérios'}: informe um valor finito dentro dos limites, com medidas positivas e quantidade inteira.`,
    );
  }
  const c = parsed.data;
  const bar: Bar = {
    id,
    mark,
    element: '',
    kind: 'stirrup',
    origin,
    rotation: c.rotation,
    points: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ],
    width: c.width,
    height: c.profile.shape === 'circle' ? c.width : c.height,
    hook: 0,
    diameter: c.diameter,
    mandrel: c.mandrel,
    steel: c.steel,
    quantity: c.quantity,
    multiplier: 1,
    quantitySource: { kind: 'manual' },
    color: '#2563eb',
    stirrupProfile: structuredClone(c.profile),
    stirrupDisplay: { ...c.display },
  };
  const errors = geometry(bar).errors;
  if (errors.length) throw Error(errors.join(' '));
  return bar;
}
export function withStirrupRange(
  bar: Bar,
  c: StirrupCriteria,
  a: Point,
  b: Point,
  label?: Point,
): Bar {
  if (
    [a, b, ...(label ? [label] : [])].some(
      (p) => !Number.isFinite(p.x) || !Number.isFinite(p.y),
    )
  )
    throw Error('Pontos da faixa devem ser finitos.');
  const u = unit(sub(b, a)),
    length = distance(a, b) - c.startInset - c.endInset;
  if (length < 0.01)
    throw Error('As faces e os afastamentos não deixam uma faixa válida.');
  const start = add(a, mul(u, c.startInset)),
    end = sub(b, mul(u, c.endInset));
  const quantity = quantityForSpacing(length, c.spacing, c.fit);
  if (quantity > 100000) throw Error('A faixa excede 100.000 peças.');
  return {
    ...bar,
    quantity,
    quantitySource: {
      kind: 'distribution',
      mode: 'spacing',
      spacing: c.spacing,
      fit: c.fit,
    },
    distribution: {
      start,
      end,
      render: 'ticks',
      insets: { start: c.startInset, end: c.endInset },
      annotationOffset: label
        ? dot(sub(label, mul(add(start, end), 0.5)), { x: -u.y, y: u.x })
        : 0,
    },
  };
}
export function criteriaFromBar(b: Bar): StirrupCriteria {
  const c = defaultStirrupCriteria();
  return {
    ...c,
    width: b.width,
    height: b.height,
    diameter: b.diameter,
    mandrel: b.mandrel,
    steel: b.steel,
    rotation: b.rotation,
    quantity: b.quantity,
    distribute: !!b.distribution,
    profile: b.stirrupProfile
      ? structuredClone(b.stirrupProfile)
      : {
          ...c.profile,
          start: { ...c.profile.start, mode: 'mm', length: b.hook },
          end: { ...c.profile.end, mode: 'mm', length: b.hook },
        },
    display: b.stirrupDisplay ? { ...b.stirrupDisplay } : c.display,
    ...(b.quantitySource.kind === 'distribution' &&
    b.quantitySource.mode === 'spacing'
      ? {
          spacing: b.quantitySource.spacing,
          fit: b.quantitySource.fit ?? 'maximum',
        }
      : {}),
    startInset: b.distribution?.insets?.start ?? 0,
    endInset: b.distribution?.insets?.end ?? 0,
  };
}
