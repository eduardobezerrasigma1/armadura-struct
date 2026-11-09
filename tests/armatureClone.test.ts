import { describe, expect, it } from 'vitest';
import {
  createCloneSource,
  createArmatureCloneExample,
} from '../docs/examples/armature-clone';
import {
  applyRebarBatch,
  executeRebarBatch,
  cloneArmatureGraph,
  planArmatureClone,
  type RebarCommand,
} from '../src/api';
import { decodeProject, newBar, schedule } from '../src/domain/model';
import {
  completeOwnership,
  createHierarchyNode,
  contentObjects,
} from '../src/domain/hierarchy';
import { geometry } from '../src/domain/geometry';
import { armatureReferences } from '../src/domain/armatureReferences';
import { fabricationPositions } from '../src/domain/fabrication';
import {
  createDetailPackage,
  readDetailPackage,
} from '../src/domain/detailPackage';
import {
  previewDetailTransfer,
  applyDetailTransfer,
} from '../src/domain/detailTransfer';
import type { Project } from '../src/domain/types';
const delta = { x: 3000, y: -200 };
function run(p: Project, commands: RebarCommand[]) {
  return applyRebarBatch(p, executeRebarBatch(p, commands, { units: 'mm' }));
}
function mass(p: Project) {
  return schedule({ ...p, scheduleLock: undefined }).reduce(
    (n, r) => n + r.weight,
    0,
  );
}
function sharedSource() {
  const p = createCloneSource();
  return completeOwnership({
    ...p,
    bars: [
      ...p.bars,
      { ...newBar('N2'), id: 'other', origin: { x: 5000, y: 0 } },
    ],
    polylines: [{ ...p.polylines[0], barIds: ['original', 'other'] }],
  });
}
describe('AS-53 · grafo físico e dependências de apresentação', () => {
  it('copia profundamente duas inserções, chamada, faixa e auxiliar, transladando uma única vez', () => {
    const p = createCloneSource(),
      before = JSON.stringify(p);
    const { project: q, idMap } = cloneArmatureGraph(p, {
      barIds: ['original'],
      objectIds: ['call', 'aux'],
      delta,
    });
    expect(JSON.stringify(p)).toBe(before);
    expect(q.bars).toHaveLength(2);
    expect(q.details).toHaveLength(4);
    expect(q.annotations).toHaveLength(2);
    expect(q.polylines).toHaveLength(2);
    const b = q.bars[1];
    expect(b.id).toBe(idMap.original);
    expect(b.origin).toEqual({ x: 3100, y: 0 });
    expect(b.distribution?.start).toEqual({ x: 3100, y: 0 });
    expect(b.distribution?.end).toEqual({ x: 3100, y: 600 });
    expect(b.points).toEqual(p.bars[0].points);
    expect(b.points).not.toBe(p.bars[0].points);
    expect(b.quantitySource).toEqual(p.bars[0].quantitySource);
    expect(b.quantitySource).not.toBe(p.bars[0].quantitySource);
    expect(b).toMatchObject({
      quantity: 4,
      multiplier: 2,
      comment: 'Montagem em pares',
      columnLevel: 'Lance 1',
      ribbed: true,
    });
    expect(q.details[2]).toMatchObject({
      barId: b.id,
      origin: { x: 3100, y: -600 },
      identification: 'primary',
      label: p.details[0].label,
    });
    expect(q.details[2].label).not.toBe(p.details[0].label);
    expect(q.details[3]).toMatchObject({
      barId: b.id,
      origin: { x: 4800, y: 0 },
      rotation: 90,
      scale: 2,
    });
    expect(q.annotations[1]).toMatchObject({
      barId: b.id,
      points: [
        { x: 3100, y: 0 },
        { x: 3300, y: 200 },
        { x: 3700, y: 200 },
      ],
    });
    expect(q.polylines[1].barIds).toEqual([b.id]);
    expect(new Set(contentObjects(q).map((o) => o.id)).size).toBe(10);
    for (const id of Object.values(idMap))
      expect(q.hierarchy.objectOrigins[id]).toEqual({
        projectId: p.id,
        objectId: id,
      });
    expect(geometry(b).length).toBe(1000);
    expect(schedule(q).reduce((s, r) => s + r.quantity, 0)).toBe(16);
    expect(mass(q)).toBeCloseTo(((2 * 8 * Math.PI * 0.01 ** 2) / 4) * 7850, 10);
    const updated = run(q, [
      {
        type: 'bar.update',
        id: b.id,
        patch: { kind: 'free', quantity: 2, diameter: 12.5 },
      },
    ]);
    expect(updated.bars[0]).toEqual(p.bars[0]);
    expect(updated.details.slice(0, 2)).toEqual(p.details);
    expect(decodeProject(JSON.stringify(updated))).toEqual(updated);
  });
  it('exige escolha em dependência compartilhada e mantém apenas os vínculos externos quando solicitado', () => {
    const p = sharedSource();
    const rejected = executeRebarBatch(
      p,
      [{ type: 'armature.clone', barIds: ['original'], delta }],
      { units: 'mm' },
    );
    expect(rejected.project).toBe(p);
    expect(rejected.issues[0]).toMatchObject({
      code: 'SHARED_DEPENDENCY',
      field: 'shared',
      objectId: 'aux',
    });
    const q = run(p, [
      {
        type: 'armature.clone',
        barIds: ['original'],
        delta,
        shared: 'keep',
        ids: { original: 'copy' },
      },
    ]);
    expect(q.bars).toHaveLength(3);
    expect(q.polylines[0]).toEqual(p.polylines[0]);
    expect(q.polylines[1].barIds).toEqual(['copy', 'other']);
    expect(q.bars.find((b) => b.id === 'other')).toEqual(p.bars[1]);
    expect(mass(q) - mass(p)).toBeCloseTo(mass(createCloneSource()), 10);
  });
  it('fecha transitivamente o conjunto e remapeia dependências internas sem duplicações silenciosas', () => {
    let p = sharedSource();
    p = completeOwnership({
      ...p,
      bars: [...p.bars, { ...newBar('N3'), id: 'third' }],
      polylines: [
        ...p.polylines,
        { ...p.polylines[0], id: 'bridge', barIds: ['other', 'third'] },
      ],
    });
    expect(
      planArmatureClone(p, { barIds: ['original'], shared: 'clone-set' })
        .barIds,
    ).toEqual(['original', 'other', 'third']);
    const { project: q, idMap } = cloneArmatureGraph(p, {
      barIds: ['original', 'original'],
      objectIds: ['aux'],
      delta,
      shared: 'clone-set',
    });
    expect(q.bars).toHaveLength(6);
    expect(q.polylines).toHaveLength(4);
    expect(mass(q)).toBeCloseTo(mass(p) * 2, 10);
    expect(q.polylines[2].barIds).toEqual([idMap.original, idMap.other]);
    expect(q.polylines[3].barIds).toEqual([idMap.other, idMap.third]);
    expect(contentObjects(q).slice(0, 3)).toEqual(p.bars);
  });
  it('cópia exclusivamente gráfica não fabrica aço nem duplica a identificação principal', () => {
    const p = createCloneSource();
    const q = run(p, [
      {
        type: 'armature.clone',
        barIds: [],
        objectIds: ['view-a', 'call', 'aux'],
        delta,
      },
    ]);
    expect(q.bars).toEqual(p.bars);
    expect(q.details[2]).toMatchObject({
      barId: 'original',
      identification: 'mark',
    });
    expect(q.annotations[1].barId).toBe('original');
    expect(mass(q)).toBe(mass(p));
  });
  it('reutiliza posição equivalente ou busca posição livre respeitando reservas', () => {
    const p = createCloneSource();
    p.numbering = {
      prefix: 'N',
      start: 1,
      reserved: ['N2'],
      preservedPositionIds: [],
    };
    const q = run(p, [
      { type: 'bar.copy', id: 'original', newId: 'copy', delta },
    ]);
    expect(q.bars[1].mark).toBe('N3');
    const eq = run(p, [
      {
        type: 'armature.clone',
        barIds: ['original'],
        delta,
        position: 'equivalent',
      },
    ]);
    expect(fabricationPositions(eq)).toHaveLength(1);
    expect(schedule(eq)[0].quantity).toBe(16);
    expect(schedule(eq)[0].contributions).toHaveLength(2);
    expect(mass(eq)).toBeCloseTo(2 * mass(p), 10);
    const changed = run(eq, [
      {
        type: 'bar.update',
        id: eq.bars[1].id,
        patch: { kind: 'free', diameter: 12.5 },
      },
    ]);
    expect(fabricationPositions(changed)).toHaveLength(2);
    expect(changed.bars[0]).toEqual(p.bars[0]);
  });
  it('reverte lote inteiro para ID em colisão, inexistente, unidades ou geometria inválida', () => {
    const p = createCloneSource();
    const invalid: RebarCommand[] = [
      { type: 'armature.clone', barIds: ['missing'], delta },
      {
        type: 'armature.clone',
        barIds: ['original'],
        delta,
        ids: { original: 'call' },
      },
      {
        type: 'armature.clone',
        barIds: ['original'],
        delta,
        ids: { original: 'same', call: 'same' },
      },
      {
        type: 'armature.clone',
        barIds: ['original'],
        delta,
        ids: { missing: 'unused' },
      },
      { type: 'armature.clone', barIds: ['original'], delta: { x: NaN, y: 0 } },
    ];
    for (const command of invalid) {
      const r = executeRebarBatch(
        p,
        [
          {
            type: 'bar.update',
            id: 'original',
            patch: { kind: 'free', comment: 'not committed' },
          },
          command,
        ],
        { units: 'mm' },
      );
      expect(r.ok).toBe(false);
      expect(r.project).toBe(p);
      expect(r.issues[0].operationIndex).toBe(1);
    }
    expect(
      executeRebarBatch(
        p,
        [{ type: 'armature.clone', barIds: ['original'], delta }],
        { units: 'cm' } as never,
      ).issues[0].code,
    ).toBe('UNSUPPORTED_UNIT');
    const result = executeRebarBatch(
      p,
      [
        {
          type: 'armature.clone',
          barIds: ['original'],
          delta,
          ids: { original: 'copy' },
        },
        {
          type: 'bar.update',
          id: 'copy',
          patch: {
            kind: 'free',
            points: [
              { x: 0, y: 0 },
              { x: 0, y: 0 },
            ],
          },
        },
      ],
      { units: 'mm' },
    );
    expect(result.project).toBe(p);
    expect(result.issues[0].code).toBe('INVALID_GEOMETRY');
  });
  it('preserva desenhos de origem, oferece destino explícito e protege outros detalhes na edição isolada', () => {
    const base = createCloneSource();
    const added = createHierarchyNode(
      base,
      'detail',
      'Corte',
      base.hierarchy.elements[0].id,
    );
    const p = added.project;
    p.hierarchy.objectDetails['view-b'] = added.id;
    const q = run(p, [
      {
        type: 'armature.clone',
        barIds: ['original'],
        delta,
        ids: { 'view-b': 'copy-view' },
      },
    ]);
    expect(q.hierarchy.objectDetails['copy-view']).toBe(added.id);
    const r = executeRebarBatch(
      p,
      [{ type: 'armature.clone', barIds: ['original'], delta }],
      { units: 'mm', scopeDetailId: base.hierarchy.details[0].id },
    );
    expect(r.ok).toBe(false);
    expect(r.project).toBe(p);
    const allowed = executeRebarBatch(
      p,
      [
        {
          type: 'armature.clone',
          barIds: ['original'],
          delta,
          detailId: base.hierarchy.details[0].id,
        },
      ],
      { units: 'mm', scopeDetailId: base.hierarchy.details[0].id },
    );
    expect(allowed.ok).toBe(true);
    if (allowed.ok)
      for (const id of allowed.receipt.createdIds)
        expect(allowed.project.hierarchy.objectDetails[id]).toBe(
          base.hierarchy.details[0].id,
        );
    expect(
      executeRebarBatch(
        p,
        [
          {
            type: 'armature.clone',
            barIds: ['original'],
            delta,
            position: 'equivalent',
          },
        ],
        { units: 'mm', scopeDetailId: base.hierarchy.details[0].id },
      ).ok,
    ).toBe(false);
  });
  it('vínculos são explícitos, validados, persistidos e removidos sem órfãos', () => {
    const p = sharedSource();
    const q = run(p, [
      { type: 'armature.bind', objectIds: ['call', 'aux'], barIds: ['other'] },
    ]);
    expect(q.annotations[0].barIds).toEqual(['other']);
    expect(
      executeRebarBatch(p, [{ type: 'bar.delete', id: 'other' }], {
        units: 'mm',
      }).issues[0].code,
    ).toBe('REFERENCE_IN_USE');
    const deleted = run(q, [
      { type: 'bar.delete', id: 'other', references: 'remove' },
    ]);
    expect(deleted.polylines).toHaveLength(0);
    expect(deleted.annotations[0].barIds).toEqual([]);
    expect(decodeProject(JSON.stringify(deleted))).toEqual(deleted);
    expect(
      executeRebarBatch(
        p,
        [{ type: 'armature.bind', objectIds: ['aux'], barIds: ['missing'] }],
        { units: 'mm' },
      ).ok,
    ).toBe(false);
    expect(
      executeRebarBatch(
        p,
        [{ type: 'armature.bind', objectIds: ['original'], barIds: [] }],
        { units: 'mm' },
      ).ok,
    ).toBe(false);
    const legacy = structuredClone(p);
    legacy.schema = 'armadurastruct/12' as never;
    expect(() => decodeProject(JSON.stringify(legacy))).toThrow(/13/);
    legacy.polylines.forEach((o) => delete o.barIds);
    expect(decodeProject(JSON.stringify(legacy)).schema).toBe(
      'armadurastruct/24',
    );
    const orphan = structuredClone(p);
    orphan.polylines[0].barIds = ['absent'];
    expect(() => decodeProject(JSON.stringify(orphan))).toThrow();
  });
  it('pacote v7 remapeia auxiliares compartilhados e aponta referências externas na atualização seletiva', () => {
    const p = sharedSource();
    const added = createHierarchyNode(
      p,
      'detail',
      'Outro',
      p.hierarchy.elements[0].id,
    );
    const source = added.project;
    source.hierarchy.objectDetails.other = added.id;
    const pack = createDetailPackage(source, source.hierarchy.details[0].id, {
      unit: 'cm',
      producer: { app: 'AS53', version: '1' },
    });
    expect(pack.schema).toBe('openstruct.detail/15');
    expect(pack.dependencies.map((b) => b.id)).toEqual(['other']);
    const imported = readDetailPackage(pack).project;
    expect(imported.polylines[0].barIds).toEqual(['original', 'other']);
    expect(imported.polylines[0].points).toEqual(source.polylines[0].points);
    const target = createCloneSource();
    const options = {
      mode: 'insert' as const,
      sourceDetailId: source.hierarchy.details[0].id,
      targetElementId: target.hierarchy.elements[0].id,
    };
    const pending = previewDetailTransfer(target, imported, options);
    expect(
      pending.references.some((r) => r.kind === 'polyline' && !r.resolved),
    ).toBe(true);
    const references = Object.fromEntries(
      pending.references
        .filter((r) => !r.resolved)
        .map((r) => [r.key, 'detach' as const]),
    );
    const plan = previewDetailTransfer(target, imported, {
      ...options,
      references,
    });
    expect(plan.issues).toEqual([]);
    const q = applyDetailTransfer(target, plan);
    const copied = q.polylines.find((o) => o.id !== 'aux')!;
    expect(copied.barIds).toHaveLength(1);
    expect(copied.barIds![0]).not.toBe('original');
    expect(q.bars).toHaveLength(2);
    expect(decodeProject(JSON.stringify(q))).toEqual(q);
  });
  it('RA bloqueada sinaliza mudança e pode ser invalidada pela API; exemplo gera variante independente', () => {
    const p = createCloneSource();
    p.scheduleLock = { at: 'locked', bars: structuredClone(p.bars) };
    const command: RebarCommand = {
      type: 'armature.clone',
      barIds: ['original'],
      delta,
    };
    const retained = executeRebarBatch(p, [command], { units: 'mm' });
    expect(retained.ok && retained.receipt.scheduleDirty).toBe(true);
    expect(retained.project.scheduleLock).toEqual(p.scheduleLock);
    expect(
      executeRebarBatch(p, [command], {
        units: 'mm',
        schedule: 'invalidate-lock',
      }).project.scheduleLock,
    ).toBeUndefined();
    const { project } = createArmatureCloneExample();
    expect(project.bars.map((b) => b.diameter)).toEqual([10, 12.5]);
    for (const o of [
      ...project.details,
      ...project.annotations,
      ...project.polylines,
    ].filter((o) => o.id.startsWith('variant')))
      expect(armatureReferences(o)).toEqual(['variant']);
  });
  it('conserva as versões anteriores de pacotes, sem aceitar vínculos v7 sob cabeçalho antigo', () => {
    const p = createCloneSource();
    delete p.polylines[0].barIds;
    const pack = createDetailPackage(p, p.hierarchy.details[0].id, {
      producer: { app: 'test', version: '1' },
    });
    for (const schema of ['openstruct.detail/6'] as const)
      expect(readDetailPackage({ ...pack, schema }).project.bars).toEqual(
        p.bars,
      );
    const old = structuredClone(pack);
    old.objects.details.forEach((o) => delete o.label);
    expect(
      readDetailPackage({ ...old, schema: 'openstruct.detail/5' }).project.bars,
    ).toEqual(p.bars);
    old.objects.details.forEach((o) => {
      delete o.label;
      delete o.rotation;
      delete o.scale;
      delete o.identification;
    });
    expect(
      readDetailPackage({ ...old, schema: 'openstruct.detail/4' }).project.bars,
    ).toEqual(p.bars);
    old.objects.polylines[0].barIds = ['original'];
    expect(() =>
      readDetailPackage({ ...old, schema: 'openstruct.detail/6' }),
    ).toThrow(/v7/);
  });
  it('copia máscara selecionada e dados de fabricação sem transformar dimensões ou aplicar novamente repetições', () => {
    let p = createCloneSource();
    p.hierarchy.details[0].repetition = {
      factor: 3,
      elements: [{ name: 'V1' }, { name: 'V2' }, { name: 'V3' }],
    };
    p.bars[0].manufacturing = {
      variant: 'Tipo A',
      start: { kind: 'coupler', code: 'LUVA A' },
      end: { kind: 'plain', code: '' },
    };
    p = completeOwnership({
      ...p,
      masks: [
        {
          id: 'mask',
          name: 'Referência',
          format: 'DEMO',
          layers: { CAD: true },
          opacity: 1,
          sourceUnit: 'mm',
          warnings: [],
          origin: { x: 10, y: 20 },
          rotation: 30,
          scale: 2,
          visible: true,
          primitives: [
            {
              points: [
                { x: 0, y: 0 },
                { x: 200, y: 100 },
              ],
              layer: 'CAD',
            },
          ],
        },
      ],
    });
    const { project: q, idMap } = cloneArmatureGraph(p, {
      barIds: ['original'],
      objectIds: ['mask'],
      delta,
    });
    expect(q.masks[1]).toMatchObject({
      id: idMap.mask,
      origin: { x: 3010, y: -180 },
      rotation: 30,
      scale: 2,
      primitives: p.masks[0].primitives,
    });
    expect(q.masks[1].primitives).not.toBe(p.masks[0].primitives);
    expect(q.bars[1].manufacturing).toEqual(p.bars[0].manufacturing);
    expect(q.bars[1].manufacturing).not.toBe(p.bars[0].manufacturing);
    expect(decodeProject(JSON.stringify(q))).toEqual(q);
    expect(
      run(p, [
        {
          type: 'armature.clone',
          barIds: ['original'],
          objectIds: ['mask'],
          delta,
        },
      ]).masks[1].origin,
    ).toEqual(q.masks[1].origin);
    const overflow = structuredClone(p);
    overflow.masks[0].origin.x = 1e308;
    const invalid = executeRebarBatch(
      overflow,
      [
        {
          type: 'armature.clone',
          barIds: [],
          objectIds: ['mask'],
          delta: { x: 1e308, y: 0 },
        },
      ],
      { units: 'mm' },
    );
    expect(invalid.project).toBe(overflow);
    expect(invalid.ok).toBe(false);
    expect(schedule(q).reduce((s, r) => s + r.quantity, 0)).toBe(48);
    expect(mass(q)).toBeCloseTo(2 * mass(p), 10);
  });
  it('atualização seletiva exige reassociar ou desvincular um auxiliar externo da posição removida', () => {
    const source = createCloneSource(),
      target = createCloneSource();
    const inserted = previewDetailTransfer(target, source, {
      mode: 'insert',
      sourceDetailId: source.hierarchy.details[0].id,
      targetElementId: target.hierarchy.elements[0].id,
    });
    const p = applyDetailTransfer(target, inserted);
    const importedId = inserted.bars[0].localId;
    p.polylines[0].barIds = ['original', importedId];
    const revision = completeOwnership({
      ...source,
      bars: [],
      details: [],
      annotations: [],
      polylines: [],
    });
    const options = {
      mode: 'replace' as const,
      sourceDetailId: source.hierarchy.details[0].id,
      targetDetailId: inserted.targetDetailId!,
    };
    const pending = previewDetailTransfer(p, revision, options);
    const edge = pending.references.find(
      (r) => r.kind === 'polyline' && r.side === 'existing',
    );
    expect(edge?.resolved).toBe(false);
    const plan = previewDetailTransfer(p, revision, {
      ...options,
      references: { [edge!.key]: 'detach' },
    });
    expect(plan.issues).toEqual([]);
    const q = applyDetailTransfer(p, plan);
    expect(q.polylines[0].barIds).toEqual(['original']);
    expect(decodeProject(JSON.stringify(q))).toEqual(q);
  });
});
