import { remapDimensionMasks } from './maskDimensions';
import { mergeLayers, remapLayer } from './layers';
import {
  armatureReferenceEdges,
  armatureReferences,
} from './armatureReferences';
import { nextFreeMark } from './marks';
import { fabricationPositions, groupFabrication } from './fabrication';
import { repetitionNames } from './detailQuantities';
import type {
  Bar,
  DetailOrigin,
  ObjectOrigin,
  Project,
  Annotation,
  Detail,
} from './types';
import { uid } from './types';
import {
  completeOwnership,
  contentObjects,
  createHierarchyNode,
  detailPath,
} from './hierarchy';
import {
  decodeProject,
  schedule,
  scheduleChanged,
  createScheduleLock,
} from './model';
import { barCaption } from './drafting';
import { alignPlacement, composeSheet } from './paper';
import { placeDrawing } from './sheets';

export type TransferOptions = {
  mode: 'insert' | 'replace';
  sourceDetailId: string;
  targetDetailId?: string;
  targetElementId?: string;
  sheetId?: string;
  name?: string;
  allowOriginChange?: boolean;
  recenterViews?: boolean;
  /** Source position -> local position; empty string explicitly requests a new ID. */
  barMap?: Record<string, string>;
  keepBars?: string[];
  /** target:ID, source:ID, import:ID, detach or remove. Missing decisions are inferred only by stable origin. */
  references?: Record<string, string>;
};
export type TransferReference = {
  key: string;
  side: 'incoming' | 'existing';
  kind: 'annotation' | 'representation' | 'polyline';
  objectId: string;
  path: string;
  barId: string;
  bar?: Bar;
  resolution: string;
  sourceAvailable: boolean;
  resolved: boolean;
};
export type TransferBarRow = {
  sourceId?: string;
  localId: string;
  before?: Bar;
  after?: Bar;
  status: 'preserved' | 'added' | 'removed' | 'kept';
  dependency?: boolean;
};
export type TransferPlan = {
  base: Project;
  mode: TransferOptions['mode'];
  project?: Project;
  targetDetailId?: string;
  issues: string[];
  warnings: string[];
  mapping: Record<string, string>;
  ambiguousBars: string[];
  bars: TransferBarRow[];
  references: TransferReference[];
  affectedViews: string[];
  physicalChanged: boolean;
  raInvalidated: boolean;
  beforeWeight: number;
  afterWeight: number;
  counts: { before: Record<string, number>; after: Record<string, number> };
};
const own = <T>(record: Record<string, T>, id: string): T | undefined =>
  Object.hasOwn(record, id) ? record[id] : undefined;
const identity = (origin: ObjectOrigin) =>
  JSON.stringify([origin.projectId, origin.objectId]);
export function objectOrigin(project: Project, id: string): ObjectOrigin {
  return (
    own(project.hierarchy.objectOrigins, id) ?? {
      projectId: project.id,
      objectId: id,
    }
  );
}
export function detailOrigin(project: Project, id: string): DetailOrigin {
  const detail = project.hierarchy.details.find((d) => d.id === id);
  const element = project.hierarchy.elements.find(
    (e) => e.id === detail?.elementId,
  );
  if (!detail || !element)
    throw new Error('Detalhamento ou elemento inexistente.');
  return (
    detail.source?.origin ?? {
      projectId: project.id,
      detailId: id,
      elementId: element.id,
      floorId: element.floorId,
    }
  );
}
export function sameDetailOrigin(a: DetailOrigin, b: DetailOrigin) {
  return (
    a.projectId === b.projectId &&
    a.detailId === b.detailId &&
    a.elementId === b.elementId &&
    a.floorId === b.floorId
  );
}
export function matchingDetails(
  target: Project,
  source: Project,
  detailId: string,
) {
  const origin = detailOrigin(source, detailId);
  return target.hierarchy.details.filter(
    (d) =>
      sameDetailOrigin(detailOrigin(target, d.id), origin) ||
      !!d.repetition?.absorbedOrigins?.some((o) => sameDetailOrigin(o, origin)),
  );
}
const weight = (p: Project) =>
  schedule({ ...p, scheduleLock: undefined }).reduce(
    (sum, r) => sum + r.weight,
    0,
  );
const fields = [
  'bars',
  'details',
  'annotations',
  'masks',
  'polylines',
] as const;
function counts(p: Project, id?: string) {
  return Object.fromEntries(
    fields.map((key) => [
      key,
      id
        ? p[key].filter((o) => p.hierarchy.objectDetails[o.id] === id).length
        : 0,
    ]),
  );
}
function physicalSignature(bars: Bar[]) {
  return JSON.stringify(
    bars
      .map((b) => ({
        id: b.id,
        kind: b.kind,
        points: b.points,
        width: b.width,
        height: b.height,
        hook: b.hook,
        diameter: b.diameter,
        mandrel: b.mandrel,
        steel: b.steel,
        quantity: b.quantity,
        multiplier: b.multiplier ?? 1,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  );
}

/** Preview is side-effect free. Only applyDetailTransfer may pass its result to history. */
export function previewDetailTransfer(
  target: Project,
  source: Project,
  options: TransferOptions,
): TransferPlan {
  const plan: TransferPlan = {
    base: target,
    mode: options.mode,
    issues: [],
    warnings: [],
    mapping: {},
    ambiguousBars: [],
    bars: [],
    references: [],
    affectedViews: [],
    physicalChanged: false,
    raInvalidated: false,
    beforeWeight: weight(target),
    afterWeight: weight(target),
    counts: { before: {}, after: {} },
  };
  try {
    const incoming = source.hierarchy.details.find(
      (d) => d.id === options.sourceDetailId,
    );
    if (!incoming) throw new Error('Escolha o detalhamento de origem.');
    const origin = detailOrigin(source, incoming.id),
      matches = matchingDetails(target, source, incoming.id);
    const oldDetail =
      options.mode === 'replace'
        ? target.hierarchy.details.find((d) => d.id === options.targetDetailId)
        : undefined;
    if (options.mode === 'replace' && !oldDetail)
      throw new Error('Escolha explicitamente o detalhamento de destino.');
    if (
      oldDetail &&
      !sameDetailOrigin(detailOrigin(target, oldDetail.id), origin) &&
      !options.allowOriginChange
    )
      plan.issues.push(
        'A origem é diferente. Confira os IDs e confirme a troca de origem para substituir este detalhamento. Nomes iguais não estabelecem equivalência.',
      );
    if (options.mode === 'insert' && matches.length)
      plan.issues.push(
        'Esta origem já existe no projeto. Use Atualizar detalhamento ou coloque outra vista pelo gerenciador para manter uma única definição de aço.',
      );
    if (
      matches.some((d) =>
        d.repetition?.absorbedOrigins?.some((o) => sameDetailOrigin(o, origin)),
      )
    )
      plan.issues.push(
        'Esta origem foi reunida em uma repetição. Desfaça a reunião ou separe as ocorrências antes de importar uma revisão individual.',
      );
    let next = target,
      detailId = oldDetail?.id;
    if (!detailId) {
      const created = createHierarchyNode(
        target,
        'detail',
        options.name || incoming.name,
        options.targetElementId,
      );
      next = created.project;
      detailId = created.id;
    }
    plan.targetDetailId = detailId;
    const importedLayers = mergeLayers(next, source.layers);
    next = importedLayers.project;
    plan.warnings.push(...importedLayers.warnings);
    source = {
      ...source,
      layers: next.layers,
      bars: source.bars.map((o) => remapLayer(o, importedLayers.map)),
      details: source.details.map((o) => remapLayer(o, importedLayers.map)),
      annotations: source.annotations.map((o) =>
        remapLayer(o, importedLayers.map),
      ),
      polylines: source.polylines.map((o) => remapLayer(o, importedLayers.map)),
      masks: source.masks.map((o) => ({
        ...remapLayer(o, importedLayers.map),
        primitives: o.primitives.map((q) => remapLayer(q, importedLayers.map)),
      })),
    };
    const ownsSource = (id: string) =>
      source.hierarchy.objectDetails[id] === incoming.id;
    const ownsOld = (id: string) =>
      !!oldDetail && target.hierarchy.objectDetails[id] === oldDetail.id;
    const sourceBars = source.bars.filter((b) => ownsSource(b.id)),
      oldBars = target.bars.filter((b) => ownsOld(b.id));
    const sourceById = new Map(source.bars.map((b) => [b.id, b])),
      oldById = new Map(target.bars.map((b) => [b.id, b]));
    const occupied = new Set([
      target.id,
      ...contentObjects(target).map((o) => o.id),
      ...target.hierarchy.floors.map((o) => o.id),
      ...target.hierarchy.elements.map((o) => o.id),
      ...next.hierarchy.details.map((o) => o.id),
      ...next.hierarchy.drawings.map((o) => o.id),
      ...target.hierarchy.placements.map((o) => o.id),
      ...target.sheets.map((o) => o.id),
    ]);
    const fresh = () => {
      let id = uid();
      while (occupied.has(id)) id = uid();
      occupied.add(id);
      return id;
    };
    const sourceToLocal = new Map<string, string>(),
      originUpdates = new Map<string, ObjectOrigin>(),
      usedLocal = new Set<string>();
    const autoBar = (b: Bar) =>
      oldBars.filter(
        (local) =>
          identity(objectOrigin(target, local.id)) ===
          identity(objectOrigin(source, b.id)),
      );
    for (const b of sourceBars) {
      const candidates = autoBar(b),
        requested = options.barMap && own(options.barMap, b.id);
      if (requested === undefined && candidates.length > 1) {
        plan.ambiguousBars.push(b.id);
        plan.issues.push(
          `${b.mark}: há mais de uma posição local com a mesma origem. Escolha explicitamente a posição preservada ou uma nova posição.`,
        );
      }
      const localId =
        requested === undefined
          ? candidates.length === 1
            ? candidates[0].id
            : ''
          : requested;
      if (
        localId &&
        (!oldBars.some((b) => b.id === localId) || usedLocal.has(localId))
      )
        plan.issues.push(
          `Mapeamento inválido ou repetido para ${b.mark}. Cada posição local pode ser preservada uma única vez dentro do destino.`,
        );
      if (
        !localId &&
        target.bars.some(
          (local) =>
            !ownsOld(local.id) &&
            identity(objectOrigin(target, local.id)) ===
              identity(objectOrigin(source, b.id)),
        )
      )
        plan.issues.push(
          `${b.mark}: a posição desta origem já existe em outro detalhamento local. Transfira a posição para o destino antes de atualizar; ela não será duplicada ou sobrescrita automaticamente.`,
        );
      if (localId) usedLocal.add(localId);
      const id = localId || fresh();
      sourceToLocal.set(b.id, id);
      plan.mapping = { ...plan.mapping, [b.id]: localId };
      originUpdates.set(id, objectOrigin(source, b.id));
    }
    const keep = new Set(options.keepBars ?? []);
    for (const id of keep)
      if (!oldBars.some((b) => b.id === id))
        plan.issues.push(
          'Uma posição mantida não pertence ao detalhamento de destino.',
        );
    const incomingRefs = [
      ...source.annotations
        .filter((a) => ownsSource(a.id))
        .flatMap((a) =>
          armatureReferenceEdges(a).map((e) => ({
            ...e,
            kind: 'annotation' as const,
          })),
        ),
      ...source.details
        .filter((a) => ownsSource(a.id))
        .flatMap((a) =>
          armatureReferenceEdges(a).map((e) => ({
            ...e,
            kind: 'representation' as const,
          })),
        ),
      ...source.polylines
        .filter((a) => ownsSource(a.id))
        .flatMap((a) =>
          armatureReferenceEdges(a).map((e) => ({
            ...e,
            kind: 'polyline' as const,
          })),
        ),
    ];
    const sourceOwned = new Set(sourceBars.map((b) => b.id));
    // Explicit dependency imports are allocated once even when several calls refer to them.
    for (const { object } of incomingRefs) {
      if (sourceOwned.has(object.barId!)) continue;
      const resolution =
        options.references && own(options.references, `incoming:${object.id}`);
      if (
        resolution === `import:${object.barId}` &&
        sourceById.has(object.barId!) &&
        !sourceToLocal.has(object.barId!)
      ) {
        const candidates = target.bars.filter(
          (b) =>
            identity(objectOrigin(target, b.id)) ===
            identity(objectOrigin(source, object.barId!)),
        );
        const local = candidates.filter((b) => ownsOld(b.id));
        if (
          candidates.some((b) => !ownsOld(b.id)) ||
          local.length > 1 ||
          (local[0] && usedLocal.has(local[0].id))
        ) {
          plan.issues.push(
            'A posição externa já existe ou tem origem ambígua em outro detalhamento. Vincule a posição local explicitamente; ela não será duplicada.',
          );
          continue;
        }
        const id = local[0]?.id ?? fresh();
        if (local[0]) usedLocal.add(id);
        sourceToLocal.set(object.barId!, id);
        originUpdates.set(id, objectOrigin(source, object.barId!));
      }
    }
    const resolved = new Map<string, string>();
    for (const { object, kind } of incomingRefs) {
      const sourceId = object.barId!;
      if (sourceOwned.has(sourceId)) {
        resolved.set(`incoming:${object.id}`, sourceToLocal.get(sourceId)!);
        continue;
      }
      const key = `incoming:${object.id}`,
        definition = sourceById.get(sourceId);
      const candidates = definition
        ? target.bars.filter(
            (b) =>
              identity(objectOrigin(target, b.id)) ===
              identity(objectOrigin(source, sourceId)),
          )
        : [];
      const automatic = sourceToLocal.has(sourceId)
        ? `source:${sourceId}`
        : candidates.length === 1
          ? `target:${candidates[0].id}`
          : '';
      const decision =
        (options.references && own(options.references, key)) ?? automatic;
      let local: string | undefined;
      if (decision.startsWith('target:') && oldById.has(decision.slice(7))) {
        local = decision.slice(7);
        if (ownsOld(local)) keep.add(local);
      }
      if (decision === `import:${sourceId}` && definition)
        local = sourceToLocal.get(sourceId);
      if (decision.startsWith('source:'))
        local = sourceToLocal.get(decision.slice(7));
      const special =
        decision === 'remove' ||
        (decision === 'detach' && kind !== 'representation');
      const valid = !!local || special;
      plan.references.push({
        key,
        side: 'incoming',
        kind,
        objectId: object.id,
        path: detailPath(source, incoming.id),
        barId: sourceId,
        bar: definition,
        resolution: decision,
        sourceAvailable: !!definition,
        resolved: valid,
      });
      if (!valid)
        plan.issues.push(
          `Resolva o vínculo de origem ${object.id} (${definition?.mark ?? `posição ausente: ${sourceId}`}).`,
        );
      resolved.set(key, local ?? (special ? decision : ''));
    }
    const retained = new Set([...usedLocal, ...keep]);
    const removed = new Set(
      oldBars.filter((b) => !retained.has(b.id)).map((b) => b.id),
    );
    const finalIds = new Set([
      ...target.bars.filter((b) => !removed.has(b.id)).map((b) => b.id),
      ...sourceToLocal.values(),
    ]);
    const needsExisting = (o: { id: string }) =>
      !ownsOld(o.id) ||
      armatureReferences(o).some((id) => keep.has(id) && !usedLocal.has(id));
    const outgoingRefs = [
      ...target.annotations.filter(needsExisting).flatMap((a) =>
        armatureReferenceEdges(a).map((e) => ({
          ...e,
          kind: 'annotation' as const,
        })),
      ),
      ...target.details.filter(needsExisting).flatMap((a) =>
        armatureReferenceEdges(a).map((e) => ({
          ...e,
          kind: 'representation' as const,
        })),
      ),
      ...target.polylines.filter(needsExisting).flatMap((a) =>
        armatureReferenceEdges(a).map((e) => ({
          ...e,
          kind: 'polyline' as const,
        })),
      ),
    ].filter((e) => e.object.barId && removed.has(e.object.barId));
    for (const { object, kind } of outgoingRefs) {
      const key = `existing:${object.id}`,
        oldId = object.barId!;
      const candidates = [...sourceToLocal].filter(
        ([sourceId]) =>
          identity(objectOrigin(source, sourceId)) ===
          identity(objectOrigin(target, oldId)),
      );
      const decision =
        (options.references && own(options.references, key)) ??
        (candidates.length === 1 ? `source:${candidates[0][0]}` : '');
      let local = decision.startsWith('target:')
        ? decision.slice(7)
        : decision.startsWith('source:')
          ? sourceToLocal.get(decision.slice(7))
          : undefined;
      if (!local || !finalIds.has(local)) local = undefined;
      const special =
          decision === 'remove' ||
          (decision === 'detach' && kind !== 'representation'),
        valid = !!local || special;
      plan.references.push({
        key,
        side: 'existing',
        kind,
        objectId: object.id,
        path: detailPath(
          target,
          target.hierarchy.objectDetails[object.id.split('/barIds/')[0]],
        ),
        barId: oldId,
        bar: oldById.get(oldId),
        resolution: decision,
        sourceAvailable: false,
        resolved: valid,
      });
      if (!valid)
        plan.issues.push(
          `Resolva o vínculo local ${object.id} para a posição removida ${oldById.get(oldId)?.mark ?? oldId}.`,
        );
      resolved.set(key, local ?? (special ? decision : ''));
    }
    const marks = new Set(
      target.bars.filter((b) => !removed.has(b.id)).map((b) => b.mark),
    );
    const uniqueMark = (preferred: string) => {
      if (
        !marks.has(preferred) &&
        !target.numbering?.reserved.includes(preferred)
      ) {
        marks.add(preferred);
        return preferred;
      }
      const mark = nextFreeMark(target, marks);
      marks.add(mark);
      return mark;
    };
    const replacements = new Map<string, Bar>();
    for (const [sourceId, localId] of sourceToLocal) {
      const b = sourceById.get(sourceId)!;
      const before = oldById.get(localId);
      const after = {
        ...structuredClone(b),
        id: localId,
        mark: before?.mark ?? uniqueMark(b.mark),
      };
      replacements.set(localId, after);
      plan.bars.push({
        sourceId,
        localId,
        before,
        after,
        status: before ? 'preserved' : 'added',
        dependency: !sourceOwned.has(sourceId),
      });
    }
    for (const b of oldBars)
      if (!replacements.has(b.id))
        plan.bars.push({
          localId: b.id,
          before: b,
          after: keep.has(b.id) ? b : undefined,
          status: keep.has(b.id) ? 'kept' : 'removed',
        });
    let bars = target.bars
      .filter((b) => !removed.has(b.id))
      .map((b) => replacements.get(b.id) ?? b);
    bars = [
      ...bars,
      ...[...replacements].filter(([id]) => !oldById.has(id)).map(([, b]) => b),
    ];
    const oldObjects = contentObjects(target).filter((o) => ownsOld(o.id));
    const graphicIds: Record<string, string> = {};
    const usedGraphics = new Set<string>();
    const objectId = (sourceId: string, kind: (typeof fields)[number]) => {
      const refs = new Set(
        target[kind]
          .filter(
            (o) =>
              ownsOld(o.id) &&
              identity(objectOrigin(target, o.id)) ===
                identity(objectOrigin(source, sourceId)),
          )
          .map((o) => o.id),
      );
      const existing = refs.size === 1 ? [...refs][0] : undefined;
      const id = existing && !usedGraphics.has(existing) ? existing : fresh();
      graphicIds[sourceId] = id;
      usedGraphics.add(id);
      originUpdates.set(id, objectOrigin(source, sourceId));
      return id;
    };
    const mapReference = <
      T extends { id: string; barId?: string; barIds?: string[] },
    >(
      object: T,
      side: 'incoming' | 'existing',
    ): T | null => {
      let out = { ...object };
      if (object.barId) {
        const choice = resolved.get(`${side}:${object.id}`);
        if (choice === 'remove') return null;
        if (choice === 'detach' && 'kind' in object && 'label' in object) {
          const a = object as unknown as Annotation;
          const old = (side === 'incoming' ? sourceById : oldById).get(
            object.barId,
          );
          out = {
            ...out,
            barId: undefined,
            label:
              a.label ||
              (old && !a.kind.startsWith('dimension-')
                ? barCaption(old, side === 'incoming' ? source : target)
                : a.label),
          };
        } else if (choice) out = { ...out, barId: choice };
      }
      if (object.barIds) {
        const refs: string[] = [];
        for (let i = 0; i < object.barIds.length; i++) {
          const choice = resolved.get(`${side}:${object.id}/barIds/${i}`);
          if (choice === 'remove') return null;
          if (choice !== 'detach') refs.push(choice || object.barIds[i]);
        }
        out = { ...out, barIds: [...new Set(refs)] };
      }
      return out;
    };
    const copyGraphics = <
      K extends 'details' | 'annotations' | 'masks' | 'polylines',
    >(
      kind: K,
    ) => {
      const incomingObjects = source[kind].filter((o) => ownsSource(o.id));
      const imported = incomingObjects.flatMap((object) => {
        const reference = mapReference(object, 'incoming');
        return reference
          ? [{ ...structuredClone(reference), id: objectId(object.id, kind) }]
          : [];
      });
      const importedIds = new Set(imported.map((o) => o.id));
      const existing = target[kind].flatMap((object) => {
        if (ownsOld(object.id)) {
          // Explicitly retained local positions keep their local linked graphics too.
          const retained =
            armatureReferences(object).some(
              (id) => keep.has(id) && !usedLocal.has(id),
            ) && !importedIds.has(object.id)
              ? mapReference(object, 'existing')
              : null;
          return retained ? [retained] : [];
        }
        const changed = mapReference(object, 'existing');
        return changed ? [changed] : [];
      });
      return [...existing, ...imported];
    };
    let annotations = copyGraphics('annotations') as Annotation[];
    const details = copyGraphics('details') as Detail[];
    const masks = copyGraphics('masks') as Project['masks'],
      polylines = copyGraphics('polylines') as Project['polylines'];
    annotations = annotations.map((a) =>
      source.annotations.some((s) => graphicIds[s.id] === a.id)
        ? remapDimensionMasks(a, graphicIds)
        : a,
    );
    const oldIds = new Set(oldObjects.map((o) => o.id));
    const objectDetails = Object.fromEntries(
      Object.entries(next.hierarchy.objectDetails).filter(
        ([id]) => !oldIds.has(id),
      ),
    );
    const importedBarIds = new Set(sourceToLocal.values());
    for (const object of [
      ...bars.filter((b) => ownsOld(b.id) || importedBarIds.has(b.id)),
      ...annotations,
      ...details,
      ...masks,
      ...polylines,
    ])
      if (!Object.hasOwn(objectDetails, object.id))
        objectDetails[object.id] = detailId;
    next = {
      ...next,
      bars,
      annotations,
      details,
      masks,
      polylines,
      hierarchy: {
        ...next.hierarchy,
        objectDetails,
        objectOrigins: {
          ...next.hierarchy.objectOrigins,
          ...Object.fromEntries(originUpdates),
        },
        details: next.hierarchy.details.map((d) =>
          d.id === detailId
            ? {
                ...d,
                name: options.name?.trim() || d.name,
                grouped: oldDetail?.grouped ?? true,
                repetition: incoming.repetition
                  ? {
                      ...structuredClone(incoming.repetition),
                      elements: repetitionNames(
                        source,
                        incoming.repetition,
                      ).map((name) => ({ name })),
                    }
                  : oldDetail?.repetition,
                source: {
                  origin,
                  projectName: source.name,
                  path: detailPath(source, incoming.id),
                  revision: source.drawing.revision,
                  ...(incoming.source?.exchange
                    ? { exchange: structuredClone(incoming.source.exchange) }
                    : {}),
                },
              }
            : d,
        ),
      },
    };
    next = completeOwnership(next, detailId);
    // Import only owned/explicitly resolved occurrences; never merge by a mark/name.
    for (const position of fabricationPositions(source)) {
      const ids = position.barIds
        .map((id) => sourceToLocal.get(id))
        .filter((id): id is string => !!id);
      if (ids.length < 2) continue;
      const first = next.bars.find((b) => b.id === ids[0])!;
      let mark = first.mark;
      if (
        fabricationPositions(next).some(
          (g) => g.mark === mark && g.barIds.some((id) => !ids.includes(id)),
        )
      ) {
        mark = nextFreeMark(next);
      }
      const lock = next.scheduleLock;
      next = {
        ...groupFabrication(next, ids, ids[0], position.reverse, mark),
        scheduleLock: lock,
      };
    }

    for (const entry of plan.bars)
      if (entry.after)
        entry.after = next.bars.find((b) => b.id === entry.localId);
    const drawingIds = new Set(
      next.hierarchy.drawings
        .filter((d) => d.detailId === detailId)
        .map((d) => d.id),
    );
    plan.affectedViews = next.hierarchy.placements
      .filter((v) => drawingIds.has(v.drawingId))
      .map((v) => v.id);
    if (options.mode === 'insert' && options.sheetId) {
      const placed = placeDrawing(
        next,
        options.sheetId,
        next.hierarchy.drawings.find((d) => d.detailId === detailId)!.id,
      );
      next = placed.project;
      plan.affectedViews.push(placed.id);
    }
    if (options.recenterViews)
      for (const id of plan.affectedViews) next = alignPlacement(next, id);
    plan.physicalChanged =
      physicalSignature(target.bars) !== physicalSignature(next.bars);
    const raDataChanged =
      plan.physicalChanged ||
      scheduleChanged({
        ...next,
        scheduleLock: createScheduleLock(target, 'comparison'),
      });
    if (raDataChanged && target.scheduleLock) {
      next = { ...next, scheduleLock: undefined };
      plan.raInvalidated = true;
    }
    plan.afterWeight = weight(next);
    plan.counts = {
      before: counts(target, oldDetail?.id),
      after: counts(next, detailId),
    };
    for (const sheet of next.sheets.filter((s) =>
      next.hierarchy.placements.some(
        (v) => v.sheetId === s.id && plan.affectedViews.includes(v.id),
      ),
    )) {
      try {
        for (const issue of composeSheet(next, sheet.id).issues.filter(
          (i) => !i.viewId || plan.affectedViews.includes(i.viewId),
        ))
          plan.warnings.push(`${sheet.name}: ${issue.message}`);
      } catch (error) {
        plan.warnings.push(
          error instanceof Error
            ? error.message
            : 'Confira o enquadramento das vistas.',
        );
      }
    }
    if (plan.issues.length === 0)
      plan.project = decodeProject(JSON.stringify(next));
  } catch (error) {
    plan.issues.push(
      error instanceof Error
        ? error.message
        : 'Não foi possível comparar os detalhamentos.',
    );
  }
  return plan;
}
export function applyDetailTransfer(
  current: Project,
  plan: TransferPlan,
): Project {
  if (current !== plan.base)
    throw new Error(
      'O projeto mudou depois da comparação. Revise uma comparação atualizada antes de aplicar.',
    );
  if (plan.issues.length || !plan.project)
    throw new Error(
      'Resolva os destinos, mapeamentos e vínculos pendentes antes de aplicar.',
    );
  return plan.project;
}
