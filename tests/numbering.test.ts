import { it, expect } from 'vitest';
import {
  emptyProject,
  newBar,
  nextMark,
  decodeProject,
  schedule,
  createScheduleLock,
  scheduleChanged,
} from '../src/domain/model';
import {
  completeOwnership,
  createHierarchyNode,
} from '../src/domain/hierarchy';
import { previewRenumber, applyRenumber } from '../src/domain/numbering';
import { defaultNumbering, nextFreeMark } from '../src/domain/marks';
import { executeRebarBatch, applyRebarBatch } from '../src/domain/rebarApi';
import { groupFabrication } from '../src/domain/fabrication';
function fixture() {
  return completeOwnership({
    ...emptyProject(),
    bars: [
      { ...newBar('N9'), id: 'a', origin: { x: 0, y: 0 } },
      { ...newBar('N8'), id: 'b', origin: { x: 0, y: 1000 } },
      { ...newBar('N7'), id: 'c', origin: { x: 1000, y: 1000 } },
    ],
  });
}
const options = { policy: { ...defaultNumbering, start: 20 } };
it('N20–N22 follow spatial order independently of creation/array order; views do not add positions', () => {
  const p = fixture(),
    plan = previewRenumber(p, options);
  expect(plan.rows.map((r) => [r.barId, r.after])).toEqual([
    ['c', 'N20'],
    ['b', 'N21'],
    ['a', 'N22'],
  ]);
  const q = {
    ...p,
    bars: [...p.bars].reverse(),
    fabricationPositions: [...p.fabricationPositions!].reverse(),
    details: [{ id: 'view', barId: 'a', origin: { x: 9000, y: 9000 } }],
  };
  expect(
    previewRenumber(q, options).rows.map((r) => [r.barId, r.after]),
  ).toEqual(plan.rows.map((r) => [r.barId, r.after]));
  expect(applyRenumber(p, plan)).toEqual(plan.project);
  expect(() => applyRenumber({ ...p }, plan)).toThrow(/mudou/);
});
it.each(['top-right', 'top-left', 'right-top', 'left-top'] as const)(
  'all spatial modes and stable-ID ties are deterministic: %s',
  (order) => {
    const p = fixture();
    p.bars[2].origin = { ...p.bars[1].origin };
    const a = previewRenumber(p, { ...options, order }),
      b = previewRenumber(
        { ...p, bars: [...p.bars].reverse() },
        { ...options, order },
      );
    expect(a.rows).toEqual(b.rows);
  },
);
it('reserved/preserved/outside marks are skipped and next free uses saved prefix and start', () => {
  const p = fixture(),
    id = p.fabricationPositions!.find((g) => g.barIds.includes('a'))!.id;
  const plan = previewRenumber(p, {
    policy: {
      prefix: 'P',
      start: 20,
      reserved: ['P20', 'P22'],
      preservedPositionIds: [id],
    },
  });
  expect(plan.rows.map((r) => r.after)).toEqual(['P21', 'P23', 'N9']);
  expect(nextMark(plan.project)).toBe('P24');
  expect(decodeProject(JSON.stringify(plan.project))).toEqual(plan.project);
  expect(
    nextFreeMark(p, ['N20'], {
      ...defaultNumbering,
      start: 20,
      reserved: ['N21'],
    }),
  ).toBe('N22');
});
it('a position shared across details remains protected in a partial scope', () => {
  let p = fixture();
  const d = createHierarchyNode(
    p,
    'detail',
    'Other',
    p.hierarchy.elements[0].id,
  );
  p = {
    ...d.project,
    hierarchy: {
      ...d.project.hierarchy,
      objectDetails: { ...d.project.hierarchy.objectDetails, c: d.id },
    },
  };
  p = groupFabrication(p, ['b', 'c'], 'b');
  const plan = previewRenumber(p, {
    ...options,
    scope: { kind: 'detail', id: p.hierarchy.details[0].id },
  });
  expect(plan.rows.find((r) => r.barId === 'b')?.status).toBe('outside');
  expect(plan.project.bars.find((b) => b.id === 'c')?.mark).toBe('N8');
});
it('prefix configuration and scope validate, exhausted numbering fails without mutation', () => {
  const p = fixture();
  expect(() =>
    previewRenumber(p, { policy: { ...defaultNumbering, start: 0 } }),
  ).toThrow();
  expect(() =>
    previewRenumber(p, { scope: { kind: 'detail', id: 'missing' } }),
  ).toThrow();
  expect(() =>
    previewRenumber(p, { policy: { ...defaultNumbering, start: 999999999 } }),
  ).toThrow(/esgotada/);
  expect(() =>
    previewRenumber(p, {
      policy: { ...defaultNumbering, prefix: 'bad prefix' },
    }),
  ).toThrow();
});
it('API transaction preserves IDs, geometry, weights and frozen RA while calls remain bound', () => {
  const p = fixture();
  p.scheduleLock = createScheduleLock(p, 'frozen');
  const result = executeRebarBatch(p, [{ type: 'bar.renumber', options }], {
    units: 'mm',
  });
  expect(result.ok).toBe(true);
  const q = applyRebarBatch(p, result);
  expect(scheduleChanged(q)).toBe(true);
  expect(schedule(q)).toEqual(schedule(p));
  expect(
    schedule({ ...q, scheduleLock: undefined }).reduce(
      (n, r) => n + r.weight,
      0,
    ),
  ).toBe(schedule(p).reduce((n, r) => n + r.weight, 0));
  expect(q.bars.map((b) => [b.id, b.origin, b.points, b.quantity])).toEqual(
    p.bars.map((b) => [b.id, b.origin, b.points, b.quantity]),
  );
  const invalid = executeRebarBatch(
    p,
    [
      { type: 'bar.renumber', options },
      {
        type: 'bar.update',
        id: 'missing',
        patch: { kind: 'free', quantity: 1 },
      },
    ],
    { units: 'mm' },
  );
  expect(invalid.ok).toBe(false);
  expect(invalid.project).toBe(p);
});
it('legacy formats 1–9 keep marks until an explicit preview/apply', () => {
  const p = fixture();
  for (let v = 1; v <= 9; v++) {
    const q = decodeProject(
      JSON.stringify({ ...p, schema: `armadurastruct/${v}` }),
    );
    expect(q.bars).toEqual(p.bars);
    expect(q.numbering).toBeUndefined();
    expect(q.schema).toBe('armadurastruct/25');
  }
});
