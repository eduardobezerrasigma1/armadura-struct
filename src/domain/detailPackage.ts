import { scaleStirrupProfile } from './stirrupSchema';
import { scaleDimensionReferences } from './maskDimensions';
import { nativePrimitive } from './nativeMasks';
import { drawingLayerSchema } from './layerSchema';
import { defaultLayers } from './layers';
import { armatureReferences } from './armatureReferences';
import { hasArmatureData } from './detailQuantities';
import { fabricationPositions } from './fabrication';
import { z } from 'zod';
import {
  decodeProject,
  detailContentSchema,
  exchangeMetadataSchema,
  repetitionSchema,
  fabricationPositionSchema,
} from './model';
import { contentObjects } from './hierarchy';
import { detailOrigin, objectOrigin } from './detailTransfer';
import { mul } from './geometry';
import { repetitionNames } from './detailQuantities';
import type { Bar, Point, Project } from './types';

export const DETAIL_PACKAGE_SCHEMA = 'openstruct.detail/16' as const;
const id = z.string().min(1).max(200);
const named = (max = 100) =>
  z.object({ id, name: z.string().trim().min(1).max(max) });
export const detailPackageSchema = z
  .object({
    schema: z.enum([
      'openstruct.detail/1',
      'openstruct.detail/2',
      'openstruct.detail/3',
      'openstruct.detail/4',
      'openstruct.detail/5',
      'openstruct.detail/6',
      'openstruct.detail/7',
      'openstruct.detail/8',
      'openstruct.detail/9',
      'openstruct.detail/10',
      'openstruct.detail/11',
      'openstruct.detail/12',
      'openstruct.detail/13',
      'openstruct.detail/14',
      'openstruct.detail/15',
      'openstruct.detail/16',
    ]),
    layers: z.array(drawingLayerSchema).min(1).max(2000).optional(),
    fabricationPositions: z
      .array(fabricationPositionSchema)
      .max(10000)
      .optional(),
    units: z
      .object({ length: z.enum(['mm', 'cm', 'm']), angle: z.literal('deg') })
      .strict(),
    origin: z.object({
      projectId: id,
      floorId: id,
      elementId: id,
      detailId: id,
    }),
    context: z.object({
      project: named(150),
      floor: named(150),
      element: named(),
      detail: named().extend({
        grouped: z.boolean(),
        repetition: repetitionSchema.optional(),
      }),
    }),
    revision: z.string().max(40),
    ...exchangeMetadataSchema.shape,
    objects: detailContentSchema,
    /** Definitions only: these are never imported as physical steel implicitly. */
    dependencies: z.array(detailContentSchema.shape.bars.element).max(10000),
    objectOrigins: z.record(
      z.string(),
      z.object({ projectId: id, objectId: id }),
    ),
  })
  .strict();
export type DetailPackage = z.infer<typeof detailPackageSchema>;
export type PackageUnit = DetailPackage['units']['length'];
const factors: Record<PackageUnit, number> = { mm: 1, cm: 10, m: 1000 };
function scaleBar(b: Bar, k: number): Bar {
  const point = (p: Point) => mul(p, k);
  return {
    ...b,
    origin: point(b.origin),
    points: b.points.map(point),
    width: b.width * k,
    height: b.height * k,
    hook: b.hook * k,
    ...(b.stirrupProfile
      ? { stirrupProfile: scaleStirrupProfile(b.stirrupProfile, k) }
      : {}),
    diameter: b.diameter * k,
    mandrel: b.mandrel * k,
    quantitySource:
      b.quantitySource?.kind === 'distribution' &&
      b.quantitySource.mode === 'spacing'
        ? { ...b.quantitySource, spacing: b.quantitySource.spacing * k }
        : b.quantitySource,
    ...(b.distribution
      ? {
          distribution: {
            ...b.distribution,
            end: point(b.distribution.end),
            ...(b.distribution.annotationOffset !== undefined
              ? { annotationOffset: b.distribution.annotationOffset * k }
              : {}),
            ...(b.distribution.insets
              ? {
                  insets: {
                    start: b.distribution.insets.start * k,
                    end: b.distribution.insets.end * k,
                  },
                }
              : {}),
            ...(b.distribution.start
              ? { start: point(b.distribution.start) }
              : {}),
          },
        }
      : {}),
  };
}
/** Every length, including diameter and text height, uses units.length. Angles/counts/scales do not. */
function scaleContent(value: DetailPackage, k: number): DetailPackage {
  const point = (p: Point) => mul(p, k),
    o = value.objects;
  const styled = <T extends import('./types').LayerBinding>(v: T): T => ({
    ...v,
    ...(v.style?.lineType
      ? {
          style: {
            ...v.style,
            lineType: {
              ...v.style.lineType,
              pattern: v.style.lineType.pattern.map((n) => n * k),
            },
          },
        }
      : {}),
    ...(v.drafting
      ? {
          drafting: {
            ...v.drafting,
            height: v.drafting.height * k,
            ...(v.drafting.distributionHeight !== undefined
              ? { distributionHeight: v.drafting.distributionHeight * k }
              : {}),
            dimensionHeight: v.drafting.dimensionHeight * k,
            style: styled({ style: v.drafting.style }).style,
            ...(v.drafting.dimensions
              ? { dimensions: styled(v.drafting.dimensions) }
              : {}),
          },
        }
      : {}),
  });
  return {
    ...value,
    layers: value.layers?.map((l) => ({
      ...l,
      lineType: {
        ...l.lineType,
        pattern: l.lineType.pattern.map((n) => n * k),
      },
    })),
    objects: {
      bars: o.bars.map((b) => styled(scaleBar(b, k))),
      details: o.details.map((d) => ({
        ...styled(d),
        origin: point(d.origin),
        ...(d.label
          ? {
              label: {
                ...d.label,
                origin: point(d.label.origin),
                height: d.label.height * k,
              },
            }
          : {}),
      })),
      annotations: o.annotations.map((a) => ({
        ...styled(a),
        points: a.points.map(point),
        textHeight: a.textHeight * k,
        ...(a.maskReferences
          ? { maskReferences: scaleDimensionReferences(a, k) }
          : {}),
      })),
      polylines: o.polylines.map((l) => ({
        ...styled(l),
        points: l.points.map(point),
      })),
      masks: o.masks.map((m) => ({
        ...styled(m),
        origin: point(m.origin),
        primitives: m.primitives.map((p) => ({
          ...styled(p),
          ...(p.native
            ? nativePrimitive(
                p.native.kind === 'circle' || p.native.kind === 'arc'
                  ? {
                      ...p.native,
                      center: point(p.native.center),
                      radius: p.native.radius * k,
                    }
                  : { ...p.native, points: p.native.points.map(point) },
                p.id,
                p.layer,
              )
            : { points: p.points.map(point) }),
          textHeight: (p.textHeight ?? 2.5) * k,
        })),
      })),
    },
    dependencies: value.dependencies.map((b) => styled(scaleBar(b, k))),
  };
}

/** Validate the complete closed reference graph before opening the AS-08 comparison. */
export function detailPackageProject(value: DetailPackage): Project {
  const pack = scaleContent(
    detailPackageSchema.parse(value),
    factors[value.units.length],
  );
  if (
    pack.schema !== 'openstruct.detail/16' &&
    [...pack.objects.bars, ...pack.dependencies].some(
      (b) =>
        b.stirrupProfile ||
        b.stirrupDisplay ||
        b.distribution?.annotationOffset !== undefined ||
        b.distribution?.insets ||
        (b.quantitySource.kind === 'distribution' &&
          b.quantitySource.mode === 'spacing' &&
          b.quantitySource.fit),
    )
  )
    throw Error('Estribos parametrizados exigem pacote v16.');
  if (pack.schema === 'openstruct.detail/1' && pack.context.detail.repetition)
    throw new Error('Repetições exigem pacote openstruct.detail/2.');
  if (
    ![
      'openstruct.detail/3',
      'openstruct.detail/4',
      'openstruct.detail/5',
      'openstruct.detail/6',
      'openstruct.detail/7',
      'openstruct.detail/8',
      'openstruct.detail/9',
      'openstruct.detail/10',
      'openstruct.detail/11',
      'openstruct.detail/12',
      'openstruct.detail/13',
      'openstruct.detail/14',
      'openstruct.detail/15',
      'openstruct.detail/16',
    ].includes(pack.schema) &&
    (pack.fabricationPositions ||
      [...pack.objects.bars, ...pack.dependencies].some((b) => b.manufacturing))
  )
    throw new Error(
      'Posições de fabricação/terminações exigem pacote openstruct.detail/3.',
    );
  if (
    ![
      'openstruct.detail/4',
      'openstruct.detail/5',
      'openstruct.detail/6',
      'openstruct.detail/7',
      'openstruct.detail/8',
      'openstruct.detail/9',
      'openstruct.detail/10',
      'openstruct.detail/11',
      'openstruct.detail/12',
      'openstruct.detail/13',
      'openstruct.detail/14',
      'openstruct.detail/15',
      'openstruct.detail/16',
    ].includes(pack.schema) &&
    [...pack.objects.bars, ...pack.dependencies].some(hasArmatureData)
  )
    throw new Error(
      'Composição de quantidade/metadados da armadura exige pacote openstruct.detail/4.',
    );
  if (
    ![
      'openstruct.detail/5',
      'openstruct.detail/6',
      'openstruct.detail/7',
      'openstruct.detail/8',
      'openstruct.detail/9',
      'openstruct.detail/10',
      'openstruct.detail/11',
      'openstruct.detail/12',
      'openstruct.detail/13',
      'openstruct.detail/14',
      'openstruct.detail/15',
      'openstruct.detail/16',
    ].includes(pack.schema) &&
    pack.objects.details.some(
      (d) =>
        d.rotation ||
        (d.scale ?? 1) !== 1 ||
        (d.identification && d.identification !== 'legacy'),
    )
  )
    throw new Error('Representações transformadas exigem pacote v5.');
  if (
    ![
      'openstruct.detail/6',
      'openstruct.detail/7',
      'openstruct.detail/8',
      'openstruct.detail/9',
      'openstruct.detail/10',
      'openstruct.detail/11',
      'openstruct.detail/12',
      'openstruct.detail/13',
      'openstruct.detail/14',
      'openstruct.detail/15',
      'openstruct.detail/16',
    ].includes(pack.schema) &&
    pack.objects.details.some((d) => d.label || d.showDimensions !== undefined)
  )
    throw new Error('Posicionamento de rótulo exige pacote v6.');
  if (
    ![
      'openstruct.detail/7',
      'openstruct.detail/8',
      'openstruct.detail/9',
      'openstruct.detail/10',
      'openstruct.detail/11',
      'openstruct.detail/12',
      'openstruct.detail/13',
      'openstruct.detail/14',
      'openstruct.detail/15',
      'openstruct.detail/16',
    ].includes(pack.schema) &&
    [...pack.objects.annotations, ...pack.objects.polylines].some(
      (o) => o.barIds !== undefined,
    )
  )
    throw new Error('Vínculos auxiliares exigem pacote v7.');
  if (
    ![
      'openstruct.detail/9',
      'openstruct.detail/10',
      'openstruct.detail/11',
      'openstruct.detail/12',
      'openstruct.detail/13',
      'openstruct.detail/14',
      'openstruct.detail/15',
      'openstruct.detail/16',
    ].includes(pack.schema) &&
    (pack.layers?.some((l) => l.plot) ||
      [
        ...contentObjects(pack.objects),
        ...pack.dependencies,
        ...pack.objects.masks.flatMap((m) => m.primitives),
      ].some((o) => o.plot))
  )
    throw new Error('Estilos de impressão exigem pacote v9.');
  if (
    ![
      'openstruct.detail/10',
      'openstruct.detail/11',
      'openstruct.detail/12',
      'openstruct.detail/13',
      'openstruct.detail/14',
      'openstruct.detail/15',
      'openstruct.detail/16',
    ].includes(pack.schema) &&
    ([...pack.objects.bars, ...pack.dependencies].some(
      (b) => b.stirrupMirrored !== undefined,
    ) ||
      pack.objects.details.some((d) => d.mirrored !== undefined) ||
      pack.objects.annotations.some((a) => a.frameRotation !== undefined))
  )
    throw new Error('Transformações orientadas exigem pacote v10.');
  if (
    ![
      'openstruct.detail/11',
      'openstruct.detail/12',
      'openstruct.detail/13',
      'openstruct.detail/14',
      'openstruct.detail/15',
      'openstruct.detail/16',
    ].includes(pack.schema) &&
    pack.objects.masks.some((m) => m.format === 'NATIVE')
  )
    throw new Error('Máscaras nativas exigem pacote v11.');
  if (
    ![
      'openstruct.detail/12',
      'openstruct.detail/13',
      'openstruct.detail/14',
      'openstruct.detail/15',
      'openstruct.detail/16',
    ].includes(pack.schema) &&
    pack.objects.masks.some(
      (m) => m.format !== 'NATIVE' && m.primitives.some((q) => q.native),
    )
  )
    throw new Error('Desenho local em referência importada exige pacote v12.');
  if (
    ![
      'openstruct.detail/13',
      'openstruct.detail/14',
      'openstruct.detail/15',
      'openstruct.detail/16',
    ].includes(pack.schema) &&
    [
      ...pack.objects.bars,
      ...pack.objects.details,
      ...pack.objects.annotations,
      ...pack.objects.polylines,
      ...pack.objects.masks,
      ...pack.objects.masks.flatMap((m) => m.primitives),
      ...pack.dependencies,
    ].some((o) => o.drafting)
  )
    throw new Error('Aparência de textos exige pacote v13.');
  if (
    ![
      'openstruct.detail/14',
      'openstruct.detail/15',
      'openstruct.detail/16',
    ].includes(pack.schema) &&
    pack.objects.masks.some((m) =>
      m.primitives.some((q) => q.native?.kind === 'arc' || q.sourceEntityId),
    )
  )
    throw new Error('Arcos e edição local CAD exigem pacote v14.');
  if (
    !['openstruct.detail/15', 'openstruct.detail/16'].includes(pack.schema) &&
    pack.objects.annotations.some(
      (a) => a.maskReferences || a.dimensionPresentation,
    )
  )
    throw new Error(
      'Referências de máscara e unidades de cota exigem pacote v15.',
    );
  const o = pack.objects,
    c = pack.context;
  const objects = [...contentObjects(o), ...pack.dependencies];
  const ids = objects.map((o) => o.id);
  if (
    ids.some((key) => !key || key.length > 200) ||
    new Set(ids).size !== ids.length
  )
    throw new Error('Pacote com IDs de objetos vazios ou duplicados.');
  if (
    Object.keys(pack.objectOrigins).length !== ids.length ||
    ids.some((key) => !Object.hasOwn(pack.objectOrigins, key))
  )
    throw new Error(
      'Cada objeto e dependência do pacote precisa de uma identidade de origem.',
    );
  const originKeys = ids.map((key) => JSON.stringify(pack.objectOrigins[key]));
  if (new Set(originKeys).size !== originKeys.length)
    throw new Error(
      'Dois objetos do pacote não podem representar a mesma identidade de origem.',
    );
  const referenced = new Set(
    [...o.details, ...o.annotations, ...o.polylines].flatMap(
      armatureReferences,
    ),
  );
  if (pack.dependencies.some((b) => !referenced.has(b.id)))
    throw new Error('Dependência não utilizada no detalhamento.');
  // Synthetic drawing IDs are local transport scaffolding, never exchanged physical identity.
  const occupied = new Set([
    c.project.id,
    c.floor.id,
    c.element.id,
    c.detail.id,
    ...ids,
  ]);
  const fresh = (suffix: string) => {
    let key = `exchange:${suffix}`;
    while (occupied.has(key)) key += '-';
    occupied.add(key);
    return key;
  };
  const dependencyId = fresh('dependencies');
  const details = [
    {
      ...c.detail,
      elementId: c.element.id,
      ...(c.detail.repetition ? { repetition: c.detail.repetition } : {}),
      source: {
        origin: pack.origin,
        projectName: c.project.name,
        path: `${c.floor.name} / ${c.element.name} / ${c.detail.name}`,
        revision: pack.revision,
        exchange: {
          producer: pack.producer,
          metadata: pack.metadata,
          exportedAt: pack.exportedAt,
        },
      },
    },
  ];
  const drawings = [
    { id: fresh('drawing'), detailId: c.detail.id, name: 'Desenho principal' },
  ];
  if (pack.dependencies.length) {
    details.push({
      id: dependencyId,
      elementId: c.element.id,
      name: 'Dependências externas',
      grouped: false,
      source: {
        origin: { ...pack.origin, detailId: dependencyId },
        projectName: c.project.name,
        path: 'Dependências externas',
        revision: pack.revision,
        exchange: {
          producer: pack.producer,
          metadata: {},
          exportedAt: pack.exportedAt,
        },
      },
    });
    drawings.push({
      id: fresh('dependency-drawing'),
      detailId: dependencyId,
      name: 'Referências externas',
    });
  }
  return decodeProject(
    JSON.stringify({
      schema: 'armadurastruct/25',
      layers: pack.layers ?? defaultLayers(),
      fabricationPositions: pack.fabricationPositions ?? [],
      id: c.project.id,
      name: c.project.name,
      author: pack.producer.app,
      notes: '',
      ...o,
      bars: [...o.bars, ...pack.dependencies],
      sheets: [],
      drawing: { floor: c.floor.name, revision: pack.revision, scale: 0 },
      hierarchy: {
        floors: [c.floor],
        elements: [{ ...c.element, floorId: c.floor.id }],
        details,
        drawings,
        placements: [],
        objectDetails: Object.fromEntries([
          ...contentObjects(o).map((o) => [o.id, c.detail.id]),
          ...pack.dependencies.map((b) => [b.id, dependencyId]),
        ]),
        objectOrigins: pack.objectOrigins,
      },
    }),
  );
}

export function readDetailPackage(raw: unknown): {
  package: DetailPackage;
  project: Project;
} {
  const input = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (
    ![
      'openstruct.detail/1',
      'openstruct.detail/2',
      'openstruct.detail/3',
      'openstruct.detail/4',
      'openstruct.detail/5',
      'openstruct.detail/6',
      'openstruct.detail/7',
      'openstruct.detail/8',
      'openstruct.detail/9',
      'openstruct.detail/10',
      'openstruct.detail/11',
      'openstruct.detail/12',
      'openstruct.detail/13',
      'openstruct.detail/14',
      'openstruct.detail/15',
      DETAIL_PACKAGE_SCHEMA,
    ].includes(input?.schema)
  )
    throw new Error(
      `Versão de pacote não suportada. Use ${DETAIL_PACKAGE_SCHEMA}.`,
    );
  const pack = detailPackageSchema.parse(input);
  if (
    pack.schema !== 'openstruct.detail/16' &&
    [...pack.objects.bars, ...pack.dependencies].some(
      (b) =>
        b.stirrupProfile ||
        b.stirrupDisplay ||
        b.distribution?.annotationOffset !== undefined ||
        b.distribution?.insets ||
        (b.quantitySource.kind === 'distribution' &&
          b.quantitySource.mode === 'spacing' &&
          b.quantitySource.fit),
    )
  )
    throw Error('Estribos parametrizados exigem pacote v16.');
  if (
    [
      'openstruct.detail/8',
      'openstruct.detail/9',
      'openstruct.detail/10',
      'openstruct.detail/11',
      'openstruct.detail/12',
      'openstruct.detail/13',
      'openstruct.detail/14',
      'openstruct.detail/15',
      'openstruct.detail/16',
    ].includes(pack.schema) &&
    !pack.layers
  )
    throw new Error('Pacote v8 sem catálogo de layers.');
  if (pack.schema === 'openstruct.detail/1' && pack.context.detail.repetition)
    throw new Error('Repetições exigem pacote openstruct.detail/2.');
  return { package: pack, project: detailPackageProject(pack) };
}
export function decodeDetailPackage(raw: string): DetailPackage {
  return readDetailPackage(raw).package;
}

export function createDetailPackage(
  project: Project,
  detailId: string,
  options: {
    unit?: PackageUnit;
    producer: DetailPackage['producer'];
    metadata?: Record<string, string>;
    exportedAt?: string;
  },
): DetailPackage {
  const d = project.hierarchy.details.find((d) => d.id === detailId);
  const e = project.hierarchy.elements.find((e) => e.id === d?.elementId);
  const f = project.hierarchy.floors.find((f) => f.id === e?.floorId);
  if (!d || !e || !f)
    throw new Error('Escolha um detalhamento existente para exportar.');
  const owns = (id: string) => project.hierarchy.objectDetails[id] === detailId;
  const objects = {
    bars: project.bars.filter((o) => owns(o.id)),
    details: project.details.filter((o) => owns(o.id)),
    masks: project.masks.filter((o) => owns(o.id)),
    annotations: project.annotations.filter((o) => owns(o.id)),
    polylines: project.polylines.filter((o) => owns(o.id)),
  };
  const owned = new Set(objects.bars.map((b) => b.id));
  const refs = new Set(
    [...objects.details, ...objects.annotations, ...objects.polylines].flatMap(
      armatureReferences,
    ),
  );
  const dependencies = project.bars.filter(
    (b) => refs.has(b.id) && !owned.has(b.id),
  );
  const mm: DetailPackage = {
    schema: DETAIL_PACKAGE_SCHEMA,
    layers: project.layers,
    fabricationPositions: fabricationPositions(project)
      .map((g) => ({
        ...g,
        barIds: g.barIds.filter((id) =>
          [...objects.bars, ...dependencies].some((b) => b.id === id),
        ),
      }))
      .filter((g) => g.barIds.length),
    units: { length: options.unit ?? 'mm', angle: 'deg' },
    origin: detailOrigin(project, detailId),
    context: {
      project: { id: project.id, name: project.name },
      floor: f,
      element: { id: e.id, name: e.name },
      detail: {
        id: d.id,
        name: d.name,
        grouped: d.grouped ?? false,
        ...(d.repetition
          ? {
              repetition: {
                ...d.repetition,
                elements: repetitionNames(project, d.repetition).map(
                  (name) => ({ name }),
                ),
              },
            }
          : {}),
      },
    },
    revision: project.drawing.revision,
    producer: options.producer,
    exportedAt: options.exportedAt ?? new Date().toISOString(),
    metadata: { ...d.source?.exchange?.metadata, ...options.metadata },
    objects,
    dependencies,
    objectOrigins: Object.fromEntries(
      [...contentObjects(objects), ...dependencies].map((o) => [
        o.id,
        objectOrigin(project, o.id),
      ]),
    ),
  };
  const output = scaleContent(
    structuredClone(mm),
    1 / factors[mm.units.length],
  );
  // Avoid imposing millimeter diameter limits until declared units have been normalized.
  const validated = detailPackageSchema.parse(output);
  detailPackageProject(validated);
  return validated;
}
