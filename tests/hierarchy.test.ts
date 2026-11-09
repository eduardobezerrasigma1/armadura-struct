import { describe, expect, it } from 'vitest';
import {
  decodeProject,
  demoProject,
  emptyProject,
  newBar,
  schedule,
  scheduleChanged,
} from '../src/domain/model';
import {
  completeOwnership,
  createHierarchyNode,
  deleteHierarchyNode,
  detailPath,
  moveObjectsToDetail,
  updateHierarchyNode,
} from '../src/domain/hierarchy';
import { joinBars, splitBar } from '../src/domain/editing';
import { toCsv, exportLines } from '../src/lib/exports';
import type { Project } from '../src/domain/types';

function anotherDetail(project: Project) {
  const floor = createHierarchyNode(project, 'floor', 'Superior');
  const element = createHierarchyNode(floor.project, 'element', 'V1', floor.id);
  return createHierarchyNode(element.project, 'detail', 'Armadura', element.id);
}

describe('versioned hierarchy and physical quantities', () => {
  it.each(['armadurastruct/1', 'armadurastruct/2'])(
    'migrates %s without changing objects, coordinates or the steel schedule',
    (schema) => {
      const source = demoProject();
      source.polylines.push({
        id: 'poly',
        points: [
          { x: 8, y: 9 },
          { x: 55, y: 90 },
        ],
        closed: false,
        color: '#111111',
      });
      source.scheduleLock = {
        at: '2026-11-06T00:00:00Z',
        bars: structuredClone(source.bars),
      };
      const legacy = { ...source, schema, id: undefined, hierarchy: undefined };
      const raw = JSON.stringify(legacy),
        migrated = decodeProject(raw);
      expect(migrated.schema).toBe('armadurastruct/25');
      for (const field of [
        'bars',
        'details',
        'annotations',
        'polylines',
        'masks',
        'drawing',
        'scheduleLock',
      ] as const)
        if (field === 'annotations' || field === 'polylines')
          expect(migrated[field]).toMatchObject(source[field]);
        else expect(migrated[field]).toEqual(source[field]);
      expect(migrated.hierarchy.floors).toHaveLength(1);
      expect(migrated.hierarchy.details).toHaveLength(1);
      expect(migrated.hierarchy.floors[0].name).toBe(source.drawing.floor);
      expect(Object.keys(migrated.hierarchy.objectDetails)).toHaveLength(
        source.bars.length +
          source.details.length +
          source.annotations.length +
          source.polylines.length +
          source.masks.length,
      );
      expect(physicalSchedule(migrated)).toEqual(physicalSchedule(source));
      expect(scheduleChanged(migrated)).toBe(false);
      expect(physicalCsv(migrated)).toEqual(physicalCsv(source));
      expect(exportLines(migrated)).toEqual(exportLines(source));
      expect(decodeProject(raw)).toEqual(migrated);
      expect(decodeProject(JSON.stringify(migrated))).toEqual(migrated);
    },
  );

  it('retains a 150-character legacy floor name on a v3 roundtrip', () => {
    const source = demoProject();
    source.drawing.floor = 'P'.repeat(150);
    const p = decodeProject(
      JSON.stringify({
        ...source,
        schema: 'armadurastruct/2',
        hierarchy: undefined,
        id: undefined,
      }),
    );
    expect(decodeProject(JSON.stringify(p)).hierarchy.floors[0].name).toBe(
      source.drawing.floor,
    );
  });

  it('keeps distinct identities for same-named elements on different floors', () => {
    let p = emptyProject();
    const floor = createHierarchyNode(p, 'floor', 'Superior');
    p = floor.project;
    const first = createHierarchyNode(
      p,
      'element',
      'V1',
      p.hierarchy.floors[0].id,
    );
    p = first.project;
    const second = createHierarchyNode(p, 'element', 'V1', floor.id);
    p = second.project;
    expect(first.id).not.toBe(second.id);
    expect(
      p.hierarchy.elements.filter((e) => e.name === 'V1').map((e) => e.floorId),
    ).toEqual([p.hierarchy.floors[0].id, floor.id]);
    expect(decodeProject(JSON.stringify(p))).toEqual(p);
  });

  it('renames/reparents an element and detail without changing links, steel, drawings or placements', () => {
    const p = demoProject(),
      other = anotherDetail(p),
      detailId = p.hierarchy.details[0].id,
      elementId = p.hierarchy.elements[0].id;
    let next = updateHierarchyNode(
      other.project,
      'element',
      elementId,
      'V01',
      other.project.hierarchy.floors[1].id,
    );
    next = updateHierarchyNode(
      next,
      'detail',
      detailId,
      'Longitudinais',
      other.project.hierarchy.details[1].elementId,
    );
    expect(detailPath(next, detailId)).toBe('Superior / V1 / Longitudinais');
    expect(next.hierarchy.objectDetails).toEqual(p.hierarchy.objectDetails);
    expect(next.bars).toBe(p.bars);
    expect(next.details).toBe(p.details);
    expect(next.hierarchy.drawings).toEqual(other.project.hierarchy.drawings);
    expect(next.hierarchy.placements).toEqual(
      other.project.hierarchy.placements,
    );
    expect(physicalSchedule(next)).toEqual(physicalSchedule(p));
    expect(decodeProject(JSON.stringify(next))).toEqual(next);
    // History is immutable: undo can restore the old snapshot exactly.
    expect(p.hierarchy.elements[0].name).toBe('Geral');
    expect(p.hierarchy.details[0].name).toBe('Detalhamento 1');
  });

  it('moves a physical bar with its linked annotations/rebatimentos without transforming it', () => {
    const p = demoProject(),
      other = anotherDetail(p),
      bar = p.bars[0];
    const moved = moveObjectsToDetail(other.project, [bar.id], other.id);
    expect(moved.hierarchy.objectDetails[bar.id]).toBe(other.id);
    expect(moved.hierarchy.objectDetails[p.details[0].id]).toBe(other.id);
    expect(moved.hierarchy.objectDetails[p.bars[1].id]).toBe(
      p.hierarchy.details[0].id,
    );
    expect(moved.bars).toBe(p.bars);
    expect(exportLines(moved)).toEqual(exportLines(p));
    expect(physicalSchedule(moved)).toEqual(physicalSchedule(p));
    expect(scheduleChanged(moved)).toBe(false);
  });

  it('assigns new content to the active detail and linked graphics to the bar owner', () => {
    const p = demoProject(),
      other = anotherDetail(p),
      bar = newBar('N4');
    const next = completeOwnership(
      {
        ...other.project,
        bars: [...p.bars, bar],
        annotations: [
          ...p.annotations,
          { ...p.annotations[0], id: 'linked', barId: p.bars[0].id },
        ],
      },
      other.id,
    );
    expect(next.hierarchy.objectDetails[bar.id]).toBe(other.id);
    expect(next.hierarchy.objectDetails.linked).toBe(p.hierarchy.details[0].id);
    expect(decodeProject(JSON.stringify(next))).toEqual(next);
    const removed = completeOwnership({
      ...next,
      bars: next.bars.filter((b) => b.id !== bar.id),
    });
    expect(removed.hierarchy.objectDetails[bar.id]).toBeUndefined();
  });

  it('retains an existing owner through split and prevents joining across structural details', () => {
    const base = emptyProject(),
      bar = {
        ...newBar('N1'),
        id: 'physical',
        points: [
          { x: 0, y: 0 },
          { x: 3000, y: 0 },
        ],
      };
    const other = anotherDetail(completeOwnership({ ...base, bars: [bar] }));
    const p = moveObjectsToDetail(other.project, [bar.id], other.id);
    const split = splitBar(p, bar.id, 1500, 0);
    expect(
      split.bars.every((b) => split.hierarchy.objectDetails[b.id] === other.id),
    ).toBe(true);
    const mixed = moveObjectsToDetail(
      split,
      [split.bars[1].id],
      base.hierarchy.details[0].id,
    );
    expect(() =>
      joinBars(
        mixed,
        mixed.bars.map((b) => b.id),
      ),
    ).toThrow(/mesmo detalhamento/);
    expect(decodeProject(JSON.stringify(split))).toEqual(split);
  });

  it('deletes empty nodes only and never cascades into physical objects', () => {
    const p = demoProject();
    expect(() =>
      deleteHierarchyNode(p, 'detail', p.hierarchy.details[0].id),
    ).toThrow(/Mova os objetos/);
    const other = anotherDetail(p),
      d = other.project.hierarchy.details.find((d) => d.id === other.id)!;
    let next = deleteHierarchyNode(other.project, 'detail', d.id);
    expect(next.hierarchy.drawings.some((v) => v.detailId === d.id)).toBe(
      false,
    );
    next = deleteHierarchyNode(next, 'element', d.elementId);
    next = deleteHierarchyNode(
      next,
      'floor',
      other.project.hierarchy.floors[1].id,
    );
    expect(physicalSchedule(next)).toEqual(physicalSchedule(p));
    expect(next.hierarchy).toEqual(p.hierarchy);
    expect(() => createHierarchyNode(p, 'element', 'V2', 'missing')).toThrow(
      /inexistente/,
    );
    expect(() =>
      updateHierarchyNode(p, 'floor', p.hierarchy.floors[0].id, ' '),
    ).toThrow(/nome/);
  });

  it('persists paper placement independently of physical and graphical origins', () => {
    const p = demoProject(),
      before = schedule(p);
    p.hierarchy.placements[0] = {
      ...p.hierarchy.placements[0],
      origin: { x: 125, y: 75 },
      rotation: 37,
      scale: 2,
    };
    expect(schedule(p)).toEqual(before);
    expect(decodeProject(JSON.stringify(p))).toEqual(p);
  });

  it.each([
    'parent',
    'owner',
    'duplicate',
    'drawing',
    'placement',
    'unassigned',
  ])('rejects invalid v3 hierarchy: %s', (fault) => {
    const p = demoProject();
    if (fault === 'parent') p.hierarchy.elements[0].floorId = 'missing';
    if (fault === 'owner') p.hierarchy.objectDetails[p.bars[0].id] = 'missing';
    if (fault === 'duplicate') p.hierarchy.floors[0].id = p.bars[0].id;
    if (fault === 'drawing') p.hierarchy.drawings[0].detailId = 'missing';
    if (fault === 'placement') p.hierarchy.placements[0].drawingId = 'missing';
    if (fault === 'unassigned') delete p.hierarchy.objectDetails[p.bars[0].id];
    expect(() => decodeProject(JSON.stringify(p))).toThrow();
  });
});

function physicalSchedule(p: Parameters<typeof schedule>[0]) {
  return schedule(p).map(({ contributions, ...r }) => ({
    ...r,
    contributions: contributions.map(
      ({ origin: _origin, detailId: _detail, ...c }) => c,
    ),
  }));
}

function physicalCsv(p: Parameters<typeof toCsv>[0]) {
  return toCsv(p)
    .split('\r\n')
    .map((r) => r.split(';').slice(0, 10).join(';'));
}

it('explicit contextual parents isolate homonymous groups and create exactly one initial drawing without steel changes', () => {
  const original = demoProject();
  const floor = createHierarchyNode(original, 'floor', 'Cobertura');
  const lower = createHierarchyNode(
    floor.project,
    'element',
    'V01',
    original.hierarchy.floors[0].id,
  );
  const upper = createHierarchyNode(lower.project, 'element', 'V01', floor.id);
  expect(upper.project.hierarchy.details).toEqual(original.hierarchy.details);
  const made = createHierarchyNode(
    upper.project,
    'detail',
    'Armação',
    upper.id,
  );
  expect(
    made.project.hierarchy.details.find((d) => d.id === made.id)?.elementId,
  ).toBe(upper.id);
  expect(
    made.project.hierarchy.drawings.filter((d) => d.detailId === made.id),
  ).toHaveLength(1);
  expect(toCsv(made.project)).toBe(toCsv(original));
  expect(schedule(made.project)).toEqual(schedule(original));
  const restored = decodeProject(JSON.stringify(made.project));
  expect(restored.hierarchy).toEqual(made.project.hierarchy);
  expect(() =>
    createHierarchyNode(original, 'detail', 'Armação', upper.id),
  ).toThrow('inexistente');
});
