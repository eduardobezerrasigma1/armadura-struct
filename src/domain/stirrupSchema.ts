import { z } from 'zod';
const n = z.number().finite();
const point = z
  .object({ x: n.min(-1e8).max(1e8), y: n.min(-1e8).max(1e8) })
  .strict();
export const stirrupHookSchema = z
  .object({
    angle: z.union([
      z.literal(0),
      z.literal(90),
      z.literal(135),
      z.literal(180),
    ]),
    mode: z.enum(['mm', 'diameters']),
    length: n.nonnegative().max(100000),
    turn: z.union([z.literal(1), z.literal(-1)]),
  })
  .strict();
export const stirrupProfileSchema = z
  .object({
    shape: z.enum(['rectangle', 'circle', 'free']),
    closed: z.boolean(),
    reference: z.enum(['axis', 'concrete']),
    cover: n.nonnegative().max(10000),
    gapAngle: n.positive().max(350),
    points: z.array(point).min(2).max(100),
    start: stirrupHookSchema,
    end: stirrupHookSchema,
  })
  .strict();
export const stirrupDisplaySchema = z
  .object({
    dimensions: z.boolean(),
    identification: z.boolean(),
    hooks: z.boolean(),
  })
  .strict();
export const distributionShape = {
  start: point.optional(),
  end: point,
  render: z.enum(['ticks', 'bars']).optional(),
  annotationOffset: n.min(-1e8).max(1e8).optional(),
  insets: z
    .object({ start: n.nonnegative(), end: n.nonnegative() })
    .strict()
    .optional(),
};
export const stirrupCriteriaSchema = z
  .object({
    profile: stirrupProfileSchema,
    width: n.positive().max(100000),
    height: n.positive().max(100000),
    diameter: n.positive().max(100),
    mandrel: n.positive().max(2000),
    steel: z.enum(['CA-50', 'CA-60']),
    rotation: n.min(-360000).max(360000),
    display: stirrupDisplaySchema,
    distribute: z.boolean(),
    quantity: n.int().min(1).max(100000),
    spacing: n.positive().max(100000),
    fit: z.enum(['maximum', 'fixed']),
    startInset: n.nonnegative().max(100000),
    endInset: n.nonnegative().max(100000),
  })
  .strict();
export type StirrupProfile = z.infer<typeof stirrupProfileSchema>;
export type StirrupCriteria = z.infer<typeof stirrupCriteriaSchema>;
export const defaultStirrupCriteria = (): StirrupCriteria => ({
  profile: {
    shape: 'rectangle',
    closed: true,
    reference: 'axis',
    cover: 25,
    gapAngle: 60,
    points: [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 400 },
      { x: 0, y: 400 },
    ],
    start: { angle: 135, mode: 'diameters', length: 10, turn: -1 },
    end: { angle: 135, mode: 'diameters', length: 10, turn: 1 },
  },
  width: 200,
  height: 400,
  diameter: 6.3,
  mandrel: 31.5,
  steel: 'CA-60',
  rotation: 0,
  display: { dimensions: true, identification: true, hooks: true },
  distribute: true,
  quantity: 1,
  spacing: 200,
  fit: 'maximum',
  startInset: 0,
  endInset: 0,
});
export function scaleStirrupProfile(
  s: StirrupProfile,
  k: number,
): StirrupProfile {
  const hook = (h: StirrupProfile['start']) => ({
    ...h,
    length: h.mode === 'mm' ? h.length * k : h.length,
  });
  return {
    ...s,
    cover: s.cover * k,
    points: s.points.map((p) => ({ x: p.x * k, y: p.y * k })),
    start: hook(s.start),
    end: hook(s.end),
  };
}
