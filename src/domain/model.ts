import {
  dimensionPresentationSchema,
  maskDimensionReferencesSchema,
} from './maskDimensions';
import { cadDefaultsSchema, validateCadDefaults } from './cadDefaults';
import { validateNativeMask } from './nativeMasks';
import { sheetSteelScheduleSchema } from './sheetSchedule';
import { pruneVisibility } from './visibilitySchema';
import { plotSettingsSchema } from './layerSchema';
import { layerEnvironmentSchema } from './layerProfiles';
import { defaultLayers, completeLayers, validateLayers } from './layers';
import { drawingLayerSchema, layerBindingShape } from './layerSchema';
import { armatureReferences } from './armatureReferences';
import { representationPoints } from './representations';
import { nextFreeMark, numberingPolicySchema } from './marks';
import { z } from 'zod';
import { fabricationPositions, validateFabrication } from './fabrication';
import {
  quantityContext,
  localBarQuantities,
  quantityExpression,
  validateBarQuantity,
  hasArmatureData,
} from './detailQuantities';
import { geometry, vertices, world } from './geometry';
import { uid, type Bar, type Project, type ScheduleRow } from './types';
import {
  completeOwnership,
  initialHierarchy,
  legacyProjectId,
  validateHierarchy,
} from './hierarchy';
import { initialSheet, placeDrawing } from './sheets';
import { fitPlacement } from './paper';
import { validateSheetLayout } from './paperFormat';
const number = z.number().finite();
const point = z.object({ x: number, y: number });
const identity = z.string().min(1).max(200);
const named = { id: identity, name: z.string().trim().min(1).max(100) };
export const exchangeMetadataSchema = z.object({
  producer: z.object({
    app: z.string().min(1).max(100),
    version: z.string().max(40),
  }),
  exportedAt: z.iso.datetime(),
  metadata: z
    .record(z.string().min(1).max(100), z.string().max(5000))
    .refine((m) => Object.keys(m).length <= 100, 'Use até 100 metadados.'),
});
export const repetitionSchema = z
  .object({
    factor: z.number().int().min(1).max(10000),
    elements: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(500),
          elementId: identity.optional(),
        }),
      )
      .max(10000),
    absorbedOrigins: z
      .array(
        z.object({
          projectId: identity,
          floorId: identity,
          elementId: identity,
          detailId: identity,
        }),
      )
      .max(10000)
      .optional(),
  })
  .refine(
    (r) => !r.elements.length || r.elements.length === r.factor,
    'Informe um nome por repetição, ou deixe todos os nomes vazios.',
  );
const hierarchySchema = z.object({
  floors: z
    .array(z.object({ ...named, name: z.string().min(1).max(150) }))
    .min(1)
    .max(1000),
  elements: z
    .array(z.object({ ...named, floorId: identity }))
    .min(1)
    .max(10000),
  details: z
    .array(
      z.object({
        ...named,
        elementId: identity,
        grouped: z.boolean().optional(),
        repetition: repetitionSchema.optional(),
        source: z
          .object({
            origin: z.object({
              projectId: identity,
              floorId: identity,
              elementId: identity,
              detailId: identity,
            }),
            projectName: z.string().max(150),
            path: z.string().max(500),
            revision: z.string().max(40),
            exchange: exchangeMetadataSchema.optional(),
          })
          .optional(),
      }),
    )
    .min(1)
    .max(10000),
  drawings: z
    .array(z.object({ ...named, detailId: identity }))
    .min(1)
    .max(10000),
  placements: z
    .array(
      z.object({
        id: identity,
        drawingId: identity,
        sheetId: identity.optional(),
        modelOrigin: point.optional(),
        textHeight: number.min(2).max(10).optional(),
        title: z.string().max(200).optional(),
        legacyScale: number.positive().optional(),
        frame: z
          .object({
            width: number.positive().max(100000),
            height: number.positive().max(100000),
          })
          .optional(),
        origin: point,
        rotation: number,
        scale: number.positive().max(1000000),
      }),
    )
    .max(10000),
  objectDetails: z.record(z.string(), identity),
  objectOrigins: z
    .record(z.string(), z.object({ projectId: identity, objectId: identity }))
    .optional(),
});
export const terminationSchema = z
  .object({
    kind: z.enum(['plain', 'coupler', 'threaded', 'headed']),
    code: z.string().trim().max(100),
  })
  .strict()
  .refine(
    (v) => (v.kind === 'plain' ? v.code.length === 0 : v.code.length > 0),
    'Identifique a especificação da terminação/luva.',
  );
export const manufacturingSchema = z
  .object({
    start: terminationSchema.optional(),
    end: terminationSchema.optional(),
    variant: z.string().trim().max(100).optional(),
  })
  .strict();
export const fabricationPositionSchema = z
  .object({
    id: z.string().min(1).max(500),
    mark: z.string().min(1).max(40),
    barIds: z.array(identity).min(1).max(10000),
    reverse: z.boolean(),
    signature: z.string().max(200000),
  })
  .strict();
export const quantitySourceSchema = z.union([
  z.object({ kind: z.literal('manual') }).strict(),
  z
    .object({ kind: z.literal('distribution'), mode: z.literal('quantity') })
    .strict(),
  z
    .object({
      kind: z.literal('distribution'),
      mode: z.literal('spacing'),
      spacing: number.positive(),
    })
    .strict(),
]);
export const armatureDataSchema = {
  multiplier: z.number().int().min(1).max(10000).default(1),
  quantitySource: quantitySourceSchema.default({ kind: 'manual' }),
  quantityDisplay: z.enum(['factored', 'total']).optional(),
  comment: z.string().trim().max(500).optional(),
  ribbed: z.boolean().optional(),
  showRibbed: z.boolean().optional(),
  columnLevel: z.string().trim().max(100).optional(),
};
const barSchema = z
  .object({
    ...layerBindingShape,
    ...armatureDataSchema,
    manufacturing: manufacturingSchema.optional(),
    id: z.string(),
    mark: z.string().min(1).max(40),
    element: z.string().max(100),
    kind: z.enum(['free', 'stirrup']),
    stirrupMirrored: z.boolean().optional(),
    origin: point,
    rotation: number,
    points: z.array(point).min(2).max(500),
    width: number.positive(),
    height: number.positive(),
    hook: number.nonnegative(),
    diameter: number.positive().max(100),
    mandrel: number.positive().max(2000),
    steel: z.enum(['CA-50', 'CA-60']),
    quantity: z.number().int().min(1).max(100000),
    distribution: z
      .object({
        start: point.optional(),
        end: point,
        render: z.enum(['ticks', 'bars']).optional(),
      })
      .optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  })
  .strict();
export const representationLabelSchema = z
  .object({
    origin: point,
    rotation: number,
    height: number.positive().max(100000),
    omitPrefix: z.string().max(40).optional(),
  })
  .strict();
const schema = z.object({
  schema: z.enum([
    'armadurastruct/1',
    'armadurastruct/2',
    'armadurastruct/3',
    'armadurastruct/4',
    'armadurastruct/5',
    'armadurastruct/6',
    'armadurastruct/7',
    'armadurastruct/8',
    'armadurastruct/9',
    'armadurastruct/10',
    'armadurastruct/11',
    'armadurastruct/12',
    'armadurastruct/13',
    'armadurastruct/14',
    'armadurastruct/15',
    'armadurastruct/16',
    'armadurastruct/17',
    'armadurastruct/18',
    'armadurastruct/19',
  ]),
  cadDefaults: cadDefaultsSchema.optional(),
  layerEnvironment: layerEnvironmentSchema.optional(),
  plotting: plotSettingsSchema.optional(),
  layers: z.array(drawingLayerSchema).min(1).max(2000).optional(),
  numbering: numberingPolicySchema.optional(),
  sheets: z
    .array(
      z.object({
        ...named,
        steelSchedule: sheetSteelScheduleSchema.optional(),
        format: z.enum(['A0', 'A1', 'A2', 'A3', 'A4', 'custom']),
        customSize: z
          .object({
            width: number.min(50).max(5000),
            height: number.min(50).max(5000),
          })
          .optional(),
        margins: z
          .object({
            left: number.nonnegative(),
            right: number.nonnegative(),
            top: number.nonnegative(),
            bottom: number.nonnegative(),
          })
          .optional(),
        seal: z
          .object({
            enabled: z.boolean(),
            width: number.positive().max(5000),
            height: number.positive().max(5000),
          })
          .optional(),
        orientation: z.enum(['portrait', 'landscape']),
        properties: z.object({
          revision: z.string().max(40),
          notes: z.string().max(5000),
        }),
      }),
    )
    .max(1000)
    .optional(),
  id: identity.optional(),
  hierarchy: hierarchySchema.optional(),
  name: z.string().min(1).max(150),
  author: z.string().max(150),
  notes: z.string().max(5000),
  bars: z.array(barSchema).max(10000),
  fabricationPositions: z
    .array(fabricationPositionSchema)
    .max(10000)
    .optional(),
  polylines: z
    .array(
      z.object({
        ...layerBindingShape,
        id: z.string(),
        points: z.array(point).min(2).max(500),
        barIds: z
          .array(identity)
          .max(10000)
          .refine((v) => new Set(v).size === v.length, 'Vínculos repetidos.')
          .optional(),
        closed: z.boolean(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      }),
    )
    .max(10000)
    .default([]),
  annotations: z
    .array(
      z.object({
        ...layerBindingShape,
        id: z.string(),
        kind: z.enum([
          'dimension-aligned',
          'dimension-orthogonal',
          'leader',
          'section',
          'section-arc',
        ]),
        points: z.array(point).length(3),
        frameRotation: number.optional(),
        maskReferences: maskDimensionReferencesSchema.optional(),
        dimensionPresentation: dimensionPresentationSchema.optional(),
        barId: z.string().optional(),
        barIds: z
          .array(identity)
          .max(10000)
          .refine((v) => new Set(v).size === v.length, 'Vínculos repetidos.')
          .optional(),
        label: z.string().max(200),
        textHeight: number.positive().max(10000),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      }),
    )
    .max(10000)
    .default([]),
  drawing: z
    .object({
      floor: z.string().max(150),
      revision: z.string().max(40),
      scale: number.min(0).max(10000),
    })
    .default({ floor: '', revision: '00', scale: 0 }),
  scheduleLock: z
    .object({
      at: z.string(),
      origins: z.record(z.string(), z.string()).optional(),
      detailIds: z.record(z.string(), z.string()).optional(),
      bars: z.array(barSchema).max(10000),
      fabricationPositions: z
        .array(fabricationPositionSchema)
        .max(10000)
        .optional(),
      quantities: z
        .record(
          z.string(),
          z.object({
            repetitions: z.number().int().min(1).max(10000),
            detailTitle: z.string().max(8000000),
          }),
        )
        .optional(),
    })
    .optional(),
  details: z
    .array(
      z.object({
        ...layerBindingShape,
        id: z.string(),
        barId: z.string(),
        origin: point,
        rotation: number.optional(),
        mirrored: z.boolean().optional(),
        scale: number.positive().max(10000).optional(),
        label: representationLabelSchema.optional(),
        showDimensions: z.boolean().optional(),
        identification: z
          .enum(['legacy', 'primary', 'mark', 'none'])
          .optional(),
      }),
    )
    .max(10000),
  masks: z
    .array(
      z.object({
        ...layerBindingShape,
        id: z.string(),
        name: z.string().max(200),
        format: z.enum(['DXF', 'DWG', 'DEMO', 'NATIVE']),
        layerDefinitions: z.array(drawingLayerSchema).max(2000).optional(),
        primitives: z
          .array(
            z.object({
              ...layerBindingShape,
              id: z.string().optional(),
              sourceEntityId: z.string().min(1).max(1000).optional(),
              native: z
                .discriminatedUnion('kind', [
                  z.object({
                    kind: z.literal('arc'),
                    center: point,
                    radius: number.positive(),
                    startAngle: number.min(-360000).max(360000),
                    sweepAngle: number.refine(
                      (n) => Math.abs(n) > 1e-10 && Math.abs(n) < 360,
                      'Abertura do arco inválida.',
                    ),
                  }),
                  z.object({
                    kind: z.literal('circle'),
                    center: point,
                    radius: number.positive(),
                  }),
                  ...(['line', 'rectangle', 'polyline'] as const).map((kind) =>
                    z.object({
                      kind: z.literal(kind),
                      points: z.array(point).min(2).max(500),
                      closed: z.boolean(),
                    }),
                  ),
                ])
                .optional(),
              layer: z.string(),
              points: z.array(point).max(100000),
              closed: z.boolean().optional(),
              text: z.string().optional(),
              textHeight: number.optional(),
              textRotation: number.optional(),
              textAlign: z.enum(['left', 'center', 'right']).optional(),
            }),
          )
          .max(100000),
        layers: z.record(z.string(), z.boolean()),
        visible: z.boolean(),
        opacity: number.min(0).max(1),
        scale: number.positive().max(1000000),
        origin: point,
        rotation: number,
        sourceUnit: z.string(),
        warnings: z.array(z.string()),
      }),
    )
    .max(20),
});
/** Shared physical/graphical validation at the open exchange boundary. */
export const detailContentSchema = schema.pick({
  bars: true,
  details: true,
  masks: true,
  annotations: true,
  polylines: true,
});

export function decodeProject(
  raw: string,
  options: { allowOrphanReferences?: boolean } = {},
): Project {
  const input = JSON.parse(raw);
  const dimensionVersion = input?.schema === 'armadurastruct/24';
  if (
    !dimensionVersion &&
    input?.annotations?.some(
      (a: { maskReferences?: unknown; dimensionPresentation?: unknown }) =>
        a.maskReferences || a.dimensionPresentation,
    )
  )
    throw new Error(
      'Referências estáticas de máscaras e unidades de cota exigem formato 24.',
    );
  const arcVersion = dimensionVersion || input?.schema === 'armadurastruct/23';
  if (
    !arcVersion &&
    input?.masks?.some(
      (m: {
        primitives?: { native?: { kind?: string }; sourceEntityId?: string }[];
      }) =>
        m.primitives?.some((q) => q.native?.kind === 'arc' || q.sourceEntityId),
    )
  )
    throw new Error('Arcos e edição local CAD exigem formato 23.');
  const settingsVersion = arcVersion || input?.schema === 'armadurastruct/22';
  if (
    !settingsVersion &&
    (input?.cadDefaults ||
      [
        ...(input?.bars ?? []),
        ...(input?.details ?? []),
        ...(input?.annotations ?? []),
        ...(input?.polylines ?? []),
        ...(input?.masks ?? []),
        ...(input?.masks ?? []).flatMap(
          (m: { primitives?: unknown[] }) => m.primitives ?? [],
        ),
        ...(input?.scheduleLock?.bars ?? []),
      ].some((o) => o.drafting))
  )
    throw new Error('Padrões CAD exigem formato 22.');
  const mixedVersion = settingsVersion || input?.schema === 'armadurastruct/21';
  const nativeVersion = mixedVersion || input?.schema === 'armadurastruct/20';
  if (
    !mixedVersion &&
    input?.masks?.some(
      (m: { format: string; primitives?: { native?: unknown }[] }) =>
        m.format !== 'NATIVE' && m.primitives?.some((q) => q.native),
    )
  )
    throw new Error('Desenho local em referência importada exige formato 21.');
  if (nativeVersion) input.schema = 'armadurastruct/19';
  if (
    !nativeVersion &&
    input?.masks?.some((m: { format: string }) => m.format === 'NATIVE')
  )
    throw new Error('Máscaras nativas exigem formato 20.');
  if (
    typeof input?.schema === 'string' &&
    input.schema.startsWith('openstruct.detail/')
  )
    throw new Error(
      'Para importar um pacote OpenStruct, use Elementos → Inserir detalhamento no projeto de destino.',
    );
  const parsed = schema.parse(input);
  parsed.masks.forEach(validateNativeMask);
  if (
    [
      'armadurastruct/14',
      'armadurastruct/15',
      'armadurastruct/16',
      'armadurastruct/17',
      'armadurastruct/18',
      'armadurastruct/19',
    ].includes(parsed.schema) &&
    !parsed.layers
  )
    throw new Error('Projeto v14 sem catálogo de layers.');
  if (
    ![
      'armadurastruct/16',
      'armadurastruct/17',
      'armadurastruct/18',
      'armadurastruct/19',
    ].includes(parsed.schema) &&
    (parsed.plotting ||
      parsed.layers?.some((l) => l.plot) ||
      [
        ...parsed.bars,
        ...parsed.details,
        ...parsed.annotations,
        ...parsed.polylines,
        ...parsed.masks,
        ...parsed.masks.flatMap((m) => m.primitives),
      ].some((o) => o.plot))
  )
    throw new Error('Estilos de impressão exigem formato 16.');
  if (
    !['armadurastruct/17', 'armadurastruct/18', 'armadurastruct/19'].includes(
      parsed.schema,
    ) &&
    Object.values(parsed.layerEnvironment?.contexts ?? {}).some(
      (c) => c.visibility,
    )
  )
    throw new Error('Visibilidade por objeto exige formato 17.');
  if (
    !['armadurastruct/18', 'armadurastruct/19'].includes(parsed.schema) &&
    (parsed.bars.some((b) => b.stirrupMirrored !== undefined) ||
      parsed.details.some((d) => d.mirrored !== undefined) ||
      parsed.annotations.some((a) => a.frameRotation !== undefined))
  )
    throw new Error('Transformações orientadas exigem formato 18.');
  if (
    parsed.schema !== 'armadurastruct/19' &&
    parsed.sheets?.some((s) => s.steelSchedule)
  )
    throw new Error('Quadros de aço em prancha exigem formato 19.');
  const modern =
    parsed.schema === 'armadurastruct/3' ||
    parsed.schema === 'armadurastruct/4' ||
    parsed.schema === 'armadurastruct/5' ||
    parsed.schema === 'armadurastruct/6' ||
    parsed.schema === 'armadurastruct/7' ||
    parsed.schema === 'armadurastruct/8' ||
    parsed.schema === 'armadurastruct/9' ||
    parsed.schema === 'armadurastruct/10' ||
    parsed.schema === 'armadurastruct/11' ||
    parsed.schema === 'armadurastruct/12' ||
    parsed.schema === 'armadurastruct/13' ||
    parsed.schema === 'armadurastruct/14' ||
    parsed.schema === 'armadurastruct/15' ||
    parsed.schema === 'armadurastruct/16' ||
    parsed.schema === 'armadurastruct/17' ||
    parsed.schema === 'armadurastruct/18' ||
    parsed.schema === 'armadurastruct/19';
  if (modern && (!parsed.id || !parsed.hierarchy))
    throw new Error('Projeto sem identidade ou hierarquia.');
  let id = modern ? parsed.id! : legacyProjectId(raw);
  if (!modern) {
    const oldIds = new Set(
      [
        ...parsed.bars,
        ...parsed.details,
        ...parsed.annotations,
        ...parsed.polylines,
        ...parsed.masks,
      ].map((o) => o.id),
    );
    while (oldIds.has(id)) id += '-';
  }
  const hierarchy = modern
    ? parsed.hierarchy!
    : initialHierarchy(parsed, id, parsed.drawing.floor);
  const occupied = new Set(
    [
      id,
      ...parsed.bars,
      ...parsed.details,
      ...parsed.annotations,
      ...parsed.polylines,
      ...parsed.masks,
      ...hierarchy.floors,
      ...hierarchy.elements,
      ...hierarchy.details,
      ...hierarchy.drawings,
      ...hierarchy.placements,
    ].map((o) => (typeof o === 'string' ? o : o.id)),
  );
  let sheetId = `${id}:sheet`;
  while (occupied.has(sheetId)) sheetId += '-';
  if (
    parsed.numbering &&
    ![
      'armadurastruct/10',
      'armadurastruct/11',
      'armadurastruct/12',
      'armadurastruct/13',
      'armadurastruct/14',
      'armadurastruct/15',
      'armadurastruct/16',
      'armadurastruct/17',
      'armadurastruct/18',
      'armadurastruct/19',
    ].includes(parsed.schema)
  )
    throw new Error('Política de numeração exige formato 10.');
  const v9 =
    parsed.schema === 'armadurastruct/9' ||
    parsed.schema === 'armadurastruct/10' ||
    parsed.schema === 'armadurastruct/11' ||
    parsed.schema === 'armadurastruct/12' ||
    parsed.schema === 'armadurastruct/13' ||
    parsed.schema === 'armadurastruct/14' ||
    parsed.schema === 'armadurastruct/15' ||
    parsed.schema === 'armadurastruct/16' ||
    parsed.schema === 'armadurastruct/17' ||
    parsed.schema === 'armadurastruct/18' ||
    parsed.schema === 'armadurastruct/19';
  if (
    !v9 &&
    [...parsed.bars, ...(parsed.scheduleLock?.bars ?? [])].some(hasArmatureData)
  )
    throw new Error(
      'Composição de quantidade/metadados da armadura exige o formato 9.',
    );
  const v8 = parsed.schema === 'armadurastruct/8' || v9;
  if (v8 && !parsed.fabricationPositions)
    throw new Error('Projeto v8 sem posições de fabricação.');
  if (!v8 && parsed.fabricationPositions?.some((g) => g.barIds.length > 1))
    throw new Error('Posições compartilhadas exigem formato 8.');
  const v7 = parsed.schema === 'armadurastruct/7' || v8;
  if (!v7 && parsed.hierarchy?.details.some((d) => d.repetition))
    throw new Error('Repetição de detalhamento exige o formato 7.');
  const v6 = parsed.schema === 'armadurastruct/6' || v7;
  const v5 = parsed.schema === 'armadurastruct/5' || v6;
  if (v6 && !parsed.hierarchy?.objectOrigins)
    throw new Error('Projeto v6 sem identidades de origem.');
  const v4 = parsed.schema === 'armadurastruct/4' || v5;
  if (
    v5 &&
    (!parsed.sheets ||
      parsed.sheets.some((s) => !s.customSize || !s.margins || !s.seal) ||
      hierarchy.placements.some(
        (v) =>
          !v.modelOrigin || v.textHeight === undefined || v.title === undefined,
      ))
  )
    throw new Error('Projeto v5 com composição incompleta.');
  if (
    v4 &&
    (!parsed.sheets || hierarchy.placements.some((v) => !v.sheetId || !v.frame))
  )
    throw new Error('Projeto v4 sem folhas ou com vista incompleta.');
  const placements = hierarchy.placements.map((v) => ({
    ...v,
    sheetId: v4 ? v.sheetId! : sheetId,
    frame: v.frame ?? { width: 160, height: 100 },
    modelOrigin: v.modelOrigin ?? { x: 0, y: 0 },
    textHeight: v.textHeight ?? 2.5,
    title: v.title ?? '',
    ...(!v5 ? { legacyScale: v.scale } : {}),
  }));
  if (
    !modern &&
    [
      ...parsed.bars,
      ...parsed.details,
      ...parsed.annotations,
      ...parsed.polylines,
      ...parsed.masks,
    ].length
  ) {
    let placementId = `${id}:placement`;
    while (occupied.has(placementId) || placementId === sheetId)
      placementId += '-';
    placements.push({
      id: placementId,
      drawingId: hierarchy.drawings[0].id,
      sheetId,
      origin: { x: 0, y: 0 },
      rotation: 0,
      scale: 1,
      modelOrigin: { x: 0, y: 0 },
      textHeight: 2.5,
      title: '',
      legacyScale: 1,
      frame: { width: 160, height: 100 },
    });
  }
  let p: Project = {
    ...parsed,
    id,
    schema: 'armadurastruct/24',
    layers: parsed.layers ?? defaultLayers(),
    sheets: v4
      ? parsed.sheets!.map((s) => ({
          ...initialSheet(s.id),
          ...s,
          customSize: s.customSize ?? { width: 210, height: 297 },
          margins: s.margins ?? { left: 10, right: 10, top: 10, bottom: 10 },
          seal: s.seal ?? { enabled: false, width: 160, height: 40 },
        }))
      : [initialSheet(sheetId, parsed.drawing.revision)],
    hierarchy: {
      ...hierarchy,
      placements,
      objectOrigins: hierarchy.objectOrigins ?? {},
    },
  };
  for (const b of [...p.bars, ...(p.scheduleLock?.bars ?? [])])
    validateBarQuantity(b);
  for (const sheet of p.sheets) validateSheetLayout(sheet);
  const ids = p.bars.map((b) => b.id);
  if (new Set(ids).size !== ids.length)
    throw new Error('IDs de armadura duplicados.');
  p = { ...p, fabricationPositions: fabricationPositions(p) };
  validateFabrication(p);
  if (p.scheduleLock) {
    validateFabrication({
      bars: p.scheduleLock.bars,
      fabricationPositions: p.scheduleLock.fabricationPositions,
    });
  }
  if (
    !options.allowOrphanReferences &&
    p.details.some((d) => !ids.includes(d.barId))
  )
    throw new Error('Rebatimento sem armadura correspondente.');
  if (
    new Set(p.details.map((d) => d.id)).size !== p.details.length ||
    new Set(p.masks.map((m) => m.id)).size !== p.masks.length
  )
    throw new Error('Identificadores duplicados em detalhes ou máscaras.');
  if (p.bars.some((b) => b.distribution && b.quantity < 2))
    throw new Error('Uma distribuição precisa de pelo menos duas peças.');
  const allIds = [
    ...p.bars,
    ...p.details,
    ...p.masks,
    ...p.annotations,
    ...p.polylines,
  ].map((o) => o.id);
  if (new Set(allIds).size !== allIds.length)
    throw new Error('Identificadores de objetos duplicados.');
  if (
    !options.allowOrphanReferences &&
    [...p.annotations, ...p.polylines].some((a) =>
      armatureReferences(a).some((id) => !ids.includes(id)),
    )
  )
    throw new Error('Chamada sem armadura correspondente.');
  if (
    ![
      'armadurastruct/14',
      'armadurastruct/15',
      'armadurastruct/16',
      'armadurastruct/17',
      'armadurastruct/18',
      'armadurastruct/19',
    ].includes(parsed.schema)
  ) {
    const preserve = <
      T extends {
        layerId?: string;
        color: string;
        style?: import('./types').LayerBinding['style'];
      },
    >(
      o: T,
    ): T => (!o.layerId ? { ...o, style: { color: o.color, ...o.style } } : o);
    p = {
      ...p,
      bars: p.bars.map(preserve),
      annotations: p.annotations.map(preserve),
      polylines: p.polylines.map(preserve),
    };
  }
  p = pruneVisibility(completeLayers(p));
  validateLayers(p);
  if (p.cadDefaults) validateCadDefaults(p, p.cadDefaults);
  if (p.layerEnvironment) {
    const e = p.layerEnvironment;
    const ids = e.profiles.map((x) => x.id),
      names = e.profiles.map((x) => x.name.toUpperCase());
    if (
      new Set(ids).size !== ids.length ||
      new Set(names).size !== names.length
    )
      throw new Error('Perfis duplicados.');
    for (const c of Object.values(e.contexts))
      if (c.profileId && !ids.includes(c.profileId))
        throw new Error('Perfil de contexto inexistente.');
  }

  const primaries = p.details
    .filter((d) => d.identification === 'primary')
    .map((d) => d.barId);
  if (new Set(primaries).size !== primaries.length)
    throw new Error('Uma armadura só pode ter uma descrição principal.');
  if (
    ![
      'armadurastruct/11',
      'armadurastruct/12',
      'armadurastruct/13',
      'armadurastruct/14',
      'armadurastruct/15',
      'armadurastruct/16',
      'armadurastruct/17',
      'armadurastruct/18',
      'armadurastruct/19',
    ].includes(parsed.schema) &&
    p.details.some(
      (d) =>
        d.rotation ||
        (d.scale ?? 1) !== 1 ||
        (d.identification && d.identification !== 'legacy'),
    )
  )
    throw new Error('Representações transformadas exigem formato 11.');
  if (
    ![
      'armadurastruct/12',
      'armadurastruct/13',
      'armadurastruct/14',
      'armadurastruct/15',
      'armadurastruct/16',
      'armadurastruct/17',
      'armadurastruct/18',
      'armadurastruct/19',
    ].includes(parsed.schema) &&
    p.details.some((d) => d.label || d.showDimensions !== undefined)
  )
    throw new Error('Posicionamento de rótulo exige formato 12.');
  if (
    ![
      'armadurastruct/13',
      'armadurastruct/14',
      'armadurastruct/15',
      'armadurastruct/16',
      'armadurastruct/17',
      'armadurastruct/18',
      'armadurastruct/19',
    ].includes(parsed.schema) &&
    [...p.annotations, ...p.polylines].some((o) => o.barIds !== undefined)
  )
    throw new Error('Vínculos auxiliares exigem formato 13.');
  validateHierarchy(p);
  if (p.scheduleLock?.quantities) {
    const ids = new Set(p.scheduleLock.bars.map((b) => b.id));
    if (
      Object.keys(p.scheduleLock.quantities).some((id) => !ids.has(id)) ||
      p.scheduleLock.bars.some(
        (b) => !Object.hasOwn(p.scheduleLock!.quantities!, b.id),
      )
    )
      throw new Error('Contexto de repetição da RA incompleto.');
  } else if (
    v7 &&
    p.scheduleLock &&
    p.hierarchy.details.some((d) => d.repetition)
  )
    throw new Error('RA bloqueada sem snapshot de repetições.');
  if (!v5)
    for (const view of p.hierarchy.placements) {
      try {
        p = fitPlacement(p, view.id);
      } catch {
        // A tiny legacy frame remains editable and reports overflow; never drop content.
        p = {
          ...p,
          hierarchy: {
            ...p.hierarchy,
            placements: p.hierarchy.placements.map((v) =>
              v.id === view.id ? { ...v, scale: 50 } : v,
            ),
          },
        };
      }
    }
  return p;
}
export function newBar(mark: string): Bar {
  return {
    layerId: 'layer:ARMADURAS',
    id: uid(),
    mark,
    element: 'Geral',
    kind: 'free',
    origin: { x: 0, y: 0 },
    rotation: 0,
    points: [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
    ],
    width: 250,
    height: 500,
    hook: 80,
    diameter: 8,
    mandrel: 40,
    steel: 'CA-50',
    quantity: 1,
    multiplier: 1,
    quantitySource: { kind: 'manual' },
    color: '#4b71e8',
  };
}
export function nextMark(p: Project) {
  return nextFreeMark(p);
}
export const emptyProject = (): Project => {
  const id = uid();
  const content = {
    bars: [],
    details: [],
    masks: [],
    annotations: [],
    polylines: [],
  };
  return {
    schema: 'armadurastruct/24',
    layers: defaultLayers(),
    sheets: [initialSheet(`${id}:sheet`)],
    id,
    hierarchy: initialHierarchy(content, id),
    name: 'Novo projeto',
    author: '',
    notes: '',
    bars: [],
    fabricationPositions: [],
    details: [],
    masks: [],
    annotations: [],
    polylines: [],
    drawing: { floor: '', revision: '00', scale: 0 },
  };
};
export function createScheduleLock(
  p: Project,
  at = new Date().toISOString(),
): NonNullable<Project['scheduleLock']> {
  return {
    at,
    bars: structuredClone(p.bars),
    fabricationPositions: structuredClone(fabricationPositions(p)),
    detailIds: Object.fromEntries(
      p.bars.map((b) => [b.id, p.hierarchy.objectDetails[b.id]]),
    ),
    origins: Object.fromEntries(
      p.bars.map((b) => [b.id, contributionOrigin(p, b.id)]),
    ),
    quantities: Object.fromEntries(
      p.bars.map((b) => [b.id, quantityContext(p, b)]),
    ),
  };
}
export function contributionOrigin(p: Project, id: string) {
  const d = p.hierarchy.details.find(
    (d) => d.id === p.hierarchy.objectDetails[id],
  );
  const e = p.hierarchy.elements.find((e) => e.id === d?.elementId);
  const f = p.hierarchy.floors.find((f) => f.id === e?.floorId);
  const lineage = p.hierarchy.objectOrigins[id];
  return `${[f?.name, e?.name, d?.name].filter(Boolean).join(' / ')} · ${lineage ? `${lineage.projectId}/${lineage.objectId}` : `${p.id}/${id}`}`;
}
export function schedule(p: Project): ScheduleRow[] {
  const snapshot = p.scheduleLock ?? p;
  const bars = new Map(snapshot.bars.map((b) => [b.id, b]));
  return fabricationPositions(snapshot)
    .filter((g) => g.barIds.some((id) => bars.has(id)))
    .map((position) => {
      const members = position.barIds
        .map((id) => bars.get(id)!)
        .filter(Boolean);
      const bar = members[0];
      const contributions = members.map((b) => {
        const g = geometry(b),
          context = p.scheduleLock
            ? (p.scheduleLock.quantities?.[b.id] ?? {
                repetitions: 1,
                detailTitle: '',
              })
            : quantityContext(p, b);
        const local = localBarQuantities(b);
        const quantity = local.perDetailQuantity * context.repetitions,
          totalLength = (g.length * quantity) / 1000;
        return {
          barId: b.id,
          detailId:
            p.scheduleLock?.detailIds?.[b.id] ??
            p.hierarchy.objectDetails[b.id] ??
            '',
          origin:
            p.scheduleLock?.origins?.[b.id] ?? contributionOrigin(p, b.id),
          ...local,
          comment: b.comment ?? '',
          ribbed: b.ribbed ?? false,
          showRibbed: b.showRibbed ?? false,
          columnLevel: b.columnLevel ?? '',
          repetitions: context.repetitions,
          quantity,
          unitLength: g.length / 1000,
          totalLength,
          weight:
            ((totalLength * Math.PI * (b.diameter / 1000) ** 2) / 4) * 7850,
        };
      });
      const quantity = contributions.reduce((n, c) => n + c.quantity, 0),
        totalLength = contributions.reduce((n, c) => n + c.totalLength, 0),
        weight = contributions.reduce((n, c) => n + c.weight, 0);
      const names = members.map(
        (b) =>
          (p.scheduleLock?.quantities?.[b.id] ?? quantityContext(p, b))
            .detailTitle || b.element,
      );
      return {
        positionId: position.id,
        contributions,
        unitLengthRange: [
          Math.min(...contributions.map((c) => c.unitLength)),
          Math.max(...contributions.map((c) => c.unitLength)),
        ],
        mark: position.mark,
        element: [...new Set(names)].join(' / '),
        steel: bar.steel,
        diameter: bar.diameter,
        quantity,
        baseQuantity: contributions.reduce((n, c) => n + c.baseQuantity, 0),
        multiplier: contributions.every(
          (c) => c.multiplier === contributions[0].multiplier,
        )
          ? contributions[0].multiplier
          : null,
        perDetailQuantity: contributions.reduce(
          (n, c) => n + c.perDetailQuantity,
          0,
        ),
        repetitions: contributions.every(
          (c) => c.repetitions === contributions[0].repetitions,
        )
          ? contributions[0].repetitions
          : null,
        unitLength: geometry(bar).length / 1000,
        totalLength,
        weight,
        errors: [
          ...new Set(members.flatMap((b) => geometry(b).errors)),
          ...(!Number.isFinite(totalLength) || !Number.isFinite(weight)
            ? ['Quantidade/comprimento excede os limites numéricos.']
            : []),
        ],
        bar,
      };
    });
}
export function scheduleQuantityLabel(r: ScheduleRow) {
  const expressions = r.contributions.map((c) =>
    quantityExpression(c, r.contributions.length === 1),
  );
  return r.contributions.length > 1
    ? `${expressions.join(' + ')} = ${r.quantity}`
    : r.contributions[0].multiplier > 1 || r.contributions[0].repetitions > 1
      ? `${expressions[0]} = ${r.quantity}`
      : String(r.quantity);
}
export function scheduleChanged(p: Project) {
  const fingerprint = (
    bars: Bar[],
    quantities: NonNullable<Project['scheduleLock']>['quantities'],
  ) =>
    JSON.stringify(
      bars.map((b) => ({
        id: b.id,
        mark: b.mark,
        element: b.element,
        steel: b.steel,
        diameter: b.diameter,
        quantity: b.quantity,
        multiplier: b.multiplier ?? 1,
        quantitySource: b.quantitySource ?? { kind: 'manual' },
        comment: b.comment ?? '',
        ribbed: b.ribbed ?? false,
        showRibbed: b.showRibbed ?? false,
        columnLevel: b.columnLevel ?? '',
        kind: b.kind,
        points: b.points,
        width: b.width,
        height: b.height,
        hook: b.hook,
        mandrel: b.mandrel,
        manufacturing: b.manufacturing,
        repetitions: quantities?.[b.id]?.repetitions ?? 1,
        detailTitle: quantities?.[b.id]?.detailTitle ?? '',
      })),
    );
  return (
    (!!p.scheduleLock &&
      fingerprint(
        p.bars,
        Object.fromEntries(p.bars.map((b) => [b.id, quantityContext(p, b)])),
      ) !== fingerprint(p.scheduleLock.bars, p.scheduleLock.quantities)) ||
    (!!p.scheduleLock &&
      JSON.stringify(fabricationPositions(p)) !==
        JSON.stringify(fabricationPositions(p.scheduleLock)))
  );
}
export function projectPoints(p: Project) {
  const out = p.bars.flatMap((b) => vertices(b).map((v) => world(v, b)));
  for (const d of p.details) {
    const b = p.bars.find((b) => b.id === d.barId);
    if (b) out.push(...representationPoints(b, d));
  }
  for (const b of p.bars)
    if (b.distribution) {
      for (const origin of [
        b.distribution.start ?? b.origin,
        b.distribution.end,
      ])
        out.push(...vertices(b).map((v) => world(v, { ...b, origin })));
    }
  out.push(
    ...p.annotations.flatMap((a) => a.points),
    ...p.polylines.flatMap((l) => l.points),
  );
  return out;
}
export function demoProject(): Project {
  const p = emptyProject();
  p.name = 'Detalhamento · Viga V01';
  p.author = 'OpenStruct';
  const a = {
    ...newBar('N1'),
    element: 'V01 · Inferior',
    diameter: 12.5,
    mandrel: 62.5,
    quantity: 3,
    origin: { x: 100, y: 130 },
    points: [
      { x: 0, y: 260 },
      { x: 0, y: 0 },
      { x: 4800, y: 0 },
      { x: 4800, y: 260 },
    ],
  };
  const b = {
    ...newBar('N2'),
    element: 'V01 · Superior',
    diameter: 10,
    mandrel: 50,
    quantity: 2,
    origin: { x: 100, y: 480 },
    color: '#20a990',
    points: [
      { x: 0, y: -180 },
      { x: 0, y: 0 },
      { x: 4800, y: 0 },
      { x: 4800, y: -180 },
    ],
  };
  const c = {
    ...newBar('N3'),
    element: 'V01 · Estribos',
    kind: 'stirrup' as const,
    diameter: 6.3,
    mandrel: 31.5,
    quantity: 25,
    width: 220,
    height: 440,
    hook: 65,
    origin: { x: 5600, y: 100 },
    color: '#d49432',
  };
  p.bars = [a, b, c];
  p.details = [
    { id: uid(), barId: a.id, origin: { x: 100, y: -700 } },
    { id: uid(), barId: b.id, origin: { x: 100, y: -1450 } },
  ];
  p.masks = [
    {
      id: uid(),
      name: 'Fôrma V01 · exemplo',
      format: 'DEMO',
      visible: true,
      opacity: 0.6,
      origin: { x: 0, y: 0 },
      rotation: 0,
      scale: 1,
      sourceUnit: 'mm',
      layers: { FORMAS: true, EIXOS: true },
      warnings: [],
      primitives: [
        {
          layer: 'FORMAS',
          closed: true,
          points: [
            { x: 0, y: 0 },
            { x: 5000, y: 0 },
            { x: 5000, y: 600 },
            { x: 0, y: 600 },
          ],
        },
        {
          layer: 'FORMAS',
          closed: true,
          points: [
            { x: 5550, y: 0 },
            { x: 5870, y: 0 },
            { x: 5870, y: 600 },
            { x: 5550, y: 600 },
          ],
        },
        {
          layer: 'EIXOS',
          points: [
            { x: -200, y: 300 },
            { x: 5200, y: 300 },
          ],
        },
        ...Array.from({ length: 25 }, (_, i) => ({
          layer: 'FORMAS',
          points: [
            { x: 100 + i * 200, y: 90 },
            { x: 100 + i * 200, y: 510 },
          ],
        })),
      ],
    },
  ];
  p.drawing.floor = 'Pavimento tipo';
  p.hierarchy.floors[0].name = 'Pavimento tipo';
  p.annotations = [
    {
      id: uid(),
      kind: 'dimension-orthogonal',
      barId: c.id,
      points: [
        { x: 100, y: 0 },
        { x: 4900, y: 0 },
        { x: 2500, y: -300 },
      ],
      label: '',
      textHeight: 50,
      color: '#8c9bb3',
    },
    {
      id: uid(),
      kind: 'leader',
      barId: c.id,
      points: [
        { x: 5820, y: 540 },
        { x: 6050, y: 800 },
        { x: 6250, y: 800 },
      ],
      label: '',
      textHeight: 50,
      color: '#c89a4d',
    },
  ];
  return placeDrawing(
    completeOwnership(p),
    p.sheets[0].id,
    p.hierarchy.drawings[0].id,
  ).project;
}
