import { describe, expect, it } from 'vitest';
import {
  emptyProject,
  newBar,
  decodeProject,
  schedule,
} from '../src/domain/model';
import {
  completeOwnership,
  createHierarchyNode,
  moveObjectsToDetail,
} from '../src/domain/hierarchy';
import {
  applyDetailTransfer,
  previewDetailTransfer,
  matchingDetails,
  objectOrigin,
} from '../src/domain/detailTransfer';
import { createSheet, duplicatePlacement } from '../src/domain/sheets';
import type { Project, Detail } from '../src/domain/types';
import { assertDetailEdit } from '../src/domain/detailEditing';

function originProject() {
  let p = emptyProject();
  p.name = 'Estrutura de origem';
  p.drawing.revision = '01';
  p.hierarchy.floors[0].name = 'Térreo';
  p.hierarchy.elements[0].name = 'V1';
  p.hierarchy.details[0].name = 'Armação V1';
  p = completeOwnership({
    ...p,
    bars: [
      { ...newBar('N1'), id: 's-bar-1', quantity: 3 },
      {
        ...newBar('N2'),
        id: 's-bar-2',
        quantity: 4,
        diameter: 10,
        mandrel: 50,
        origin: { x: 0, y: 500 },
      },
    ],
    details: [{ id: 's-rep-1', barId: 's-bar-1', origin: { x: 0, y: -500 } }],
    annotations: [
      {
        id: 's-call-1',
        kind: 'leader',
        barId: 's-bar-1',
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
          { x: 300, y: 100 },
        ],
        label: '',
        textHeight: 40,
        color: '#777777',
      },
    ],
    polylines: [
      {
        id: 's-poly',
        points: [
          { x: 0, y: 100 },
          { x: 1000, y: 100 },
        ],
        closed: false,
        color: '#777777',
      },
    ],
  });
  return p;
}
function targetProject() {
  const p = emptyProject();
  p.name = 'Pranchas locais';
  return completeOwnership({
    ...p,
    bars: [{ ...newBar('N1'), id: 'local-bar', quantity: 5 }],
  });
}
function inserted() {
  const source = originProject(),
    target = targetProject();
  const plan = previewDetailTransfer(target, source, {
    mode: 'insert',
    sourceDetailId: source.hierarchy.details[0].id,
    targetElementId: target.hierarchy.elements[0].id,
    sheetId: target.sheets[0].id,
  });
  expect(plan.issues).toEqual([]);
  return {
    source,
    target,
    p: applyDetailTransfer(target, plan),
    id: plan.targetDetailId!,
  };
}
const update = (
  p: Project,
  source: Project,
  id: string,
  extra: Partial<Parameters<typeof previewDetailTransfer>[2]> = {},
) =>
  previewDetailTransfer(p, source, {
    mode: 'replace',
    sourceDetailId: source.hierarchy.details[0].id,
    targetDetailId: id,
    ...extra,
  });
function withForeignLinks(p: Project, barId: string) {
  const owner = p.hierarchy.details[0].id;
  return completeOwnership({
    ...p,
    details: [
      ...p.details,
      { id: 'foreign-rep', barId, origin: { x: 3000, y: 0 } },
    ],
    annotations: [
      ...p.annotations,
      {
        id: 'foreign-call',
        kind: 'leader',
        barId,
        points: [
          { x: 3000, y: 0 },
          { x: 3100, y: 100 },
          { x: 3300, y: 100 },
        ],
        label: '',
        textHeight: 40,
        color: '#777777',
      },
    ],
    hierarchy: {
      ...p.hierarchy,
      objectDetails: {
        ...p.hierarchy.objectDetails,
        'foreign-rep': owner,
        'foreign-call': owner,
      },
    },
  });
}

describe('selective detail insertion and revision', () => {
  it('requires an explicit position choice when several local physical positions carry the same source identity', () => {
    const { source, p, id } = inserted(),
      bar = p.bars[1];
    const duplicate = completeOwnership({
      ...p,
      bars: [...p.bars, { ...bar, id: 'local-duplicate', mark: 'N99' }],
      hierarchy: {
        ...p.hierarchy,
        objectDetails: { ...p.hierarchy.objectDetails, 'local-duplicate': id },
        objectOrigins: {
          ...p.hierarchy.objectOrigins,
          'local-duplicate': objectOrigin(p, bar.id),
        },
      },
    });
    const pending = update(duplicate, source, id);
    expect(pending.ambiguousBars).toContain('s-bar-1');
    expect(pending.project).toBeUndefined();
    const resolved = update(duplicate, source, id, {
      barMap: { 's-bar-1': bar.id },
      keepBars: ['local-duplicate'],
    });
    expect(resolved.issues).toEqual([]);
    expect(resolved.project!.bars).toHaveLength(4);
  });
  it('allows ordinary isolated edits/deletion of imported objects while retaining provenance of all surviving objects', () => {
    const { p, id } = inserted(),
      bar = p.bars[1];
    const edited = completeOwnership(
      {
        ...p,
        bars: p.bars.map((b) => (b.id === bar.id ? { ...b, quantity: 7 } : b)),
      },
      id,
    );
    expect(() => assertDetailEdit(p, edited, id)).not.toThrow();
    const removed = completeOwnership(
      {
        ...p,
        bars: p.bars.filter((b) => b.id !== bar.id),
        annotations: p.annotations.filter((a) => a.barId !== bar.id),
        details: p.details.filter((d) => d.barId !== bar.id),
      },
      id,
    );
    expect(() => assertDetailEdit(p, removed, id)).not.toThrow();
    expect(removed.hierarchy.objectOrigins[bar.id]).toBeUndefined();
    expect(decodeProject(JSON.stringify(removed))).toEqual(removed);
  });
  it('adds import lineage to schema-5 projects without changing their content or paper transforms', () => {
    const p = originProject(),
      raw = JSON.parse(JSON.stringify(p));
    raw.schema = 'armadurastruct/5';
    delete raw.hierarchy.objectOrigins;
    const migrated = decodeProject(JSON.stringify(raw));
    expect(migrated.schema).toBe('armadurastruct/25');
    expect(migrated.bars).toEqual(p.bars);
    expect(migrated.annotations).toMatchObject(p.annotations);
    expect(migrated.details).toEqual(p.details);
    expect(migrated.sheets).toEqual(p.sheets);
    expect(migrated.hierarchy.placements).toEqual(p.hierarchy.placements);
    expect(migrated.hierarchy.objectOrigins).toEqual({});
    const malformed = JSON.parse(JSON.stringify(migrated));
    delete malformed.hierarchy.objectOrigins;
    expect(() => decodeProject(JSON.stringify(malformed))).toThrow(
      /sem identidades de origem/,
    );
  });

  it('replaces mask/polyline content while preserving their local IDs and every object outside the selected detail', () => {
    let source = originProject();
    source = completeOwnership({
      ...source,
      masks: [
        {
          id: 's-mask',
          name: 'Fôrma',
          format: 'DEMO',
          primitives: [
            {
              layer: 'FORMAS',
              points: [
                { x: 0, y: 0 },
                { x: 1500, y: 0 },
              ],
            },
          ],
          layers: { FORMAS: true },
          visible: true,
          opacity: 0.5,
          scale: 1,
          origin: { x: 0, y: 0 },
          rotation: 0,
          sourceUnit: 'mm',
          warnings: [],
        },
      ],
    });
    const target = targetProject(),
      first = previewDetailTransfer(target, source, {
        mode: 'insert',
        sourceDetailId: source.hierarchy.details[0].id,
        targetElementId: target.hierarchy.elements[0].id,
      });
    expect(first.issues).toEqual([]);
    const p = first.project!,
      revision = structuredClone(source);
    revision.masks[0].opacity = 0.8;
    revision.polylines[0].points[1].y = 300;
    const next = update(p, revision, first.targetDetailId!);
    expect(next.issues).toEqual([]);
    expect(next.project!.masks[0].id).toBe(p.masks[0].id);
    expect(next.project!.masks[0].opacity).toBe(0.8);
    expect(next.project!.polylines[0].id).toBe(p.polylines[0].id);
    expect(next.project!.bars[0]).toEqual(target.bars[0]);
    expect(next.physicalChanged).toBe(false);
  });
  it('inserts only the selected detail, remaps colliding IDs/marks, owns all objects and never mutates either input', () => {
    const source = originProject(),
      target = targetProject(),
      old = JSON.stringify(target),
      oldSource = JSON.stringify(source);
    const plan = previewDetailTransfer(target, source, {
      mode: 'insert',
      sourceDetailId: source.hierarchy.details[0].id,
      targetElementId: target.hierarchy.elements[0].id,
      sheetId: target.sheets[0].id,
    });
    expect(plan.issues).toEqual([]);
    expect(JSON.stringify(target)).toBe(old);
    expect(JSON.stringify(source)).toBe(oldSource);
    const p = applyDetailTransfer(target, plan),
      owner = plan.targetDetailId!;
    expect(p.id).toBe(target.id);
    expect(p.name).toBe(target.name);
    expect(p.bars).toHaveLength(3);
    expect(p.bars[0]).toEqual(target.bars[0]);
    expect(new Set(p.bars.map((b) => b.mark)).size).toBe(3);
    const first = plan.bars.find((r) => r.sourceId === 's-bar-1')!.after!;
    expect(first.id).not.toBe('s-bar-1');
    expect(first.quantity).toBe(3);
    expect(p.details[0].barId).toBe(first.id);
    expect(p.annotations[0].barId).toBe(first.id);
    expect(p.hierarchy.objectDetails[first.id]).toBe(owner);
    expect(objectOrigin(p, first.id)).toEqual({
      projectId: source.id,
      objectId: 's-bar-1',
    });
    expect(p.hierarchy.placements).toHaveLength(1);
    expect(decodeProject(JSON.stringify(p))).toEqual(p);
  });

  it('updates quantity and geometry once in the global model, retains IDs/marks and every sheet placement, and invalidates locked RA', () => {
    const { source, p: initial, id } = inserted();
    const copy = duplicatePlacement(
      initial,
      initial.hierarchy.placements[0].id,
    );
    const second = createSheet(copy.project, 'Outra folha');
    let p = second.project;
    p.hierarchy.placements[p.hierarchy.placements.length - 1] = {
      ...p.hierarchy.placements.at(-1)!,
      sheetId: second.id,
      scale: 100,
      rotation: 37,
      origin: { x: 80, y: 100 },
    };
    p = {
      ...p,
      scheduleLock: { at: 'conferida', bars: structuredClone(p.bars) },
    };
    const revision = structuredClone(source);
    revision.drawing.revision = '02';
    revision.bars[0].quantity = 9;
    revision.bars[0].points[1].x = 1250;
    const plan = update(p, revision, id);
    expect(plan.issues).toEqual([]);
    const after = applyDetailTransfer(p, plan),
      mapped = plan.bars.find((r) => r.sourceId === 's-bar-1')!;
    expect(mapped.before!.id).toBe(mapped.after!.id);
    expect(mapped.before!.mark).toBe(mapped.after!.mark);
    expect(mapped.after!.quantity).toBe(9);
    expect(after.bars).toHaveLength(3);
    expect(after.hierarchy.placements).toEqual(p.hierarchy.placements);
    expect(after.hierarchy.drawings).toEqual(p.hierarchy.drawings);
    expect(plan.affectedViews).toHaveLength(2);
    expect(plan.raInvalidated).toBe(true);
    expect(after.scheduleLock).toBeUndefined();
    expect(
      schedule(after).find((r) => r.bar.id === mapped.after!.id)?.quantity,
    ).toBe(9);
    expect(schedule(after)).toHaveLength(3);
    expect(after.hierarchy.floors).toEqual(p.hierarchy.floors);
    expect(after.hierarchy.elements).toEqual(p.hierarchy.elements);
    expect(after.sheets).toEqual(p.sheets);
    expect(
      after.hierarchy.details.find((d) => d.id === id)?.source?.revision,
    ).toBe('02');
  });

  it('never identifies a same-named V1 from another floor as an equivalent revision', () => {
    const { source, p, id } = inserted();
    const floor = createHierarchyNode(source, 'floor', 'Superior'),
      element = createHierarchyNode(floor.project, 'element', 'V1', floor.id),
      detail = createHierarchyNode(
        element.project,
        'detail',
        'Armação V1',
        element.id,
      );
    const other = completeOwnership(
      {
        ...detail.project,
        bars: [...detail.project.bars, { ...newBar('N3'), id: 'upstairs-bar' }],
      },
      detail.id,
    );
    expect(matchingDetails(p, other, detail.id)).toEqual([]);
    const plan = previewDetailTransfer(p, other, {
      mode: 'replace',
      sourceDetailId: detail.id,
      targetDetailId: id,
    });
    expect(plan.issues.join(' ')).toContain('origem é diferente');
    expect(() => applyDetailTransfer(p, plan)).toThrow(/pendentes/);
    const insertedOther = previewDetailTransfer(p, other, {
      mode: 'insert',
      sourceDetailId: detail.id,
      targetElementId: p.hierarchy.elements[0].id,
    });
    expect(insertedOther.issues).toEqual([]);
    expect(insertedOther.project!.bars).toHaveLength(p.bars.length + 1);
    expect(
      insertedOther.project!.bars.find((b) => b.id === p.bars[1].id),
    ).toEqual(p.bars[1]);
  });

  it('does not guess preserved positions by mark, and permits explicit one-to-one mapping when source IDs changed', () => {
    const { source, p, id } = inserted(),
      revision = structuredClone(source),
      oldId = p.bars[1].id;
    revision.bars[0].id = 'recreated-id';
    revision.details[0].barId = 'recreated-id';
    revision.annotations[0].barId = 'recreated-id';
    const revised = completeOwnership(revision, source.hierarchy.details[0].id);
    const automatic = update(p, revised, id);
    expect(automatic.mapping['recreated-id']).toBe('');
    expect(
      automatic.bars.some((r) => r.localId === oldId && r.status === 'removed'),
    ).toBe(true);
    const manual = update(p, revised, id, {
      barMap: { 'recreated-id': oldId },
    });
    expect(manual.issues).toEqual([]);
    expect(manual.project!.bars.find((b) => b.id === oldId)).toBeDefined();
    expect(manual.project!.details[0].barId).toBe(oldId);
    expect(objectOrigin(manual.project!, oldId).objectId).toBe('recreated-id');
    const duplicate = update(p, source, id, {
      barMap: { 's-bar-1': oldId, 's-bar-2': oldId },
    });
    expect(duplicate.issues.join(' ')).toContain('repetido');
    const foreign = update(p, source, id, {
      barMap: { 's-bar-1': 'local-bar' },
    });
    expect(foreign.project).toBeUndefined();
  });

  it('blocks orphaned local references until each foreign annotation/rebatimento is explicitly reassociated', () => {
    const { source, p: base, id } = inserted(),
      oldId = base.bars[1].id,
      p = withForeignLinks(base, oldId);
    const revision = completeOwnership({
      ...source,
      bars: source.bars.slice(1),
      annotations: [],
      details: [],
    });
    const unresolved = update(p, revision, id);
    expect(unresolved.references.filter((r) => !r.resolved)).toHaveLength(2);
    expect(unresolved.project).toBeUndefined();
    const plan = update(p, revision, id, {
      references: {
        'existing:foreign-call': 'source:s-bar-2',
        'existing:foreign-rep': 'source:s-bar-2',
      },
    });
    expect(plan.issues).toEqual([]);
    const after = applyDetailTransfer(p, plan),
      newId = plan.mapping['s-bar-2'];
    expect(after.annotations.find((a) => a.id === 'foreign-call')?.barId).toBe(
      newId,
    );
    expect(after.details.find((d) => d.id === 'foreign-rep')?.barId).toBe(
      newId,
    );
    expect(after.hierarchy.objectDetails['foreign-call']).toBe(
      p.hierarchy.objectDetails['foreign-call'],
    );
    expect(after.bars).toHaveLength(2);
    expect(after.bars.some((b) => b.id === oldId)).toBe(false);
    expect(decodeProject(JSON.stringify(after))).toEqual(after);
  });

  it('can explicitly detach a call or remove a representation, preserving text/geometry and no extra steel', () => {
    const { source, p: base, id } = inserted(),
      p = withForeignLinks(base, base.bars[1].id),
      revision = completeOwnership({
        ...source,
        bars: source.bars.slice(1),
        annotations: [],
        details: [],
      });
    const plan = update(p, revision, id, {
      references: {
        'existing:foreign-call': 'detach',
        'existing:foreign-rep': 'remove',
      },
    });
    expect(plan.issues).toEqual([]);
    const after = plan.project!,
      call = after.annotations.find((a) => a.id === 'foreign-call')!;
    expect(call.barId).toBeUndefined();
    expect(call.label).toContain(p.bars[1].mark);
    expect(call.points).toEqual(
      p.annotations.find((a) => a.id === 'foreign-call')!.points,
    );
    expect(after.details.some((d) => d.id === 'foreign-rep')).toBe(false);
    expect(after.hierarchy.objectDetails['foreign-rep']).toBeUndefined();
    expect(after.bars).toHaveLength(2);
  });

  it('retains local positions and their linked graphics only when explicitly requested', () => {
    const { source, p, id } = inserted(),
      old = p.bars[1],
      revision = completeOwnership({
        ...source,
        bars: source.bars.slice(1),
        annotations: [],
        details: [],
      });
    const plan = update(p, revision, id, { keepBars: [old.id] });
    expect(plan.issues).toEqual([]);
    expect(plan.project!.bars.find((b) => b.id === old.id)).toEqual(old);
    expect(plan.project!.details.find((d) => d.barId === old.id)).toEqual(
      p.details[0],
    );
    expect(plan.bars.find((r) => r.localId === old.id)?.status).toBe('kept');
  });

  it('exposes missing source references for mapping while full project opens remain strict', () => {
    const source = originProject(),
      target = targetProject(),
      raw = JSON.stringify({
        ...source,
        details: [{ ...source.details[0], barId: 'missing' }],
        annotations: [{ ...source.annotations[0], barId: 'missing' }],
      });
    expect(() => decodeProject(raw)).toThrow(/sem armadura/);
    const readable = decodeProject(raw, { allowOrphanReferences: true });
    const options = {
      mode: 'insert' as const,
      sourceDetailId: source.hierarchy.details[0].id,
      targetElementId: target.hierarchy.elements[0].id,
    };
    const pending = previewDetailTransfer(target, readable, options);
    expect(pending.references.filter((r) => !r.sourceAvailable)).toHaveLength(
      2,
    );
    expect(pending.project).toBeUndefined();
    const resolved = previewDetailTransfer(target, readable, {
      ...options,
      references: {
        'incoming:s-call-1': 'source:s-bar-2',
        'incoming:s-rep-1': 'target:local-bar',
      },
    });
    expect(resolved.issues).toEqual([]);
    expect(resolved.project!.details[0].barId).toBe('local-bar');
    expect(resolved.project!.bars).toHaveLength(3);
  });

  it('imports an external referenced position once only after an explicit dependency decision', () => {
    let source = originProject();
    const extra = createHierarchyNode(
      source,
      'detail',
      'Posição externa',
      source.hierarchy.elements[0].id,
    );
    source = completeOwnership({
      ...extra.project,
      bars: [
        ...source.bars,
        { ...newBar('N3'), id: 'external-source-bar', quantity: 8 },
      ],
      hierarchy: {
        ...extra.project.hierarchy,
        objectDetails: {
          ...extra.project.hierarchy.objectDetails,
          'external-source-bar': extra.id,
        },
      },
    });
    source.annotations[0] = {
      ...source.annotations[0],
      barId: 'external-source-bar',
    };
    source.details[0] = { ...source.details[0], barId: 'external-source-bar' };
    const p = targetProject(),
      options = {
        mode: 'insert' as const,
        sourceDetailId: source.hierarchy.details[0].id,
        targetElementId: p.hierarchy.elements[0].id,
      };
    expect(
      previewDetailTransfer(p, source, options).references.filter(
        (r) => !r.resolved,
      ),
    ).toHaveLength(2);
    const plan = previewDetailTransfer(p, source, {
      ...options,
      references: { 'incoming:s-call-1': 'import:external-source-bar' },
    });
    expect(plan.issues).toEqual([]);
    expect(plan.bars.filter((r) => r.dependency)).toHaveLength(1);
    expect(plan.project!.bars).toHaveLength(4);
    const bar = plan.bars.find((r) => r.dependency)!.after!;
    expect(plan.project!.annotations[0].barId).toBe(bar.id);
    expect(plan.project!.details[0].barId).toBe(bar.id);
    expect(bar.quantity).toBe(8);
    const revised = structuredClone(source);
    revised.bars.find((b) => b.id === 'external-source-bar')!.quantity = 12;
    const refreshed = previewDetailTransfer(plan.project!, revised, {
      mode: 'replace',
      sourceDetailId: options.sourceDetailId,
      targetDetailId: plan.targetDetailId,
      references: { 'incoming:s-call-1': 'import:external-source-bar' },
    });
    expect(refreshed.issues).toEqual([]);
    expect(refreshed.project!.bars).toHaveLength(4);
    expect(refreshed.project!.bars.find((b) => b.id === bar.id)?.quantity).toBe(
      12,
    );
  });

  it('blocks a repeated origin insertion, preserves source lineage through save/reopen and rejects stale previews', () => {
    const { source, p, id } = inserted(),
      reopened = decodeProject(JSON.stringify(p));
    expect(
      matchingDetails(reopened, source, source.hierarchy.details[0].id).map(
        (d) => d.id,
      ),
    ).toEqual([id]);
    const duplicate = previewDetailTransfer(reopened, source, {
      mode: 'insert',
      sourceDetailId: source.hierarchy.details[0].id,
      targetElementId: p.hierarchy.elements[0].id,
    });
    expect(duplicate.issues.join(' ')).toContain('já existe');
    expect(duplicate.project).toBeUndefined();
    const plan = update(reopened, source, id);
    expect(() =>
      applyDetailTransfer({ ...reopened, name: 'Mudou' }, plan),
    ).toThrow(/projeto mudou/);
    const other = targetProject(),
      chain = previewDetailTransfer(other, reopened, {
        mode: 'insert',
        sourceDetailId: id,
        targetElementId: other.hierarchy.elements[0].id,
      });
    expect(chain.issues).toEqual([]);
    expect(
      matchingDetails(chain.project!, source, source.hierarchy.details[0].id),
    ).toHaveLength(1);
  });

  it('retains the locked RA for graphical changes and optionally recenters views without changing paper transforms', () => {
    const { source, p: initial, id } = inserted(),
      p = {
        ...initial,
        scheduleLock: { at: 'conferida', bars: structuredClone(initial.bars) },
      },
      revision = structuredClone(source);
    revision.bars[0].color = '#112233';
    revision.bars[0].origin.x += 10000;
    revision.details[0].origin.x += 10000;
    const plan = update(p, revision, id, { recenterViews: true });
    expect(plan.issues).toEqual([]);
    expect(plan.physicalChanged).toBe(false);
    expect(plan.raInvalidated).toBe(false);
    expect(plan.project!.scheduleLock).toEqual(p.scheduleLock);
    const view = plan.project!.hierarchy.placements[0],
      old = p.hierarchy.placements[0];
    expect(view.origin).toEqual(old.origin);
    expect(view.scale).toBe(old.scale);
    expect(view.rotation).toBe(old.rotation);
    expect(view.modelOrigin).not.toEqual(old.modelOrigin);
  });

  it('keeps object lineage when moving a position, and refuses to create an automatic steel duplicate in another detail', () => {
    const { source, p, id } = inserted(),
      bar = p.bars[1],
      moved = moveObjectsToDetail(p, [bar.id], p.hierarchy.details[0].id);
    expect(objectOrigin(moved, bar.id)).toEqual(objectOrigin(p, bar.id));
    const plan = update(moved, source, id);
    expect(plan.issues.join(' ')).toContain('outro detalhamento');
    expect(plan.project).toBeUndefined();
    const malformed = structuredClone(p);
    malformed.hierarchy.objectOrigins['absent'] = {
      projectId: 'origin',
      objectId: 'bar',
    };
    expect(() => decodeProject(JSON.stringify(malformed))).toThrow(
      /Origem de objeto/,
    );
  });
});
