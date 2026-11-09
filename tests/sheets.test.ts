import { describe, expect, it } from 'vitest';
import {
  decodeProject,
  demoProject,
  emptyProject,
  schedule,
  scheduleChanged,
} from '../src/domain/model';
import { createHierarchyNode } from '../src/domain/hierarchy';
import {
  createSheet,
  deleteSheet,
  duplicateSheet,
  placeDrawing,
  removePlacement,
  reorderSheet,
  sheetSize,
  unplacedDrawings,
  updatePlacement,
  updateSheet,
} from '../src/domain/sheets';
import {
  assertDetailEdit,
  detailEditorView,
  groupInDetail,
} from '../src/domain/detailEditing';
import { drawingPrimitives } from '../src/domain/drawingPrimitives';
import type { Project } from '../src/domain/types';

const steel = (p: Project) => ({
  bars: p.bars,
  details: p.details,
  masks: p.masks,
  annotations: p.annotations,
  polylines: p.polylines,
  owners: p.hierarchy.objectDetails,
  schedule: schedule(p),
});

describe('versioned paper documents', () => {
  it.each(['armadurastruct/1', 'armadurastruct/2', 'armadurastruct/3'])(
    'migrates %s without moving or duplicating any physical or graphical object',
    (schema) => {
      const source = demoProject();
      source.scheduleLock = {
        at: '2026-11-07',
        bars: structuredClone(source.bars),
      };
      const old = {
        ...source,
        schema,
        sheets: undefined,
        ...(schema !== 'armadurastruct/3'
          ? { id: undefined, hierarchy: undefined }
          : {
              hierarchy: {
                ...source.hierarchy,
                placements: source.hierarchy.placements.map(
                  ({ sheetId: _sheetId, frame: _frame, ...view }) => ({
                    ...view,
                    origin: { x: 12, y: -75 },
                    rotation: 32,
                    scale: 2,
                  }),
                ),
              },
            }),
      };
      const raw = JSON.stringify(old),
        p = decodeProject(raw);
      expect(p.schema).toBe('armadurastruct/24');
      expect(p.sheets).toHaveLength(1);
      for (const field of [
        'bars',
        'details',
        'masks',
        'annotations',
        'polylines',
        'drawing',
        'scheduleLock',
      ] as const)
        if (field === 'annotations' || field === 'polylines')
          expect(p[field]).toMatchObject(source[field]);
        else expect(p[field]).toEqual(source[field]);
      expect(physicalSchedule(p)).toEqual(physicalSchedule(source));
      expect(scheduleChanged(p)).toBe(false);
      expect(p.hierarchy.placements[0].sheetId).toBe(p.sheets[0].id);
      if (schema === 'armadurastruct/3') {
        expect(p.id).toBe(source.id);
        expect(p.hierarchy.objectDetails).toEqual(
          source.hierarchy.objectDetails,
        );
        const { scale, ...placement } = old.hierarchy!.placements[0];
        expect(p.hierarchy.placements[0]).toMatchObject({
          ...placement,
          legacyScale: scale,
        });
      }
      expect(decodeProject(raw)).toEqual(p);
      expect(decodeProject(JSON.stringify(p))).toEqual(p);
    },
  );

  it('creates empty sheets and unplaced drawings, with independent stable identities', () => {
    const p = emptyProject(),
      second = createSheet(p, 'Folha 1');
    expect(second.project.sheets[0].id).not.toBe(second.id);
    expect(second.project.hierarchy.placements).toHaveLength(0);
    expect(unplacedDrawings(second.project)).toEqual(p.hierarchy.drawings);
    const detail = createHierarchyNode(
      p,
      'detail',
      'Viga',
      p.hierarchy.elements[0].id,
    );
    expect(unplacedDrawings(detail.project)).toHaveLength(2);
    expect(decodeProject(JSON.stringify(detail.project))).toEqual(
      detail.project,
    );
  });

  it('duplicates references and independently positions layouts without cloning steel or unlocking RA', () => {
    let p = demoProject();
    p.scheduleLock = { at: 'now', bars: structuredClone(p.bars) };
    const before = steel(p),
      original = p.hierarchy.placements[0];
    const copy = duplicateSheet(p, p.sheets[0].id);
    p = copy.project;
    const copied = p.hierarchy.placements.find((v) => v.sheetId === copy.id)!;
    expect(copied.id).not.toBe(original.id);
    expect(copied.drawingId).toBe(original.drawingId);
    expect(copied.origin).not.toBe(original.origin);
    expect(copied.frame).not.toBe(original.frame);
    p = updatePlacement(p, copied.id, {
      origin: { x: 32, y: 19 },
      rotation: 90,
      frame: { width: 200, height: 80 },
    });
    expect(p.hierarchy.placements[0]).toEqual(original);
    expect(steel(p)).toEqual(before);
    expect(scheduleChanged(p)).toBe(false);
    p = updateSheet(p, copy.id, {
      name: 'Detalhes superiores',
      format: 'A2',
      orientation: 'portrait',
      properties: { revision: 'R03', notes: 'Montagem' },
    });
    p = reorderSheet(p, copy.id, -1);
    expect(p.sheets[0].id).toBe(copy.id);
    expect(sheetSize(p.sheets[0])).toEqual({ width: 420, height: 594 });
    expect(decodeProject(JSON.stringify(p))).toEqual(p);
    expect(steel(deleteSheet(p, copy.id))).toEqual(before);
    expect(steel(p)).toEqual(before);
  });

  it('removes only sheet references and supports zero sheets, undo snapshots and later placement', () => {
    const p = demoProject(),
      before = structuredClone(p);
    const removed = deleteSheet(p, p.sheets[0].id);
    expect(removed.sheets).toEqual([]);
    expect(removed.hierarchy.placements).toEqual([]);
    expect(unplacedDrawings(removed)).toEqual(p.hierarchy.drawings);
    expect(steel(removed)).toEqual(steel(p));
    expect(p).toEqual(before);
    expect(decodeProject(JSON.stringify(removed))).toEqual(removed);
    const next = createSheet(removed, 'Revisão');
    const placed = placeDrawing(
      next.project,
      next.id,
      p.hierarchy.drawings[0].id,
    );
    const two = placeDrawing(
      placed.project,
      next.id,
      p.hierarchy.drawings[0].id,
    );
    expect(two.project.hierarchy.placements).toHaveLength(2);
    expect(steel(two.project)).toEqual(steel(p));
    const one = removePlacement(two.project, placed.id);
    expect(unplacedDrawings(one)).toEqual([]);
    expect(unplacedDrawings(removePlacement(one, two.id))).toHaveLength(1);
  });

  it('renders every view from the latest source including external references, and protects sheets during isolation', () => {
    const p = demoProject(),
      grouped = groupInDetail(
        p,
        [p.bars[0].id],
        'Viga',
        p.hierarchy.elements[0].id,
      );
    const full = grouped.project,
      before = steel(full);
    expect(() =>
      assertDetailEdit(full, createSheet(full, 'Extra').project, grouped.id),
    ).toThrow(/edição isolada/);
    const changed = {
      ...full,
      bars: full.bars.map((b) =>
        b.id === p.bars[0].id ? { ...b, diameter: 16, quantity: 7 } : b,
      ),
    };
    assertDetailEdit(full, changed, grouped.id);
    const lines = drawingPrimitives(
      detailEditorView(changed, grouped.id),
      changed,
    );
    expect(lines.some((l) => l.text?.includes('7 x %%c16'))).toBe(true);
    expect(steel(full)).toEqual(before);
    const projected = detailEditorView(full, grouped.id);
    projected.details = [{ ...p.details[1], id: 'external-representation' }];
    expect(
      drawingPrimitives(projected, full).some(
        (l) => l.layer === 'REBATIMENTOS',
      ),
    ).toBe(true);
  });

  it.each([
    'sheet-ref',
    'drawing-ref',
    'duplicate',
    'missing-sheets',
    'missing-frame',
    'missing-sheet-id',
    'frame-zero',
    'frame-infinite',
  ])('rejects invalid document state: %s', (fault) => {
    const p = demoProject() as Project;
    if (fault === 'sheet-ref') p.hierarchy.placements[0].sheetId = 'absent';
    if (fault === 'drawing-ref') p.hierarchy.placements[0].drawingId = 'absent';
    if (fault === 'duplicate') p.sheets[0].id = p.bars[0].id;
    const raw = JSON.parse(JSON.stringify(p));
    if (fault === 'missing-sheets') delete raw.sheets;
    if (fault === 'missing-frame') delete raw.hierarchy.placements[0].frame;
    if (fault === 'missing-sheet-id')
      delete raw.hierarchy.placements[0].sheetId;
    if (fault === 'frame-zero') raw.hierarchy.placements[0].frame.width = 0;
    if (fault === 'frame-infinite')
      raw.hierarchy.placements[0].frame.height = Infinity;
    expect(() => decodeProject(JSON.stringify(raw))).toThrow();
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
