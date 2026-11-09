import { nextFreeMark } from './marks';
import { geometry, vertices } from './geometry';
import { uid, type Bar, type FabricationPosition, type Project } from './types';

/** Grid equality, not a pairwise distance: equivalence is transitive. All lengths are mm. */
export const FABRICATION_RULES = Object.freeze({
  lengthGrid: 0.001,
  angleGrid: 1e-8,
  mirror: false,
  reverse: true,
});
const q = (n: number, grid: number) => Math.round(n / grid) || 0;
const knownBarFields = new Set([
  'id',
  'mark',
  'element',
  'kind',
  'stirrupMirrored',
  'stirrupProfile',
  'stirrupDisplay',
  'drafting',
  'origin',
  'rotation',
  'points',
  'width',
  'height',
  'hook',
  'diameter',
  'mandrel',
  'steel',
  'quantity',
  'distribution',
  'color',
  'layerId',
  'style',
  'plot',
  'manufacturing',
  'multiplier',
  'quantitySource',
  'quantityDisplay',
  'comment',
  'ribbed',
  'showRibbed',
  'columnLevel',
]);
/** Ordered edge lengths and signed turns preserve handedness; translation/rotation never enter. */
export function fabricationSignature(
  b: Bar,
  reverse = true,
): string | undefined {
  if (Object.keys(b).some((key) => !knownBarFields.has(key))) return undefined;
  const specifications = b.manufacturing;
  if (
    specifications &&
    (Object.keys(specifications).some(
      (key) => !['start', 'end', 'variant'].includes(key),
    ) ||
      [specifications.start, specifications.end].some(
        (t) =>
          t &&
          (Object.keys(t).some((key) => !['kind', 'code'].includes(key)) ||
            !['plain', 'coupler', 'threaded', 'headed'].includes(t.kind) ||
            typeof t.code !== 'string' ||
            (t.kind === 'plain' ? !!t.code : !t.code.trim())),
      ))
  )
    return undefined;
  const g = geometry(b);
  if (g.errors.length || !Number.isFinite(g.length)) return undefined;
  if (b.stirrupProfile) {
    const signature = (reversed: boolean) => {
      const segs = reversed
        ? [...g.segments].reverse().map((s) =>
            s.type === 'line'
              ? { ...s, a: s.b, b: s.a }
              : {
                  ...s,
                  a: s.b,
                  b: s.a,
                  startAngle: s.startAngle + s.angle,
                  angle: -s.angle,
                },
          )
        : g.segments;
      const tangent = (s: (typeof segs)[number], end: boolean) =>
        s.type === 'line'
          ? Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x)
          : s.startAngle +
            (end ? s.angle : 0) +
            (Math.sign(s.angle) * Math.PI) / 2;
      const turns = segs.slice(1).map((s, i) => {
        const a = tangent(s, false) - tangent(segs[i], true);
        return q(
          Math.atan2(Math.sin(a), Math.cos(a)),
          FABRICATION_RULES.angleGrid,
        );
      });
      const ends = reversed
        ? [b.manufacturing?.end, b.manufacturing?.start]
        : [b.manufacturing?.start, b.manufacturing?.end];
      return JSON.stringify({
        family: 'parametric-stirrup',
        steel: b.steel,
        diameter: q(b.diameter, 0.001),
        mandrel: q(b.mandrel, 0.001),
        segments: segs.map((s) =>
          s.type === 'line'
            ? ['line', q(Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y), 0.001)]
            : [
                'arc',
                q(s.radius, 0.001),
                q(s.angle, FABRICATION_RULES.angleGrid),
              ],
        ),
        turns,
        ends: ends.map((t) =>
          t?.kind && t.kind !== 'plain' ? [t.kind, t.code] : ['plain'],
        ),
        variant: b.manufacturing?.variant ?? '',
      });
    };
    return reverse
      ? [signature(false), signature(true)].sort()[0]
      : signature(false);
  }
  const vs = vertices(b);
  const shape = (points: typeof vs, reversed: boolean) => {
    const edges = points
      .slice(1)
      .map((p, i) => ({ x: p.x - points[i].x, y: p.y - points[i].y }));
    if (edges.some((e) => Math.hypot(e.x, e.y) < 1e-9)) return undefined;
    const turns = edges
      .slice(1)
      .map((e, i) =>
        q(
          Math.atan2(
            edges[i].x * e.y - edges[i].y * e.x,
            edges[i].x * e.x + edges[i].y * e.y,
          ),
          FABRICATION_RULES.angleGrid,
        ),
      );
    const ends = reversed
      ? [b.manufacturing?.end, b.manufacturing?.start]
      : [b.manufacturing?.start, b.manufacturing?.end];
    const lengths = edges.map((e) => q(Math.hypot(e.x, e.y), 0.001));
    if (!lengths.every(Number.isSafeInteger)) return undefined;
    return JSON.stringify({
      family: b.kind,
      steel: b.steel,
      diameter: q(b.diameter, 0.001),
      mandrel: q(b.mandrel, 0.001),
      hook: b.kind === 'stirrup' ? q(b.hook, 0.001) : null,
      edges: lengths,
      turns,
      ends: ends.map((t) =>
        t?.kind && t.kind !== 'plain' ? [t.kind, t.code] : ['plain'],
      ),
      variant: b.manufacturing?.variant ?? '',
    });
  };
  const forward = shape(vs, false);
  if (!forward || !reverse) return forward;
  return [forward, shape([...vs].reverse(), true)!].sort()[0];
}
function solo(b: Bar, occupied: Set<string>): FabricationPosition {
  let id = `fabrication:${b.id}`;
  while (occupied.has(id)) id += '-';
  occupied.add(id);
  return {
    id,
    mark: b.mark,
    barIds: [b.id],
    reverse: true,
    signature: fabricationSignature(b) ?? '',
  };
}
/** Legacy/uncommitted occurrences are singleton positions. Never infer a group by a repeated name. */
export function fabricationPositions(
  p: Pick<Project, 'bars' | 'fabricationPositions'>,
): FabricationPosition[] {
  const result = p.fabricationPositions ?? [];
  const mapped = new Set(result.flatMap((g) => g.barIds));
  const occupied = new Set(result.map((g) => g.id));
  return [
    ...result,
    ...p.bars.filter((b) => !mapped.has(b.id)).map((b) => solo(b, occupied)),
  ];
}
export function validateFabrication(
  p: Pick<Project, 'bars' | 'fabricationPositions'>,
) {
  const groups = fabricationPositions(p),
    ids = new Set<string>(),
    marks = new Set<string>(),
    members = new Set<string>();
  const bars = new Map(p.bars.map((b) => [b.id, b]));
  for (const g of groups) {
    if (!g.barIds.length || ids.has(g.id) || marks.has(g.mark))
      throw new Error(
        'Cada posição de fabricação deve ter ID e identificação únicos.',
      );
    ids.add(g.id);
    marks.add(g.mark);
    for (const id of g.barIds) {
      const b = bars.get(id);
      if (!b || members.has(id) || b.mark !== g.mark)
        throw new Error(
          'Vínculo ou identificação da ocorrência/posição de fabricação inválido.',
        );
      members.add(id);
      if (
        g.barIds.length > 1 &&
        (!g.signature || fabricationSignature(b, g.reverse) !== g.signature)
      )
        throw new Error(`Peças não equivalentes na posição ${g.mark}.`);
    }
  }
}
/** Shared transaction boundary. Changed members leave a group; every other occurrence keeps its ID and data. */
export function reconcileFabrication(p: Project): Project {
  const bars = new Map(p.bars.map((b) => [b.id, b])),
    occupied = new Set((p.fabricationPositions ?? []).map((g) => g.id));
  const positions: FabricationPosition[] = [],
    mapped = new Set<string>();
  const marks = new Set(p.bars.map((b) => b.mark));
  const nextMark = () => {
    const mark = nextFreeMark(p, marks);
    marks.add(mark);
    return mark;
  };
  for (const g of p.fabricationPositions ?? []) {
    const live = g.barIds.filter((id) => bars.has(id));
    const retained = live.filter((id) => {
      const b = bars.get(id)!;
      return (
        g.barIds.length === 1 ||
        (b.mark === g.mark &&
          fabricationSignature(b, g.reverse) === g.signature)
      );
    });
    if (retained.length) {
      const b = bars.get(retained[0])!;
      positions.push({
        ...g,
        barIds: retained,
        mark: retained.length === 1 ? b.mark : g.mark,
        signature: fabricationSignature(b, g.reverse) ?? '',
      });
      retained.forEach((id) => mapped.add(id));
    }
    const retainedIds = new Set(retained);
    for (const id of live.filter((id) => !retainedIds.has(id))) {
      let b = bars.get(id)!;
      if (
        b.mark === g.mark &&
        (retained.length > 0 ||
          [...bars.values()].some(
            (other) => other.id !== id && other.mark === b.mark,
          ))
      ) {
        b = { ...b, mark: nextMark() };
        bars.set(id, b);
      }
      positions.push(solo(b, occupied));
      mapped.add(id);
    }
  }
  for (const b of bars.values())
    if (!mapped.has(b.id)) positions.push(solo(b, occupied));
  const updatedBars = p.bars.map((b) => bars.get(b.id)!);
  return {
    ...p,
    bars: updatedBars.every((b, i) => b === p.bars[i]) ? p.bars : updatedBars,
    fabricationPositions: positions,
  };
}
export function fabricationCandidates(p: Project, reverse = true) {
  const signatures = new Map<string, Bar[]>();
  for (const b of p.bars) {
    const key = fabricationSignature(b, reverse);
    if (key) {
      const bucket = signatures.get(key);
      if (bucket) bucket.push(b);
      else signatures.set(key, [b]);
    }
  }
  return [...signatures.values()].filter((bars) => bars.length > 1);
}
export function groupFabrication(
  p: Project,
  ids: string[],
  representativeId: string,
  reverse = true,
  mark?: string,
): Project {
  if (
    new Set(ids).size !== ids.length ||
    ids.length < 2 ||
    !ids.includes(representativeId)
  )
    throw new Error(
      'Escolha pelo menos duas ocorrências e um representante do conjunto.',
    );
  const selected = new Set(ids);
  const byId = new Map(p.bars.map((b) => [b.id, b]));
  const bars = ids.map((id) => {
    const b = byId.get(id);
    if (!b) throw new Error(`Ocorrência inexistente: ${id}.`);
    return b;
  });
  const signature = fabricationSignature(bars[0], reverse);
  if (
    !signature ||
    bars.some((b) => fabricationSignature(b, reverse) !== signature)
  )
    throw new Error('As ocorrências não são equivalentes para fabricação.');
  const positions = fabricationPositions(p),
    chosen = positions.find((g) => g.barIds.includes(representativeId))!;
  const name = (
    mark ?? p.bars.find((b) => b.id === representativeId)!.mark
  ).trim();
  if (!name || name.length > 40)
    throw new Error('Informe uma posição de 1 a 40 caracteres.');
  // A partial selection may not take the identity/name of a position that still has other members.
  const remaining = positions
    .map((g) => ({ ...g, barIds: g.barIds.filter((id) => !selected.has(id)) }))
    .filter((g) => g.barIds.length);
  if (remaining.some((g) => g.mark === name))
    throw new Error(
      'A identificação já é usada por ocorrências fora da seleção. Inclua a posição completa ou escolha outra identificação.',
    );
  const id = remaining.some((g) => g.id === chosen.id) ? uid() : chosen.id;
  const next: Project = {
    ...p,
    bars: p.bars.map((b) => (selected.has(b.id) ? { ...b, mark: name } : b)),
    fabricationPositions: [
      ...remaining,
      {
        id,
        mark: name,
        barIds: [
          representativeId,
          ...ids.filter((id) => id !== representativeId),
        ],
        reverse,
        signature,
      },
    ],
    scheduleLock: undefined,
  };
  validateFabrication(next);
  return next;
}
export function ungroupFabrication(p: Project, ids: string[]): Project {
  if (!ids.length || ids.some((id) => !p.bars.some((b) => b.id === id)))
    throw new Error('Escolha ocorrências existentes para desagrupar.');
  const positions = fabricationPositions(p),
    marks = new Set(p.bars.map((b) => b.mark)),
    occupied = new Set(positions.map((g) => g.id));
  const renamed = new Map<string, Bar>(),
    result: FabricationPosition[] = [];
  for (const g of positions) {
    const selected = g.barIds.filter((id) => ids.includes(id));
    if (g.barIds.length === 1 || !selected.length) {
      result.push(g);
      continue;
    }
    const remaining = g.barIds.filter((id) => !selected.includes(id));
    if (remaining.length) result.push({ ...g, barIds: remaining });
    selected.forEach((id, i) => {
      const b = p.bars.find((b) => b.id === id)!;
      let mark = b.mark;
      if (remaining.length || i > 0) {
        mark = nextFreeMark(p, marks);
        marks.add(mark);
      }
      const bar = { ...b, mark };
      renamed.set(id, bar);
      result.push(
        !remaining.length && i === 0
          ? { ...g, barIds: [id] }
          : solo(bar, occupied),
      );
    });
  }
  return {
    ...p,
    bars: p.bars.map((b) => renamed.get(b.id) ?? b),
    fabricationPositions: result,
    scheduleLock: undefined,
  };
}
export type FabricationPreview = {
  base: Project;
  project?: Project;
  issues: string[];
};
export function previewFabrication(
  p: Project,
  ids: string[],
  representativeId: string,
  reverse = true,
  mark?: string,
): FabricationPreview {
  try {
    return {
      base: p,
      project: groupFabrication(p, ids, representativeId, reverse, mark),
      issues: [],
    };
  } catch (e) {
    return { base: p, issues: [(e as Error).message] };
  }
}
