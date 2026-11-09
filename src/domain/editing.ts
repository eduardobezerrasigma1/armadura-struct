import { remapDimensionMasks } from './maskDimensions';
import { previewRenumber, type RenumberOptions } from './numbering';
export { quantityForSpacing } from './detailQuantities';
import {
  add,
  distance,
  geometry,
  local,
  mul,
  rotate,
  sub,
  vertices,
  world,
} from './geometry';
import { nextMark } from './model';
import { completeOwnership, contentObjects } from './hierarchy';
import { armatureReferences } from './armatureReferences';
import { nextFreeMark } from './marks';
import { fabricationPositions, groupFabrication } from './fabrication';
import { uid, type Bar, type Point, type Project } from './types';

/** Split a physical centerline on a straight leg. Bends remain exact in both pieces. */
export function splitBar(
  project: Project,
  id: string,
  station: number,
  lap: number,
): Project {
  const bar = project.bars.find((b) => b.id === id);
  if (!bar || bar.kind !== 'free')
    throw new Error('Selecione uma barra livre para dividir.');
  if (bar.distribution)
    throw new Error('Remova a distribuição antes de dividir a barra.');
  const g = geometry(bar);
  if (g.errors.length) throw new Error(g.errors.join(' '));
  if (
    !Number.isFinite(station) ||
    !Number.isFinite(lap) ||
    lap < 0 ||
    station <= 0 ||
    station >= g.length
  )
    throw new Error(
      'Informe um corte dentro da barra e um traspasse não negativo.',
    );
  let accumulated = 0,
    leg = 0;
  for (const segment of g.segments) {
    const length =
      segment.type === 'line'
        ? distance(segment.a, segment.b)
        : segment.radius * Math.abs(segment.angle);
    if (station > accumulated && station < accumulated + length) {
      if (
        segment.type !== 'line' ||
        station - lap / 2 <= accumulated + 0.01 ||
        station + lap / 2 >= accumulated + length - 0.01
      )
        throw new Error(
          'O corte e todo o traspasse precisam caber em um trecho reto, fora das dobras.',
        );
      const at = (d: number) =>
        add(segment.a, mul(sub(segment.b, segment.a), d / length));
      const end = at(station - accumulated + lap / 2);
      const start = at(station - accumulated - lap / 2);
      const first: Bar = {
        ...bar,
        points: [...bar.points.slice(0, leg + 1), end],
        ...(bar.manufacturing
          ? {
              manufacturing: {
                ...bar.manufacturing,
                end: { kind: 'plain', code: '' },
              },
            }
          : {}),
      };
      const second: Bar = {
        ...bar,
        id: uid(),
        mark: nextMark(project),
        origin: world(start, bar),
        ...(bar.manufacturing
          ? {
              manufacturing: {
                ...bar.manufacturing,
                start: { kind: 'plain', code: '' },
              },
            }
          : {}),
        points: [start, ...bar.points.slice(leg + 1)].map((p) => sub(p, start)),
      };
      const errors = [...geometry(first).errors, ...geometry(second).errors];
      if (errors.length) throw new Error(errors.join(' '));
      return completeOwnership(
        {
          ...project,
          bars: project.bars.flatMap((b) =>
            b.id === id ? [first, second] : [b],
          ),
        },
        project.hierarchy.objectDetails[id] || project.hierarchy.details[0].id,
      );
    }
    accumulated += length;
    if (segment.type === 'line') leg++;
  }
  throw new Error(
    'Posicione o corte no interior de um trecho reto, fora das dobras.',
  );
}

/** Merge touching polylines into one physical bar; never silently weld a gap or overlap. */
export function joinBars(project: Project, ids: string[]): Project {
  const bars = project.bars.filter((b) => ids.includes(b.id));
  if (bars.length !== 2 || ids.length !== 2)
    throw new Error(
      'Selecione exatamente duas barras com Shift para emendar as poligonais.',
    );
  const [a, b] = bars;
  if (
    bars.some(
      (b) =>
        b.manufacturing?.variant ||
        [b.manufacturing?.start, b.manufacturing?.end].some(
          (t) => t && t.kind !== 'plain',
        ),
    )
  )
    throw new Error(
      'A união de peças com terminações/luvas ou variantes exige revisão explícita das especificações.',
    );
  const ownerA = project.hierarchy.objectDetails[a.id],
    ownerB = project.hierarchy.objectDetails[b.id];
  if (ownerA && ownerB && ownerA !== ownerB)
    throw new Error('Mova as barras para o mesmo detalhamento antes de unir.');
  if (
    bars.some(
      (b) => b.kind !== 'free' || b.distribution || geometry(b).errors.length,
    )
  )
    throw new Error('Use duas barras livres válidas, sem distribuição.');
  if (
    a.diameter !== b.diameter ||
    a.steel !== b.steel ||
    a.quantity !== b.quantity ||
    (a.multiplier ?? 1) !== (b.multiplier ?? 1) ||
    (a.comment ?? '') !== (b.comment ?? '') ||
    (a.ribbed ?? false) !== (b.ribbed ?? false) ||
    (a.showRibbed ?? false) !== (b.showRibbed ?? false) ||
    (a.columnLevel ?? '') !== (b.columnLevel ?? '') ||
    a.mandrel !== b.mandrel
  )
    throw new Error(
      'As barras precisam ter a mesma bitola, aço, quantidade base, multiplicador, dados de montagem e mandril.',
    );
  let best:
    | { first: typeof a.points; second: typeof b.points; gap: number }
    | undefined;
  for (const reverseA of [false, true])
    for (const reverseB of [false, true]) {
      const first = a.points.map((p) => world(p, a)),
        second = b.points.map((p) => world(p, b));
      if (reverseA) first.reverse();
      if (reverseB) second.reverse();
      const gap = distance(first.at(-1)!, second[0]);
      if (!best || gap < best.gap) best = { first, second, gap };
    }
  if (!best || best.gap > 0.01)
    throw new Error(
      'As extremidades devem coincidir. Use Mover para ajustar as pontas antes de unir.',
    );
  const origin = best.first[0];
  const joined = {
    ...a,
    origin,
    rotation: 0,
    points: [...best.first, ...best.second.slice(1)].map((p) => sub(p, origin)),
  };
  const errors = geometry(joined).errors;
  if (errors.length) throw new Error(errors.join(' '));
  return completeOwnership(
    {
      ...project,
      bars: project.bars
        .filter((x) => x.id !== b.id)
        .map((x) => (x.id === a.id ? joined : x)),
      details: project.details.map((d) =>
        d.barId === b.id ? { ...d, barId: a.id } : d,
      ),
      annotations: project.annotations.map((n) => ({
        ...n,
        ...(n.barId === b.id ? { barId: a.id } : {}),
        ...(n.barIds
          ? {
              barIds: [
                ...new Set(n.barIds.map((id) => (id === b.id ? a.id : id))),
              ],
            }
          : {}),
      })),
      polylines: project.polylines.map((n) =>
        n.barIds
          ? {
              ...n,
              barIds: [
                ...new Set(n.barIds.map((id) => (id === b.id ? a.id : id))),
              ],
            }
          : n,
      ),
    },
    ownerA || project.hierarchy.details[0].id,
  );
}

/** A translation moves the physical occurrence and its linked range together. */
export function translateBar(bar: Bar, delta: Point): Bar {
  return {
    ...bar,
    origin: add(bar.origin, delta),
    distribution: bar.distribution
      ? {
          ...bar.distribution,
          start: bar.distribution.start
            ? add(bar.distribution.start, delta)
            : undefined,
          end: add(bar.distribution.end, delta),
        }
      : undefined,
  };
}

export function renumber(project: Project, options: RenumberOptions = {}) {
  return previewRenumber(project, options).project;
}

/** Transform geometry and its distribution together about the bar origin. */
export function transformBar(bar: Bar, operation: 'rotate' | 'mirror'): Bar {
  const transformPoint = (point: Point) => {
    if (operation === 'rotate')
      return add(bar.origin, rotate(sub(point, bar.origin), 90));
    const pointLocal = local(point, bar);
    return world({ x: -pointLocal.x, y: pointLocal.y }, bar);
  };
  return {
    ...bar,
    ...(operation === 'rotate'
      ? { rotation: (bar.rotation + 90) % 360 }
      : bar.stirrupProfile
        ? {
            rotation: (bar.rotation + 180) % 360,
            stirrupMirrored: !bar.stirrupMirrored,
          }
        : {
            kind: 'free' as const,
            points: vertices(bar).map((p) => ({ x: -p.x, y: p.y })),
          }),
    distribution: bar.distribution
      ? {
          ...bar.distribution,
          start: bar.distribution.start
            ? transformPoint(bar.distribution.start)
            : undefined,
          end: transformPoint(bar.distribution.end),
          ...(operation === 'mirror' &&
          bar.distribution.annotationOffset !== undefined
            ? { annotationOffset: -bar.distribution.annotationOffset }
            : {}),
        }
      : undefined,
  };
}

export type ArmatureCloneOptions = {
  barIds: string[];
  /** Explicitly selected graphics are copied once, including unlinked geometry. */
  objectIds?: string[];
  delta: Point;
  shared?: 'keep' | 'clone-set';
  position?: 'new' | 'equivalent';
  /** Absent: preserve each source drawing; present: place the entire graph in this detail. */
  detailId?: string;
  /** Optional deterministic output IDs, keyed by source object ID. */
  ids?: Record<string, string>;
};
export class ArmatureCloneError extends Error {
  constructor(
    readonly code:
      | 'NOT_FOUND'
      | 'ID_CONFLICT'
      | 'INVALID_FIELD'
      | 'SHARED_DEPENDENCY',
    message: string,
    readonly field: string,
    readonly objectId?: string,
  ) {
    super(message);
  }
}
export function planArmatureClone(
  p: Project,
  options: Pick<ArmatureCloneOptions, 'barIds' | 'objectIds' | 'shared'>,
) {
  const bars = new Set(options.barIds),
    explicit = new Set(options.objectIds ?? []);
  const all = contentObjects(p),
    barMap = new Map(p.bars.map((b) => [b.id, b]));
  for (const id of bars)
    if (!barMap.has(id))
      throw new ArmatureCloneError(
        'NOT_FOUND',
        'Armadura inexistente.',
        'barIds',
        id,
      );
  for (const id of explicit) {
    const object = all.find((o) => o.id === id);
    if (!object)
      throw new ArmatureCloneError(
        'NOT_FOUND',
        'Objeto inexistente.',
        'objectIds',
        id,
      );
    if (barMap.has(id)) bars.add(id);
  }
  if (!bars.size && !explicit.size)
    throw new ArmatureCloneError(
      'INVALID_FIELD',
      'Selecione armaduras ou objetos para copiar.',
      'barIds',
    );
  const dependents = [...p.details, ...p.annotations, ...p.polylines];
  if (bars.size && options.shared === 'clone-set') {
    let changed = true;
    while (changed) {
      changed = false;
      for (const o of dependents) {
        const refs = armatureReferences(o);
        if (!refs.some((id) => bars.has(id)) && !explicit.has(o.id)) continue;
        for (const id of refs)
          if (!bars.has(id)) {
            if (!barMap.has(id))
              throw new ArmatureCloneError(
                'NOT_FOUND',
                'Dependência física inexistente.',
                'barIds',
                id,
              );
            bars.add(id);
            changed = true;
          }
      }
    }
  }
  const objects = all.filter(
    (o) =>
      bars.has(o.id) ||
      explicit.has(o.id) ||
      armatureReferences(o).some((id) => bars.has(id)),
  );
  const external = [
    ...new Set(
      objects
        .flatMap((o) => armatureReferences(o))
        .filter((id) => !bars.has(id)),
    ),
  ];
  // Graphical-only copies do not imply cloning physical definitions.
  const sharedObjects = bars.size
    ? objects.filter(
        (o) =>
          !barMap.has(o.id) &&
          armatureReferences(o).some((id) => !bars.has(id)),
      )
    : [];
  return {
    barIds: p.bars.filter((b) => bars.has(b.id)).map((b) => b.id),
    objectIds: objects.map((o) => o.id),
    externalBarIds: external,
    sharedObjectIds: sharedObjects.map((o) => o.id),
  };
}
/** Immutable deep copy of an armature dependency graph. Validation is atomic at the AS-51 boundary. */
export function cloneArmatureGraph(p: Project, options: ArmatureCloneOptions) {
  if (!Number.isFinite(options.delta.x) || !Number.isFinite(options.delta.y))
    throw new ArmatureCloneError(
      'INVALID_FIELD',
      'Informe uma translação finita em mm.',
      'delta',
    );
  if (options.position && !['new', 'equivalent'].includes(options.position))
    throw new ArmatureCloneError(
      'INVALID_FIELD',
      'Política de posição inválida.',
      'position',
    );
  if (options.shared && !['keep', 'clone-set'].includes(options.shared))
    throw new ArmatureCloneError(
      'INVALID_FIELD',
      'Política de dependências inválida.',
      'shared',
    );
  if (
    options.detailId &&
    !p.hierarchy.details.some((d) => d.id === options.detailId)
  )
    throw new ArmatureCloneError(
      'NOT_FOUND',
      'Detalhamento inexistente.',
      'detailId',
      options.detailId,
    );
  const plan = planArmatureClone(p, options);
  if (plan.sharedObjectIds.length && !options.shared)
    throw new ArmatureCloneError(
      'SHARED_DEPENDENCY',
      'Escolha manter vínculos externos ou duplicar o conjunto compartilhado.',
      'shared',
      plan.sharedObjectIds[0],
    );
  const chosen = new Set(plan.objectIds),
    physical = new Set(plan.barIds);
  const occupied = new Set([
    p.id,
    ...contentObjects(p).map((o) => o.id),
    ...p.hierarchy.floors.map((o) => o.id),
    ...p.hierarchy.elements.map((o) => o.id),
    ...p.hierarchy.details.map((o) => o.id),
    ...p.hierarchy.drawings.map((o) => o.id),
    ...p.hierarchy.placements.map((o) => o.id),
    ...p.sheets.map((o) => o.id),
    ...fabricationPositions(p).map((o) => o.id),
  ]);
  if (options.ids && Object.keys(options.ids).some((id) => !chosen.has(id)))
    throw new ArmatureCloneError(
      'INVALID_FIELD',
      'O mapa contém objeto fora da cópia.',
      'ids',
    );
  const idMap: Record<string, string> = Object.create(null);
  for (const id of plan.objectIds) {
    const value =
      options.ids && Object.hasOwn(options.ids, id) ? options.ids[id] : uid();
    if (!value || value.length > 200 || occupied.has(value))
      throw new ArmatureCloneError(
        'ID_CONFLICT',
        'Identificador de cópia vazio, repetido ou já utilizado.',
        'ids',
        id,
      );
    occupied.add(value);
    idMap[id] = value;
  }
  const marks = new Set(p.bars.map((b) => b.mark));
  const bars = p.bars
    .filter((b) => physical.has(b.id))
    .map((b) => {
      const mark = nextFreeMark(p, marks);
      marks.add(mark);
      return {
        ...translateBar(structuredClone(b), options.delta),
        id: idMap[b.id],
        mark,
      };
    });
  const remap = (id: string) => idMap[id] ?? id;
  const remapReferences = <T extends { barId?: string; barIds?: string[] }>(
    o: T,
  ): T => ({
    ...o,
    ...(o.barId ? { barId: remap(o.barId) } : {}),
    ...(o.barIds ? { barIds: o.barIds.map(remap) } : {}),
  });
  const details = p.details
    .filter((o) => chosen.has(o.id))
    .map((o) => ({
      ...structuredClone(o),
      id: idMap[o.id],
      barId: remap(o.barId),
      origin: add(o.origin, options.delta),
      ...(!physical.has(o.barId) && o.identification === 'primary'
        ? { identification: 'mark' as const }
        : {}),
    }));
  const annotations = p.annotations
    .filter((o) => chosen.has(o.id))
    .map((o) => ({
      ...remapDimensionMasks(remapReferences(structuredClone(o)), idMap),
      id: idMap[o.id],
      points: o.points.map((v) => add(v, options.delta)),
    }));
  const polylines = p.polylines
    .filter((o) => chosen.has(o.id))
    .map((o) => ({
      ...remapReferences(structuredClone(o)),
      id: idMap[o.id],
      points: o.points.map((v) => add(v, options.delta)),
    }));
  const masks = p.masks
    .filter((o) => chosen.has(o.id))
    .map((o) => ({
      ...structuredClone(o),
      id: idMap[o.id],
      origin: add(o.origin, options.delta),
    }));
  let next = completeOwnership({
    ...p,
    bars: [...p.bars, ...bars],
    details: [...p.details, ...details],
    annotations: [...p.annotations, ...annotations],
    polylines: [...p.polylines, ...polylines],
    masks: [...p.masks, ...masks],
    hierarchy: {
      ...p.hierarchy,
      objectDetails: {
        ...p.hierarchy.objectDetails,
        ...Object.fromEntries(
          plan.objectIds.map((id) => [
            idMap[id],
            options.detailId ?? p.hierarchy.objectDetails[id],
          ]),
        ),
      },
      objectOrigins: {
        ...p.hierarchy.objectOrigins,
        ...Object.fromEntries(
          plan.objectIds.map((id) => [
            idMap[id],
            { projectId: p.id, objectId: idMap[id] },
          ]),
        ),
      },
    },
  });
  if (options.position === 'equivalent')
    for (const position of fabricationPositions(p)) {
      const added = position.barIds.filter((id) => physical.has(id)).map(remap);
      if (added.length)
        next = groupFabrication(
          next,
          [...position.barIds, ...added],
          position.barIds[0],
          position.reverse,
          position.mark,
        );
    }
  return {
    project: next,
    idMap,
    ...plan,
    createdIds: plan.objectIds.map(remap),
  };
}

export {
  transformSelection,
  angleByPoints,
  transformPoint,
  selectionTransformIds,
} from './transforms';

export { alignSelection } from './alignment';
export { editVertices } from './vertices';
