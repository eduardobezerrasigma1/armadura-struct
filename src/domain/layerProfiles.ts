import { visibilitySchema } from './visibilitySchema';
import { z } from 'zod';
import { layerObjects, objectRole, layerId, stylePrimitive } from './layers';
import { uid, type Project, type LayerBinding } from './types';
export type LayerState = {
  visible: boolean;
  capture: boolean;
  editable: boolean;
};
const state = z
  .object({ visible: z.boolean(), capture: z.boolean(), editable: z.boolean() })
  .strict()
  .refine(
    (s) =>
      (s.visible || (!s.capture && !s.editable)) && (s.capture || !s.editable),
    'Exibir → Capturar → Editar.',
  );
const states = z.record(z.string(), state);
export const layerEnvironmentSchema = z
  .object({
    profiles: z
      .array(
        z.object({
          id: z.string().min(1),
          name: z.string().trim().min(1).max(100),
          states,
        }),
      )
      .max(100),
    contexts: z.record(
      z.string(),
      z.object({
        states,
        profileId: z.string().optional(),
        visibility: visibilitySchema.optional(),
      }),
    ),
  })
  .strict();
export type LayerEnvironment = z.infer<typeof layerEnvironmentSchema>;
const enabled: LayerState = { visible: true, capture: true, editable: true };
export function layerState(p: Project, key: string, id: string): LayerState {
  return p.layerEnvironment?.contexts[key]?.states[id] ?? enabled;
}
export function objectState(
  p: Project,
  key: string,
  o: LayerBinding & { id: string },
): LayerState {
  return layerState(
    p,
    key,
    o.layerId ??
      p.layers.find((l) => l.id === layerId(objectRole(p, o)))?.id ??
      p.layers[0].id,
  );
}
export function profileLabel(p: Project, key: string) {
  const c = p.layerEnvironment?.contexts[key];
  if (!c) return 'Conferência';
  const profile = p.layerEnvironment?.profiles.find(
    (x) => x.id === c.profileId,
  );
  return profile &&
    p.layers.every(
      (l) =>
        JSON.stringify(c.states[l.id] ?? enabled) ===
        JSON.stringify(profile.states[l.id] ?? enabled),
    )
    ? profile.name
    : 'Personalizado';
}
export function ensureProfiles(p: Project): Project {
  if (p.layerEnvironment) return p;
  const profiles = ['Conferência', 'Armaduras', 'Fôrma'].map((name, i) => ({
    id: `profile:${i}`,
    name,
    states: Object.fromEntries(
      p.layers.map((l) => {
        const reference =
          p.masks.some((m) => m.primitives.some((q) => q.layerId === l.id)) ||
          l.id === 'layer:MASCARA';
        const visible =
          i === 0 || (i === 1 && !reference) || (i === 2 && reference);
        return [
          l.id,
          {
            visible,
            capture: visible,
            editable: visible && (i === 0 || !reference),
          },
        ];
      }),
    ),
  }));
  return { ...p, layerEnvironment: { profiles, contexts: {} } };
}
export function setLayerState(
  p: Project,
  key: string,
  id: string,
  patch: Partial<LayerState>,
) {
  if (!p.layers.some((l) => l.id === id)) throw new Error('Layer inexistente.');
  p = ensureProfiles(p);
  let s = { ...layerState(p, key, id), ...patch };
  if (patch.visible === false)
    s = { visible: false, capture: false, editable: false };
  if (patch.capture === true) s.visible = true;
  if (patch.capture === false) s.editable = false;
  if (patch.editable === true)
    s = { visible: true, capture: true, editable: true };
  const e = p.layerEnvironment!;
  return {
    ...p,
    layerEnvironment: {
      ...e,
      contexts: {
        ...e.contexts,
        [key]: {
          ...e.contexts[key],
          states: { ...e.contexts[key]?.states, [id]: s },
        },
      },
    },
  };
}
export function applyLayerProfile(p: Project, key: string, id: string) {
  p = ensureProfiles(p);
  const e = p.layerEnvironment!,
    profile = e.profiles.find((x) => x.id === id);
  if (!profile) throw new Error('Perfil inexistente.');
  return {
    ...p,
    layerEnvironment: {
      ...e,
      contexts: {
        ...e.contexts,
        [key]: {
          ...e.contexts[key],
          profileId: id,
          states: structuredClone(profile.states),
        },
      },
    },
  };
}
export function saveLayerProfile(p: Project, key: string, name: string) {
  p = ensureProfiles(p);
  const e = p.layerEnvironment!;
  name = name.trim();
  if (
    !name ||
    name.length > 100 ||
    e.profiles.some((x) => x.name.toUpperCase() === name.toUpperCase())
  )
    throw new Error('Informe um nome único de até 100 caracteres.');
  if (e.profiles.length >= 100) throw new Error('Limite de 100 perfis.');
  const id = uid(),
    snapshot = Object.fromEntries(
      p.layers.map((l) => [l.id, layerState(p, key, l.id)]),
    );
  return {
    ...p,
    layerEnvironment: {
      profiles: [
        ...e.profiles,
        { id, name, states: structuredClone(snapshot) },
      ],
      contexts: {
        ...e.contexts,
        [key]: { ...e.contexts[key], profileId: id, states: snapshot },
      },
    },
  };
}
/** Read-only projection. Schedules always use the complete physical project. */
export function layerProjection(
  p: Project,
  key: string,
  mode: 'visible' | 'capture',
): Project {
  const keep = (o: LayerBinding & { id: string }) =>
    objectState(p, key, o)[mode];
  return {
    ...p,
    bars: p.bars.filter(keep),
    details: p.details.filter(keep),
    annotations: p.annotations.filter(keep),
    polylines: p.polylines.filter(keep),
    masks: p.masks.filter(keep).map((m) => ({
      ...m,
      primitives: m.primitives.filter(
        (q) =>
          layerState(p, key, q.layerId ?? stylePrimitive(p, m, q).layerId!)[
            mode
          ],
      ),
    })),
  };
}
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((v, i) => sameValue(v, b[i]))
    );
  const x = a as Record<string, unknown>,
    y = b as Record<string, unknown>,
    keys = Object.keys(x).filter((k) => x[k] !== undefined);
  return (
    keys.length === Object.keys(y).filter((k) => y[k] !== undefined).length &&
    keys.every((k) => sameValue(x[k], y[k]))
  );
}
export function assertLayerEdit(before: Project, after: Project, key: string) {
  if (before.id !== after.id) return;
  const old = layerObjects(before),
    current = new Map(layerObjects(after).map((o) => [o.id, o]));
  for (const o of old) {
    if (
      !objectState(before, key, o).editable &&
      !sameValue(o, current.get(o.id))
    )
      throw new Error(
        'Layer protegido: habilite Exibir, Capturar e Editar antes de alterar seus objetos.',
      );
  }
  if (
    !sameValue(before.layers, after.layers) &&
    before.layers.some(
      (l) =>
        !layerState(before, key, l.id).editable &&
        JSON.stringify(l) !==
          JSON.stringify(after.layers.find((x) => x.id === l.id)),
    )
  )
    throw new Error(
      'Layer protegido: habilite Editar antes de alterar seu estilo.',
    );
  for (const o of layerObjects(after))
    if (!old.some((x) => x.id === o.id) && !objectState(after, key, o).editable)
      throw new Error('Não é possível criar objetos em layer protegido.');
}
