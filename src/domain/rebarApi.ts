import {
  stirrupProfileSchema,
  stirrupDisplaySchema,
  distributionShape,
} from './stirrupSchema';
import { barCadDefaults, representationCadDefaults } from './cadDefaults';
import { alignSelection, alignmentSchema } from './alignment';
import { editVertices, vertexEditSchema } from './vertices';
import { transformSelection, selectionTransformSchema } from './transforms';
import { assertVisibilityEdit } from './visibility';
import { assertLayerEdit } from './layerProfiles';
import { validateLayers } from './layers';
import { layerBindingShape } from './layerSchema';
import { armatureReferences } from './armatureReferences';
import { representationPoints, representationPoint } from './representations';
import { renumberOptionsSchema } from './numbering';
import {
  FABRICATION_RULES,
  groupFabrication,
  ungroupFabrication,
  validateFabrication,
} from './fabrication';
import { barQuantities, validateBarQuantity } from './detailQuantities';
import { z } from 'zod';
import {
  detailContentSchema,
  representationLabelSchema,
  manufacturingSchema,
  quantitySourceSchema,
  newBar,
  nextMark,
  scheduleChanged,
  createScheduleLock,
} from './model';
import {
  completeOwnership,
  contentObjects,
  validateHierarchy,
} from './hierarchy';
import { assertDetailEdit } from './detailEditing';
import { objectOrigin } from './detailTransfer';
import { distance, geometry, world } from './geometry';
import {
  cloneArmatureGraph,
  ArmatureCloneError,
  joinBars,
  quantityForSpacing,
  renumber,
  splitBar,
  transformBar,
  translateBar,
} from './editing';
import { uid, type Bar, type Project } from './types';

export const REBAR_API_VERSION = '1.0' as const;
export const REBAR_CAPABILITIES = Object.freeze({
  version: REBAR_API_VERSION,
  lengthUnit: 'mm',
  angleUnit: 'deg',
  plotStyles: Object.freeze({
    paperUnit: 'mm',
    presets: ['color', 'monochrome', 'grayscale'] as const,
  }),
  families: Object.freeze(['free', 'stirrup'] as const),
  stirrupProfiles: Object.freeze(['rectangle', 'circle', 'free'] as const),
  stirrupHooks: Object.freeze({
    angles: [0, 90, 135, 180] as const,
    units: ['mm', 'diameters'] as const,
  }),
  distributionFits: Object.freeze(['maximum', 'fixed'] as const),
  operations: Object.freeze([
    'bar.create',
    'bar.update',
    'bar.delete',
    'bar.move',
    'bar.copy',
    'armature.clone',
    'armature.bind',
    'bar.transform',
    'selection.transform',
    'selection.align',
    'vertices.edit',
    'bar.split',
    'bar.join',
    'bar.renumber',
    'fabrication.group',
    'fabrication.ungroup',
    'distribution.set',
    'distribution.remove',
    'representation.create',
    'representation.update',
    'representation.delete',
  ] as const),
  fabrication: FABRICATION_RULES,
  armatureQuantities: Object.freeze({
    maxMultiplier: 10000,
    baseSources: Object.freeze([
      'manual',
      'distribution-quantity',
      'distribution-spacing',
    ] as const),
    assemblyMetadataDoesNotAddSteel: true,
  }),
  distributionsPerPosition: 1,
  maxBatchOperations: 10000,
  atomicBatches: true,
  representationsDoNotAddSteel: true,
  placedRepresentationLabels: true,
  segmentDimensions: Object.freeze({
    operation: 'vertices.edit',
    kinds: ['segment', 'lengthen'] as const,
    conventions: ['theoretical', 'straight'] as const,
    straightRequiresChain: true,
    localAngles: true,
  }),
  nativeLayerStyles: true,
  deepArmatureCopy: true,
  sharedClonePolicies: ['keep', 'clone-set'] as const,
});
const number = z.number().finite();
const point = z.object({ x: number, y: number }).strict();
const id = z.string().min(1).max(200);
const common = {
  ...layerBindingShape,
  multiplier: z.number().int().min(1).max(10000).optional(),
  quantitySource: quantitySourceSchema.optional(),
  quantityDisplay: z.enum(['factored', 'total']).optional(),
  comment: z.string().trim().max(500).optional(),
  ribbed: z.boolean().optional(),
  showRibbed: z.boolean().optional(),
  columnLevel: z.string().trim().max(100).optional(),
  manufacturing: manufacturingSchema.optional(),
  mark: z.string().trim().min(1).max(40).optional(),
  element: z.string().max(100).optional(),
  origin: point.optional(),
  rotation: number.optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  diameter: number.positive().max(100),
  mandrel: number.positive().max(2000),
  steel: z.enum(['CA-50', 'CA-60']),
  quantity: z.number().int().min(1).max(100000),
};
const definition = z.discriminatedUnion('kind', [
  z
    .object({
      ...common,
      kind: z.literal('free'),
      points: z.array(point).min(2).max(500),
    })
    .strict(),
  z
    .object({
      ...common,
      kind: z.literal('stirrup'),
      stirrupMirrored: z.boolean().optional(),
      stirrupProfile: stirrupProfileSchema.optional(),
      stirrupDisplay: stirrupDisplaySchema.optional(),
      width: number.positive(),
      height: number.positive(),
      hook: number.nonnegative(),
    })
    .strict(),
]);
const optionalCommon = z.object(common).partial().shape;
const patch = z.discriminatedUnion('kind', [
  z
    .object({
      ...optionalCommon,
      kind: z.literal('free'),
      points: z.array(point).min(2).max(500).optional(),
    })
    .strict(),
  z
    .object({
      ...optionalCommon,
      kind: z.literal('stirrup'),
      stirrupMirrored: z.boolean().optional(),
      stirrupProfile: stirrupProfileSchema.optional(),
      stirrupDisplay: stirrupDisplaySchema.optional(),
      width: number.positive().optional(),
      height: number.positive().optional(),
      hook: number.nonnegative().optional(),
    })
    .strict(),
]);
const distribution = z.object(distributionShape).strict();
const sharedPolicy = z.enum(['keep', 'clone-set']);
const positionPolicy = z.enum(['new', 'equivalent']);
const commandSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('selection.align'),
      ids: z.array(id).min(2).max(30000),
      options: alignmentSchema,
      sheetId: id.optional(),
    })
    .strict(),
  z
    .object({ type: z.literal('vertices.edit'), id, edit: vertexEditSchema })
    .strict(),
  z
    .object({
      type: z.literal('selection.transform'),
      ids: z.array(id).min(1).max(30000),
      transform: selectionTransformSchema,
      associated: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('armature.clone'),
      barIds: z.array(id).max(10000),
      objectIds: z.array(id).max(30000).optional(),
      delta: point,
      detailId: id.optional(),
      shared: sharedPolicy.optional(),
      position: positionPolicy.optional(),
      ids: z.record(id, id).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('armature.bind'),
      objectIds: z.array(id).min(1).max(10000),
      barIds: z
        .array(id)
        .max(10000)
        .refine((v) => new Set(v).size === v.length, 'Vínculos repetidos.'),
    })
    .strict(),
  z
    .object({
      type: z.literal('bar.create'),
      id: id.optional(),
      detailId: id,
      definition,
      provenance: z.object({ projectId: id, objectId: id }).strict().optional(),
    })
    .strict(),
  z.object({ type: z.literal('bar.update'), id, patch }).strict(),
  z
    .object({
      type: z.literal('bar.delete'),
      id,
      references: z.enum(['reject', 'remove']).optional(),
    })
    .strict(),
  z.object({ type: z.literal('bar.move'), id, delta: point }).strict(),
  z
    .object({
      type: z.literal('bar.copy'),
      id,
      newId: id.optional(),
      shared: sharedPolicy.optional(),
      position: positionPolicy.optional(),
      detailId: id.optional(),
      mark: common.mark,
      delta: point,
    })
    .strict(),
  z
    .object({
      type: z.literal('bar.transform'),
      id,
      operation: z.enum(['rotate', 'mirror']),
    })
    .strict(),
  z
    .object({
      type: z.literal('bar.split'),
      id,
      station: number,
      lap: number.nonnegative(),
    })
    .strict(),
  z.object({ type: z.literal('bar.join'), ids: z.tuple([id, id]) }).strict(),
  z
    .object({
      type: z.literal('bar.renumber'),
      options: renumberOptionsSchema.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('fabrication.group'),
      ids: z.array(id).min(2).max(10000),
      representativeId: id,
      reverse: z.boolean().optional(),
      mark: common.mark,
    })
    .strict(),
  z
    .object({
      type: z.literal('fabrication.ungroup'),
      ids: z.array(id).min(1).max(10000),
    })
    .strict(),
  z
    .object({
      type: z.literal('distribution.set'),
      barId: id,
      distribution,
      count: z.discriminatedUnion('mode', [
        z
          .object({
            mode: z.enum(['quantity', 'manual']),
            quantity: z.number().int().min(2).max(100000),
          })
          .strict(),
        z
          .object({
            mode: z.literal('spacing'),
            spacing: number.positive(),
            fit: z.enum(['maximum', 'fixed']).optional(),
          })
          .strict(),
      ]),
    })
    .strict(),
  z.object({ type: z.literal('distribution.remove'), barId: id }).strict(),
  z
    .object({
      type: z.literal('representation.create'),
      ...layerBindingShape,
      rotation: number.optional(),
      mirrored: z.boolean().optional(),
      scale: number.positive().max(10000).optional(),
      label: representationLabelSchema.optional(),
      showDimensions: z.boolean().optional(),
      identification: z.enum(['legacy', 'primary', 'mark', 'none']).optional(),
      id: id.optional(),
      barId: id,
      detailId: id.optional(),
      origin: point,
    })
    .strict(),
  z
    .object({
      type: z.literal('representation.update'),
      ...layerBindingShape,
      rotation: number.optional(),
      mirrored: z.boolean().optional(),
      scale: number.positive().max(10000).optional(),
      label: representationLabelSchema.optional(),
      showDimensions: z.boolean().optional(),
      identification: z.enum(['legacy', 'primary', 'mark', 'none']).optional(),
      id,
      origin: point.optional(),
      barId: id.optional(),
    })
    .strict(),
  z.object({ type: z.literal('representation.delete'), id }).strict(),
]);
export type RebarDefinition = z.infer<typeof definition>;
export type RebarPatch = z.infer<typeof patch>;
export type RebarCommand = z.infer<typeof commandSchema>;
export type RebarOptions = {
  units: 'mm';
  apiVersion?: typeof REBAR_API_VERSION;
  layerContext?: string;
  scopeDetailId?: string;
  schedule?: 'preserve-lock' | 'invalidate-lock';
};
export type RebarIssue = {
  code:
    | 'INVALID_FIELD'
    | 'INVALID_GEOMETRY'
    | 'INVALID_DISTRIBUTION'
    | 'UNSUPPORTED_VERSION'
    | 'UNSUPPORTED_UNIT'
    | 'NOT_FOUND'
    | 'FAMILY_MISMATCH'
    | 'ID_CONFLICT'
    | 'MARK_CONFLICT'
    | 'REFERENCE_IN_USE'
    | 'SCOPE_VIOLATION'
    | 'SOURCE_CONFLICT'
    | 'SHARED_DEPENDENCY'
    | 'INVALID_PROJECT'
    | 'STALE_BATCH';
  message: string;
  field: string;
  objectId?: string;
  operationIndex?: number;
};
export type RebarOperationReceipt = {
  index: number;
  type: RebarCommand['type'];
  ids: string[];
  topology?: Pick<
    ReturnType<typeof editVertices>,
    'vertexMap' | 'segmentMap' | 'warnings'
  >;
};
export type RebarBatchResult =
  | { ok: false; base: Project; project: Project; issues: RebarIssue[] }
  | {
      ok: true;
      base: Project;
      project: Project;
      issues: [];
      receipt: {
        apiVersion: typeof REBAR_API_VERSION;
        createdIds: string[];
        updatedIds: string[];
        deletedIds: string[];
        operations: RebarOperationReceipt[];
        affectedViews: string[];
        steelChanged: boolean;
        scheduleInvalidated: boolean;
        scheduleDirty: boolean;
      };
    };
export class RebarApiError extends Error {
  constructor(readonly issues: RebarIssue[]) {
    super(
      issues
        .map(
          (i) =>
            `${i.operationIndex !== undefined ? `Operação ${i.operationIndex + 1} · ` : ''}${i.objectId ? `${i.objectId} · ` : ''}${i.field}: ${i.message}`,
        )
        .join('\n'),
    );
    this.name = 'RebarApiError';
  }
}
const issue = (
  code: RebarIssue['code'],
  message: string,
  field: string,
  objectId?: string,
): RebarIssue => ({ code, message, field, ...(objectId ? { objectId } : {}) });
const fail = (
  code: RebarIssue['code'],
  message: string,
  field: string,
  objectId?: string,
): never => {
  throw new RebarApiError([issue(code, message, field, objectId)]);
};
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const defined = <T extends object>(value: T): T =>
  Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as T;
function fields(error: z.ZodError, objectId?: string): RebarIssue[] {
  return error.issues.flatMap((e) => {
    const keys = e.code === 'unrecognized_keys' ? e.keys : [''];
    return keys.map((key) =>
      issue(
        'INVALID_FIELD',
        e.code === 'unrecognized_keys'
          ? 'Campo incompatível com esta operação/família.'
          : e.message,
        [...e.path, key].filter((p) => p !== '').join('.') || 'command',
        objectId,
      ),
    );
  });
}

/** Shared validation for commands and existing editor transactions. Unchanged legacy geometry may be reopened. */
export function validateRebarChange(
  before: Project,
  after: Project,
  scopeDetailId?: string,
): RebarIssue[] {
  const errors: RebarIssue[] = [];
  try {
    validateLayers(after);
  } catch (e) {
    errors.push(issue('INVALID_FIELD', (e as Error).message, 'layers'));
  }
  try {
    validateHierarchy(after);
  } catch (e) {
    errors.push(issue('INVALID_PROJECT', (e as Error).message, 'hierarchy'));
  }
  if (after.bars.length > 10000)
    errors.push(
      issue('INVALID_FIELD', 'O projeto excede 10000 posições.', 'bars'),
    );
  if (after.details.length > 10000)
    errors.push(
      issue(
        'INVALID_FIELD',
        'O projeto excede 10000 representações.',
        'details',
      ),
    );
  for (const key of ['annotations', 'polylines', 'masks'] as const)
    if (after[key].length > (key === 'masks' ? 20 : 10000))
      errors.push(
        issue(
          'INVALID_FIELD',
          'A cópia excede o limite de objetos do projeto.',
          key,
        ),
      );
  const oldMasks = new Map(before.masks.map((m) => [m.id, m]));
  for (const mask of after.masks)
    if (mask !== oldMasks.get(mask.id)) {
      const valid = detailContentSchema.shape.masks.element.safeParse(mask);
      if (!valid.success) errors.push(...fields(valid.error, mask.id));
    }
  const old = new Map(before.bars.map((b) => [b.id, b]));
  try {
    validateFabrication(after);
  } catch (e) {
    errors.push(
      issue('MARK_CONFLICT', (e as Error).message, 'fabricationPositions'),
    );
  }
  for (const b of after.bars) {
    if (
      after.numbering?.reserved.includes(b.mark) &&
      old.get(b.id)?.mark !== b.mark
    )
      errors.push(
        issue('MARK_CONFLICT', 'A marca está reservada.', 'mark', b.id),
      );
    if (same(old.get(b.id), b)) continue;
    const valid = detailContentSchema.shape.bars.element.safeParse(b);
    if (!valid.success) {
      errors.push(...fields(valid.error, b.id));
      continue;
    }
    try {
      validateBarQuantity(b);
    } catch (e) {
      errors.push(
        issue('INVALID_FIELD', (e as Error).message, 'quantitySource', b.id),
      );
    }
    const g = geometry(b);
    for (const message of g.errors)
      errors.push(
        issue(
          'INVALID_GEOMETRY',
          message,
          b.kind === 'free' ? 'points' : 'shape',
          b.id,
        ),
      );
    if (
      !Number.isFinite(g.length) ||
      !Number.isFinite((g.length * barQuantities(after, b).quantity) / 1000) ||
      g.vertices.some((p) => {
        const v = world(p, b);
        return !Number.isFinite(v.x) || !Number.isFinite(v.y);
      })
    )
      errors.push(
        issue(
          'INVALID_GEOMETRY',
          'A geometria/quantidade excede os limites numéricos de cálculo.',
          'points',
          b.id,
        ),
      );
    if (
      b.distribution &&
      (b.quantity < 2 ||
        !Number.isFinite(
          distance(b.distribution.start ?? b.origin, b.distribution.end),
        ) ||
        distance(b.distribution.start ?? b.origin, b.distribution.end) < 0.01)
    )
      errors.push(
        issue(
          'INVALID_DISTRIBUTION',
          'Uma distribuição exige extensão positiva e ao menos duas peças.',
          'distribution',
          b.id,
        ),
      );
  }
  const ids = new Set(after.bars.map((b) => b.id));
  const primary = after.details
    .filter((d) => d.identification === 'primary')
    .map((d) => d.barId);
  if (new Set(primary).size !== primary.length)
    errors.push(
      issue(
        'INVALID_FIELD',
        'Uma armadura só pode ter uma descrição principal.',
        'identification',
      ),
    );
  const oldRepresentations = new Map(before.details.map((r) => [r.id, r]));
  for (const r of after.details) {
    const bar = after.bars.find((b) => b.id === r.barId);
    if (
      bar &&
      [
        ...representationPoints(bar, r),
        ...(r.label ? [representationPoint(r, r.label.origin)] : []),
      ].some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
    )
      errors.push(
        issue(
          'INVALID_GEOMETRY',
          'Transformação gráfica excede os limites numéricos.',
          'scale',
          r.id,
        ),
      );
    if (!ids.has(r.barId))
      errors.push(
        issue('NOT_FOUND', 'Armadura referenciada inexistente.', 'barId', r.id),
      );
    if (!same(r, oldRepresentations.get(r.id))) {
      const valid = detailContentSchema.shape.details.element.safeParse(r);
      if (!valid.success) errors.push(...fields(valid.error, r.id));
    }
  }
  for (const a of after.annotations)
    if (a.barId && !ids.has(a.barId))
      errors.push(
        issue('NOT_FOUND', 'Armadura referenciada inexistente.', 'barId', a.id),
      );
  for (const [kind, objects] of [
    ['annotations', after.annotations],
    ['polylines', after.polylines],
  ] as const)
    for (const object of objects) {
      const valid = detailContentSchema.shape[kind]
        .unwrap()
        .element.safeParse(object);
      if (!valid.success) errors.push(...fields(valid.error, object.id));
      for (const id of armatureReferences(object))
        if (!ids.has(id))
          errors.push(
            issue(
              'NOT_FOUND',
              'Armadura vinculada inexistente.',
              'barIds',
              object.id,
            ),
          );
    }
  if (scopeDetailId)
    try {
      assertDetailEdit(before, after, scopeDetailId);
    } catch (e) {
      errors.push(
        issue(
          'SCOPE_VIOLATION',
          (e as Error).message,
          'scopeDetailId',
          scopeDetailId,
        ),
      );
    }
  return errors;
}
function barById(p: Project, id: string): Bar {
  return (
    p.bars.find((b) => b.id === id) ??
    fail('NOT_FOUND', 'Armadura inexistente.', 'id', id)
  );
}
function detailExists(p: Project, id: string) {
  if (!p.hierarchy.details.some((d) => d.id === id))
    fail('NOT_FOUND', 'Detalhamento inexistente.', 'detailId', id);
}
function newId(p: Project, preferred?: string) {
  const occupied = new Set([
    p.id,
    ...contentObjects(p).map((o) => o.id),
    ...p.hierarchy.floors.map((o) => o.id),
    ...p.hierarchy.elements.map((o) => o.id),
    ...p.hierarchy.details.map((o) => o.id),
    ...p.hierarchy.drawings.map((o) => o.id),
    ...p.hierarchy.placements.map((o) => o.id),
    ...p.sheets.map((o) => o.id),
  ]);
  if (preferred && occupied.has(preferred))
    fail(
      'ID_CONFLICT',
      'ID já utilizado; forneça outro ID ou atualize o objeto existente.',
      'id',
      preferred,
    );
  let value = preferred ?? uid();
  while (occupied.has(value)) value = uid();
  return value;
}
function own(p: Project, id: string, detailId: string): Project {
  detailExists(p, detailId);
  return {
    ...p,
    hierarchy: {
      ...p.hierarchy,
      objectDetails: { ...p.hierarchy.objectDetails, [id]: detailId },
    },
  };
}
function replace(p: Project, b: Bar): Project {
  return { ...p, bars: p.bars.map((old) => (old.id === b.id ? b : old)) };
}

function perform(
  p: Project,
  c: RebarCommand,
  options?: RebarOptions,
): {
  project: Project;
  ids: string[];
  topology?: RebarOperationReceipt['topology'];
} {
  let next = p;
  let topology: RebarOperationReceipt['topology'];
  const touched: string[] = [];
  if (c.type === 'bar.create') {
    detailExists(p, c.detailId);
    const id = newId(p, c.id);
    if (
      c.provenance &&
      contentObjects(p).some(
        (object) =>
          objectOrigin(p, object.id).projectId === c.provenance!.projectId &&
          objectOrigin(p, object.id).objectId === c.provenance!.objectId,
      )
    )
      fail(
        'SOURCE_CONFLICT',
        'Esta origem já existe. Atualize a posição existente.',
        'provenance',
        id,
      );
    const element = p.hierarchy.elements.find(
      (e) =>
        e.id ===
        p.hierarchy.details.find((d) => d.id === c.detailId)!.elementId,
    )!;
    const b: Bar = barCadDefaults(p, {
      ...newBar(c.definition.mark ?? nextMark(p)),
      element: element.name,
      ...defined(c.definition),
      ...(!c.definition.layerId && c.definition.color !== undefined
        ? { style: { color: c.definition.color, ...c.definition.style } }
        : {}),
      id,
      ...(!c.definition.layerId && p.cadDefaults?.armatures.bar.layerId
        ? { layerId: p.cadDefaults.armatures.bar.layerId }
        : {}),
    });
    next = own({ ...p, bars: [...p.bars, b] }, id, c.detailId);
    if (c.provenance)
      next = {
        ...next,
        hierarchy: {
          ...next.hierarchy,
          objectOrigins: {
            ...next.hierarchy.objectOrigins,
            [id]: c.provenance,
          },
        },
      };
    touched.push(id);
  } else if (c.type === 'bar.update') {
    const b = barById(p, c.id);
    const source = c.patch.quantitySource ?? b.quantitySource;
    if (source?.kind === 'distribution' && !b.distribution)
      fail(
        'INVALID_DISTRIBUTION',
        'Vincule uma faixa antes de usar sua quantidade.',
        'patch.quantitySource',
        b.id,
      );
    if (
      c.patch.quantity !== undefined &&
      source?.kind === 'distribution' &&
      source.mode === 'spacing'
    )
      fail(
        'INVALID_FIELD',
        'A quantidade base vem do espaçamento da faixa. Altere o espaçamento ou mude a origem para manual/quantidade fixa.',
        'patch.quantity',
        b.id,
      );
    if (c.patch.kind !== b.kind)
      fail(
        'FAMILY_MISMATCH',
        `A posição é ${b.kind}; use os campos desta família.`,
        'patch.kind',
        c.id,
      );
    next = replace(p, {
      ...b,
      ...defined(c.patch),
      ...(c.patch.color !== undefined
        ? { style: { ...b.style, color: c.patch.color, ...c.patch.style } }
        : {}),
    });
    touched.push(c.id);
  } else if (c.type === 'bar.delete') {
    barById(p, c.id);
    if (
      c.references !== 'remove' &&
      (p.details.some((d) => d.barId === c.id) ||
        [...p.annotations, ...p.polylines].some((a) =>
          armatureReferences(a).includes(c.id),
        ))
    )
      fail(
        'REFERENCE_IN_USE',
        'A posição tem representações/chamadas. Use references: remove para removê-las explicitamente.',
        'references',
        c.id,
      );
    next = {
      ...p,
      bars: p.bars.filter((b) => b.id !== c.id),
      details: p.details.filter((r) => r.barId !== c.id),
      annotations: p.annotations
        .filter(
          (a) =>
            a.barId !== c.id &&
            !(
              armatureReferences(a).length === 1 &&
              armatureReferences(a)[0] === c.id
            ),
        )
        .map((a) =>
          a.barIds?.includes(c.id)
            ? { ...a, barIds: a.barIds.filter((id) => id !== c.id) }
            : a,
        ),
      polylines: p.polylines
        .filter(
          (a) =>
            !(
              armatureReferences(a).length === 1 &&
              armatureReferences(a)[0] === c.id
            ),
        )
        .map((a) =>
          a.barIds?.includes(c.id)
            ? { ...a, barIds: a.barIds.filter((id) => id !== c.id) }
            : a,
        ),
    };
    touched.push(c.id);
  } else if (c.type === 'bar.move') {
    next = replace(p, translateBar(barById(p, c.id), c.delta));
    touched.push(c.id);
  } else if (c.type === 'bar.copy' || c.type === 'armature.clone') {
    try {
      const options =
        c.type === 'bar.copy'
          ? {
              barIds: [c.id],
              delta: c.delta,
              detailId: c.detailId,
              shared: c.shared,
              position: c.position,
              ids: c.newId ? { [c.id]: c.newId } : undefined,
            }
          : c;
      const clone = cloneArmatureGraph(p, options);
      next = clone.project;
      if (c.type === 'bar.copy' && c.mark) {
        if (c.position === 'equivalent')
          fail(
            'INVALID_FIELD',
            'A posição equivalente usa a marca do original.',
            'mark',
            c.id,
          );
        next = replace(next, {
          ...barById(next, clone.idMap[c.id]),
          mark: c.mark,
        });
      }
      touched.push(...clone.createdIds);
    } catch (e) {
      if (e instanceof ArmatureCloneError)
        fail(e.code, e.message, e.field, e.objectId);
      throw e;
    }
  } else if (c.type === 'armature.bind') {
    c.barIds.forEach((id) => barById(p, id));
    const allowed = new Set(
      [...p.annotations, ...p.polylines].map((o) => o.id),
    );
    for (const id of c.objectIds)
      if (!allowed.has(id))
        fail(
          'NOT_FOUND',
          'Selecione anotações ou linhas auxiliares existentes.',
          'objectIds',
          id,
        );
    const selected = new Set(c.objectIds);
    next = {
      ...p,
      annotations: p.annotations.map((o) =>
        selected.has(o.id) ? { ...o, barIds: [...c.barIds] } : o,
      ),
      polylines: p.polylines.map((o) =>
        selected.has(o.id) ? { ...o, barIds: [...c.barIds] } : o,
      ),
    };
    touched.push(...c.objectIds);
  } else if (c.type === 'selection.align') {
    next = alignSelection(p, c.ids, c.options, {
      sheetId: c.sheetId,
      layerContext: options?.layerContext,
      scopeDetailId: options?.scopeDetailId,
    }).project;
    touched.push(...c.ids);
  } else if (c.type === 'vertices.edit') {
    const result = editVertices(p, c.id, c.edit, {
      layerContext: options?.layerContext,
      scopeDetailId: options?.scopeDetailId,
    });
    next = result.project;
    topology = {
      vertexMap: result.vertexMap,
      segmentMap: result.segmentMap,
      warnings: result.warnings,
    };
    touched.push(c.id);
  } else if (c.type === 'selection.transform') {
    next = transformSelection(p, c.ids, c.transform, {
      associated: c.associated,
      layerContext: options?.layerContext,
      scopeDetailId: options?.scopeDetailId,
    });
    touched.push(...c.ids);
  } else if (c.type === 'bar.transform') {
    next = replace(p, transformBar(barById(p, c.id), c.operation));
    touched.push(c.id);
  } else if (c.type === 'bar.split') {
    barById(p, c.id);
    next = splitBar(p, c.id, c.station, c.lap);
    touched.push(
      c.id,
      ...next.bars
        .filter((b) => !p.bars.some((old) => old.id === b.id))
        .map((b) => b.id),
    );
  } else if (c.type === 'bar.join') {
    c.ids.forEach((id) => barById(p, id));
    next = joinBars(p, c.ids);
    touched.push(...c.ids);
  } else if (c.type === 'fabrication.group') {
    c.ids.forEach((id) => barById(p, id));
    barById(p, c.representativeId);
    next = groupFabrication(
      p,
      c.ids,
      c.representativeId,
      c.reverse ?? true,
      c.mark,
    );
    touched.push(...c.ids);
  } else if (c.type === 'fabrication.ungroup') {
    c.ids.forEach((id) => barById(p, id));
    next = ungroupFabrication(p, c.ids);
    touched.push(...c.ids);
  } else if (c.type === 'bar.renumber') {
    next = renumber(p, c.options);
    touched.push(...p.bars.map((b) => b.id));
  } else if (c.type === 'distribution.set') {
    const b = barById(p, c.barId),
      length = distance(c.distribution.start ?? b.origin, c.distribution.end);
    const quantity =
      c.count.mode === 'spacing'
        ? quantityForSpacing(length, c.count.spacing, c.count.fit)
        : c.count.quantity;
    const quantitySource =
      c.count.mode === 'manual'
        ? { kind: 'manual' as const }
        : c.count.mode === 'spacing'
          ? {
              kind: 'distribution' as const,
              mode: 'spacing' as const,
              spacing: c.count.spacing,
              ...(c.count.fit ? { fit: c.count.fit } : {}),
            }
          : { kind: 'distribution' as const, mode: 'quantity' as const };
    next = replace(p, {
      ...b,
      quantity,
      quantitySource,
      distribution: c.distribution,
    });
    touched.push(b.id);
  } else if (c.type === 'distribution.remove') {
    const b = barById(p, c.barId);
    next = replace(p, {
      ...b,
      distribution: undefined,
      quantitySource: { kind: 'manual' },
    });
    touched.push(b.id);
  } else if (c.type === 'representation.create') {
    barById(p, c.barId);
    const id = newId(p, c.id);
    next = own(
      {
        ...p,
        details: [
          ...p.details,
          {
            ...representationCadDefaults(p, {
              id,
              barId: c.barId,
              origin: c.origin,
            }),
            id,
            barId: c.barId,
            origin: c.origin,
            ...defined({
              drafting: c.drafting,
              layerId: c.layerId,
              style: c.style,
              plot: c.plot,
              rotation: c.rotation,
              mirrored: c.mirrored,
              scale: c.scale,
              identification: c.identification,
              label: c.label,
              showDimensions: c.showDimensions,
            }),
          },
        ],
      },
      id,
      c.detailId ?? p.hierarchy.objectDetails[c.barId],
    );
    touched.push(id);
  } else {
    const r =
      p.details.find((r) => r.id === c.id) ??
      fail('NOT_FOUND', 'Representação inexistente.', 'id', c.id);
    if (c.type === 'representation.delete')
      next = { ...p, details: p.details.filter((r) => r.id !== c.id) };
    else {
      if (c.barId) barById(p, c.barId);
      next = {
        ...p,
        details: p.details.map((old) =>
          old.id === c.id
            ? {
                ...r,
                ...defined({
                  drafting: c.drafting,
                  layerId: c.layerId,
                  style: c.style,
                  plot: c.plot,
                  rotation: c.rotation,
                  mirrored: c.mirrored,
                  scale: c.scale,
                  identification: c.identification,
                  label: c.label,
                  showDimensions: c.showDimensions,
                }),
                ...(c.origin ? { origin: c.origin } : {}),
                ...(c.barId ? { barId: c.barId } : {}),
              }
            : old,
        ),
      };
    }
    touched.push(c.id);
  }
  if (
    (c.type === 'representation.create' ||
      c.type === 'representation.update') &&
    c.identification === 'primary'
  ) {
    const chosen = next.details.find((d) => d.id === touched[0])!;
    next = {
      ...next,
      details: next.details.map((d) =>
        d.id !== chosen.id && d.barId === chosen.barId
          ? { ...d, identification: 'mark' as const }
          : d,
      ),
    };
  }
  return {
    project: completeOwnership(next),
    ids: touched,
    ...(topology ? { topology } : {}),
  };
}

/** Synchronous immutable transaction: no draft escapes and any failure returns the original project. */
export function executeRebarBatch(
  project: Project,
  commands: readonly RebarCommand[],
  options: RebarOptions,
): RebarBatchResult {
  const reject = (issues: RebarIssue[]): RebarBatchResult => ({
    ok: false,
    base: project,
    project,
    issues,
  });
  if (options?.units !== 'mm')
    return reject([
      issue(
        'UNSUPPORTED_UNIT',
        'A API usa exclusivamente mm. Converta as medidas antes da chamada; pacotes AS-09 têm conversão própria.',
        'units',
      ),
    ]);
  if (
    options.apiVersion !== undefined &&
    options.apiVersion !== REBAR_API_VERSION
  )
    return reject([
      issue(
        'UNSUPPORTED_VERSION',
        `Versão suportada: ${REBAR_API_VERSION}.`,
        'apiVersion',
      ),
    ]);
  if (
    options.schedule !== undefined &&
    !['preserve-lock', 'invalidate-lock'].includes(options.schedule)
  )
    return reject([
      issue('INVALID_FIELD', 'Política de RA desconhecida.', 'schedule'),
    ]);
  if (
    !Array.isArray(commands) ||
    !commands.length ||
    commands.length > REBAR_CAPABILITIES.maxBatchOperations
  )
    return reject([
      issue('INVALID_FIELD', 'Forneça de 1 a 10000 operações.', 'commands'),
    ]);
  let next = project,
    operationIndex = 0;
  const operations: RebarOperationReceipt[] = [];
  try {
    if (
      options.scopeDetailId !== undefined &&
      (typeof options.scopeDetailId !== 'string' ||
        !options.scopeDetailId.length)
    )
      return reject([
        issue(
          'INVALID_FIELD',
          'Informe um ID de detalhamento válido.',
          'scopeDetailId',
        ),
      ]);
    try {
      validateHierarchy(project);
    } catch (e) {
      return reject([
        issue('INVALID_PROJECT', (e as Error).message, 'project.hierarchy'),
      ]);
    }
    if (options.scopeDetailId) detailExists(project, options.scopeDetailId);
    for (const raw of commands) {
      const parsed = commandSchema.safeParse(raw);
      if (!parsed.success)
        throw new RebarApiError(
          fields(
            parsed.error,
            raw && typeof raw === 'object'
              ? 'id' in raw
                ? raw.id
                : 'barId' in raw
                  ? raw.barId
                  : undefined
              : undefined,
          ),
        );
      if (
        options.scopeDetailId &&
        (parsed.data.type === 'fabrication.group' ||
          parsed.data.type === 'fabrication.ungroup' ||
          parsed.data.type === 'bar.renumber' ||
          ((parsed.data.type === 'armature.clone' ||
            parsed.data.type === 'bar.copy') &&
            parsed.data.position === 'equivalent'))
      )
        fail(
          'INVALID_FIELD',
          'Conclua a edição isolada antes de organizar posições de fabricação.',
          'scopeDetailId',
          options.scopeDetailId,
        );
      const result = perform(next, parsed.data, options);
      assertLayerEdit(next, result.project, options.layerContext ?? 'model');
      assertVisibilityEdit(
        next,
        result.project,
        options.layerContext ?? 'model',
      );
      const errors = validateRebarChange(
        next,
        result.project,
        options.scopeDetailId,
      );
      if (errors.length) throw new RebarApiError(errors);
      next = result.project;
      operations.push({
        index: operationIndex,
        type: parsed.data.type,
        ids: result.ids,
        ...(result.topology ? { topology: result.topology } : {}),
      });
      operationIndex++;
    }
    const steelChanged = scheduleChanged({
      ...next,
      scheduleLock: createScheduleLock(project, 'comparison'),
    });
    const scheduleInvalidated =
      !!project.scheduleLock &&
      (!next.scheduleLock ||
        (options.schedule === 'invalidate-lock' && steelChanged));
    if (scheduleInvalidated) next = { ...next, scheduleLock: undefined };
    if (options.scopeDetailId) {
      const errors = validateRebarChange(project, next, options.scopeDetailId);
      if (errors.length) throw new RebarApiError(errors);
    }
    const before = new Map(contentObjects(project).map((o) => [o.id, o]));
    const after = new Map(contentObjects(next).map((o) => [o.id, o]));
    const updatedIds = [...after.keys()].filter(
      (id) => before.has(id) && !same(before.get(id), after.get(id)),
    );
    const createdIds = [...after.keys()].filter((id) => !before.has(id));
    const deletedIds = [...before.keys()].filter((id) => !after.has(id));
    const touched = new Set([...updatedIds, ...createdIds, ...deletedIds]);
    const changedBars = new Set(
      [...project.bars, ...next.bars]
        .filter((b) => touched.has(b.id))
        .map((b) => b.id),
    );
    const affectedDetails = new Set(
      [...touched]
        .flatMap((id) => [
          project.hierarchy.objectDetails[id],
          next.hierarchy.objectDetails[id],
        ])
        .filter(Boolean),
    );
    for (const p of [project, next])
      for (const r of [...p.details, ...p.annotations, ...p.polylines])
        if (armatureReferences(r).some((id) => changedBars.has(id)))
          affectedDetails.add(p.hierarchy.objectDetails[r.id]);
    const drawingIds = new Set(
      next.hierarchy.drawings
        .filter((d) => affectedDetails.has(d.detailId))
        .map((d) => d.id),
    );
    return {
      ok: true,
      base: project,
      project: next,
      issues: [],
      receipt: {
        apiVersion: REBAR_API_VERSION,
        operations,
        createdIds,
        updatedIds,
        deletedIds,
        affectedViews: next.hierarchy.placements
          .filter((v) => drawingIds.has(v.drawingId))
          .map((v) => v.id),
        steelChanged,
        scheduleInvalidated,
        scheduleDirty: scheduleChanged(next),
      },
    };
  } catch (e) {
    const errors =
      e instanceof RebarApiError
        ? e.issues
        : [
            issue(
              'INVALID_FIELD',
              e instanceof Error ? e.message : 'Operação inválida.',
              'command',
            ),
          ];
    return reject(
      errors.map((e) => ({
        ...e,
        ...(e.objectId
          ? {}
          : (() => {
              const c = commands[Math.min(operationIndex, commands.length - 1)];
              return c && typeof c === 'object'
                ? {
                    objectId:
                      'id' in c ? c.id : 'barId' in c ? c.barId : undefined,
                  }
                : {};
            })()),
        operationIndex: Math.min(operationIndex, commands.length - 1),
      })),
    );
  }
}
export function applyRebarBatch(
  current: Project,
  result: RebarBatchResult,
): Project {
  if (!result.ok) throw new RebarApiError(result.issues);
  if (result.base !== current)
    throw new RebarApiError([
      issue(
        'STALE_BATCH',
        'O projeto mudou desde a execução do lote.',
        'project',
      ),
    ]);
  return result.project;
}
/** Adapter for existing Bar persistence; unused fields never leak across family boundaries. */
export function rebarDefinition(bar: Bar): RebarDefinition {
  const common = {
    drafting: bar.drafting,
    layerId: bar.layerId,
    style: bar.style,
    plot: bar.plot,
    manufacturing: bar.manufacturing,
    mark: bar.mark,
    element: bar.element,
    origin: bar.origin,
    rotation: bar.rotation,
    diameter: bar.diameter,
    mandrel: bar.mandrel,
    steel: bar.steel,
    quantity: bar.quantity,
    multiplier: bar.multiplier,
    quantitySource: bar.quantitySource,
    quantityDisplay: bar.quantityDisplay,
    comment: bar.comment,
    ribbed: bar.ribbed,
    showRibbed: bar.showRibbed,
    columnLevel: bar.columnLevel,
    color: bar.color,
  };
  return bar.kind === 'free'
    ? { ...common, kind: 'free', points: bar.points }
    : {
        ...common,
        kind: 'stirrup',
        stirrupMirrored: bar.stirrupMirrored,
        stirrupProfile: bar.stirrupProfile,
        stirrupDisplay: bar.stirrupDisplay,
        width: bar.width,
        height: bar.height,
        hook: bar.hook,
      };
}
