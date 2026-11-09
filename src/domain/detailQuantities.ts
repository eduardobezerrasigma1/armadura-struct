import { distance } from './geometry';
import type {
  Bar,
  BarQuantitySource,
  DetailRepetition,
  Project,
} from './types';

export function repetitionNames(
  p: Project,
  repetition?: DetailRepetition,
): string[] {
  const elements = repetition?.elements ?? [];
  const names = elements.map((m) =>
    m.elementId
      ? (p.hierarchy.elements.find((e) => e.id === m.elementId)?.name ?? m.name)
      : m.name,
  );
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  const qualified = names.map((name, i) => {
    if ((counts.get(name) ?? 0) < 2 || !elements[i].elementId) return name;
    const e = p.hierarchy.elements.find((e) => e.id === elements[i].elementId);
    const floor = p.hierarchy.floors.find((f) => f.id === e?.floorId);
    return `${name} (${floor?.name ?? e?.floorId})`;
  });
  const qualifiedCounts = new Map<string, number>();
  for (const name of qualified)
    qualifiedCounts.set(name, (qualifiedCounts.get(name) ?? 0) + 1);
  return qualified.map((name, i) =>
    (qualifiedCounts.get(name) ?? 0) > 1 && elements[i].elementId
      ? `${name} [${elements[i].elementId}]`
      : name,
  );
}
export function detailTitle(p: Project, detailId: string): string {
  const d = p.hierarchy.details.find((d) => d.id === detailId);
  if (!d) return '';
  if (!d.repetition) return d.name;
  const names = repetitionNames(p, d.repetition);
  return `${names.length ? names.join(' = ') + ' · ' : ''}${d.name} · ${d.repetition.factor}×`;
}
export function quantityContext(p: Project, b: Bar) {
  const owner = p.hierarchy.objectDetails[b.id];
  const d = p.hierarchy.details.find((d) => d.id === owner);
  return {
    repetitions: d?.repetition?.factor ?? 1,
    detailTitle: d?.repetition ? detailTitle(p, owner) : '',
  };
}
/** This is the only composition of per-armature and per-detail factors. */
export function barQuantities(p: Project, b: Bar) {
  const context = quantityContext(p, b);
  return {
    ...context,
    ...localBarQuantities(b),
    quantity: b.quantity * (b.multiplier ?? 1) * context.repetitions,
  };
}
export function localBarQuantities(b: Bar) {
  const multiplier = b.multiplier ?? 1;
  return {
    baseQuantity: b.quantity,
    multiplier,
    perDetailQuantity: b.quantity * multiplier,
    quantitySource: b.quantitySource ?? { kind: 'manual' as const },
  };
}
export function quantityExpression(
  q: { baseQuantity: number; multiplier: number; repetitions: number },
  spaced = true,
) {
  return [
    q.baseQuantity,
    ...(q.multiplier > 1 ? [q.multiplier] : []),
    ...(q.repetitions > 1 ? [q.repetitions] : []),
  ].join(spaced ? ' × ' : '×');
}
export function quantityLabel(p: Project | undefined, b: Bar): string {
  const q = p
    ? barQuantities(p, b)
    : {
        ...localBarQuantities(b),
        repetitions: 1,
        quantity: b.quantity * (b.multiplier ?? 1),
      };
  if (b.quantityDisplay === 'total') return String(q.quantity);
  return q.multiplier > 1 || q.repetitions > 1
    ? `${quantityExpression(q)} = ${q.quantity}`
    : String(q.baseQuantity);
}
export function assemblyLabel(
  b: Pick<Bar, 'ribbed' | 'showRibbed' | 'columnLevel' | 'comment'>,
): string {
  return [
    b.ribbed && b.showRibbed ? 'C/NERV' : '',
    b.columnLevel ? `Lance ${b.columnLevel}` : '',
    b.comment ?? '',
  ]
    .filter(Boolean)
    .join(' · ');
}
export function barSearchText(b: Bar) {
  return `${b.id} ${b.mark} ${b.element} ${b.comment ?? ''} ${b.columnLevel ?? ''} ${b.ribbed ? 'nervura nervurada' : ''}`;
}
export function quantityForSpacing(
  length: number,
  spacing: number,
  fit: 'maximum' | 'fixed' = 'maximum',
) {
  if (
    !Number.isFinite(length) ||
    !Number.isFinite(spacing) ||
    length <= 0 ||
    spacing <= 0
  )
    throw new Error('Defina um comprimento e espaçamento positivos.');
  // Relative epsilon prevents ceil(3.0000000000000004) after unit conversion.
  const intervals = length / spacing;
  const tolerance = 1e-12 * Math.max(1, intervals);
  const quantity =
    (fit === 'fixed'
      ? Math.floor(intervals + tolerance)
      : Math.ceil(intervals - tolerance)) + 1;
  if (quantity < 2)
    throw Error(
      'O trecho deve comportar ao menos dois estribos no espaçamento fixo.',
    );
  if (quantity > 100000)
    throw new Error('A faixa excede 100.000 peças. Aumente o espaçamento.');
  return Math.max(2, quantity);
}
export function expectedBaseQuantity(b: Bar): number {
  const source = b.quantitySource;
  if (source?.kind !== 'distribution') return b.quantity;
  if (!b.distribution)
    throw new Error(
      'Quantidade com origem na faixa exige uma distribuição vinculada.',
    );
  return source.mode === 'spacing'
    ? quantityForSpacing(
        distance(b.distribution.start ?? b.origin, b.distribution.end),
        source.spacing,
        source.fit,
      )
    : b.quantity;
}
/** Only an edit recomputes a dependent base; readers reject a stale persisted cache. */
export function recalculateBarQuantity(b: Bar): Bar {
  const quantity = expectedBaseQuantity(b);
  return quantity === b.quantity ? b : { ...b, quantity };
}
export function validateBarQuantity(b: Bar) {
  if (expectedBaseQuantity(b) !== b.quantity)
    throw new Error(
      `Quantidade base de ${b.mark} não corresponde ao espaçamento da faixa.`,
    );
}
export function quantitySourceLabel(source: BarQuantitySource): string {
  return source.kind === 'manual'
    ? 'Manual'
    : source.mode === 'quantity'
      ? 'Faixa · quantidade fixa'
      : `Faixa · espaçamento máximo ${source.spacing} mm`;
}
/** Older formats may include harmless new defaults but cannot carry new effective factors. */
export function hasArmatureData(b: Bar): boolean {
  return (
    (b.multiplier ?? 1) !== 1 ||
    (b.quantitySource?.kind ?? 'manual') !== 'manual' ||
    !!(b.comment || b.ribbed || b.showRibbed || b.columnLevel) ||
    b.quantityDisplay === 'total'
  );
}
