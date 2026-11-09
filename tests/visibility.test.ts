import { describe, expect, it } from 'vitest';
import {
  emptyProject,
  newBar,
  decodeProject,
  schedule,
  createScheduleLock,
  scheduleChanged,
} from '../src/domain/model';
import {
  completeOwnership,
  createHierarchyNode,
  moveObjectsToDetail,
} from '../src/domain/hierarchy';
import {
  hideObjects,
  isolateObjects,
  endObjectIsolation,
  showAllObjects,
  restoreObjects,
  visibilityState,
  visibilityProjection,
  visibilityReasons,
  setVisibility,
  visibilityReview,
  canCaptureObject,
} from '../src/domain/visibility';
import {
  setLayerState,
  applyLayerProfile,
  saveLayerProfile,
} from '../src/domain/layerProfiles';
import {
  duplicatePlacement,
  duplicateSheet,
  placeDrawing,
  removePlacement,
  updatePlacement,
} from '../src/domain/sheets';
import { alignPlacement, composeSheet } from '../src/domain/paper';
import { drawingPrimitives } from '../src/domain/drawingPrimitives';
import { toSheetPdf, toDxf, toCsv } from '../src/lib/exports';
import {
  createDetailPackage,
  readDetailPackage,
} from '../src/domain/detailPackage';
import { executeRebarBatch } from '../src/domain/rebarApi';
import { parseDxf } from '../src/cad/import';
import { pruneVisibility } from '../src/domain/visibilitySchema';
import type { Project } from '../src/domain/types';
export function fixture() {
  let p = completeOwnership({
    ...emptyProject(),
    bars: [
      {
        ...newBar('N1'),
        id: 'a',
        points: [
          { x: 0, y: 0 },
          { x: 1000, y: 0 },
        ],
        quantity: 8,
      },
      {
        ...newBar('N2'),
        id: 'b',
        origin: { x: 0, y: 700 },
        layerId: 'layer:DESENHO',
      },
      {
        ...newBar('N3'),
        id: 'c',
        origin: { x: 0, y: 1400 },
        layerId: 'layer:DESENHO',
      },
    ],
    details: [{ id: 'r', barId: 'a', origin: { x: 0, y: -800 } }],
  });
  const first = placeDrawing(p, p.sheets[0].id, p.hierarchy.drawings[0].id);
  p = alignPlacement(
    updatePlacement(first.project, first.id, {
      scale: 50,
      origin: { x: 20, y: 80 },
      frame: { width: 160, height: 100 },
    }),
    first.id,
  );
  const second = duplicatePlacement(p, first.id);
  p = updatePlacement(second.project, second.id, { origin: { x: 220, y: 80 } });
  return { p, a: `view:${first.id}`, b: `view:${second.id}` };
}
const ids = (p: Project) => p.bars.map((b) => b.id);
const mass = (p: Project) => schedule(p).reduce((v, r) => v + r.weight, 0);
describe('AS-22 · visibilidade por objeto e contexto', () => {
  it('ocultar N1 em uma vista conserva outra vista, representação, IDs, peso e RA bloqueada', () => {
    const { p, a, b } = fixture();
    p.scheduleLock = createScheduleLock(p);
    const q = hideObjects(p, a, ['a']);
    expect(ids(visibilityProjection(q, a, 'visible'))).toEqual(['b', 'c']);
    expect(ids(visibilityProjection(q, b, 'visible'))).toEqual(['a', 'b', 'c']);
    expect(
      visibilityProjection(q, a, 'visible').details.map((r) => r.id),
    ).toEqual(['r']);
    expect(q.bars).toBe(p.bars);
    expect(mass(q)).toBe(mass(p));
    expect(scheduleChanged(q)).toBe(false);
    expect(decodeProject(JSON.stringify(q))).toEqual(q);
  });
  it('isolamento usa um filtro reversível, troca o conjunto e recupera exatamente as ocultações anteriores', () => {
    let { p, a } = fixture();
    p = hideObjects(p, a, ['a']);
    const before = visibilityState(p, a);
    p = isolateObjects(p, a, ['b']);
    expect(ids(visibilityProjection(p, a, 'visible'))).toEqual(['b']);
    p = isolateObjects(p, a, ['c']);
    expect(ids(visibilityProjection(p, a, 'visible'))).toEqual(['c']);
    p = endObjectIsolation(p, a);
    expect(visibilityState(p, a)).toEqual(before);
    expect(ids(visibilityProjection(p, a, 'visible'))).toEqual(['b', 'c']);
    expect(() => isolateObjects(p, a, [])).toThrow(/Selecione/);
  });
  it('recuperação seletiva e Exibir todos não ligam layers desligados ou mudam perfis', () => {
    let { p, a } = fixture();
    p = hideObjects(p, a, ['a', 'b']);
    p = setLayerState(p, a, 'layer:ARMADURAS', { visible: false });
    const states = p.layerEnvironment!.contexts[a].states;
    p = restoreObjects(p, a, ['a']);
    expect(visibilityReasons(p, a, 'a')).toEqual(['Layer desligado']);
    expect(ids(visibilityProjection(p, a, 'visible'))).toEqual(['c']);
    p = showAllObjects(p, a);
    expect(visibilityState(p, a).hiddenIds).toEqual([]);
    expect(p.layerEnvironment!.contexts[a].states).toBe(states);
    expect(ids(visibilityProjection(p, a, 'visible'))).toEqual(['b', 'c']);
  });
  it('recuperar um objeto fora do isolamento inclui apenas aquele ID e sair ainda conserva a ocultação anterior', () => {
    let { p, a } = fixture();
    p = isolateObjects(hideObjects(p, a, ['a']), a, ['b']);
    p = restoreObjects(p, a, ['c']);
    expect(ids(visibilityProjection(p, a, 'visible'))).toEqual(['b', 'c']);
    expect(visibilityState(endObjectIsolation(p, a), a).hiddenIds).toEqual([
      'a',
    ]);
  });
  it('alterar ou salvar perfil de layer preserva o estado independente dos objetos', () => {
    let { p, a } = fixture();
    p = setVisibility(hideObjects(p, a, ['a']), a, {
      showHidden: true,
      printHidden: true,
    });
    const before = visibilityState(p, a);
    p = applyLayerProfile(p, a, 'profile:1');
    expect(visibilityState(p, a)).toEqual(before);
    p = saveLayerProfile(p, a, 'Revisão AS22');
    expect(visibilityState(p, a)).toEqual(before);
  });
  it('captura/encaixes e API não editam objetos ocultos; revelar não habilita edição nem altera objetos', () => {
    let { p, a } = fixture();
    p = hideObjects(p, a, ['a']);
    expect(canCaptureObject(p, a, 'a')).toBe(false);
    expect(ids(visibilityProjection(p, a, 'capture'))).toEqual(['b', 'c']);
    const result = executeRebarBatch(
      p,
      [{ type: 'bar.update', id: 'a', patch: { kind: 'free', quantity: 99 } }],
      { units: 'mm', layerContext: a },
    );
    expect(result.ok).toBe(false);
    expect(result.project).toBe(p);
    expect(visibilityReview(p, a).bars[0]).toBe(p.bars[0]);
    expect(
      canCaptureObject(setVisibility(p, a, { showHidden: true }), a, 'a'),
    ).toBe(false);
  });
  it('PDF segue a vista e oferece incluir ocultos; realce nunca vaza para o PDF, DXF/CSV continuam completos', () => {
    let { p, a } = fixture();
    const original = p;
    const labelCount = (p: Project) =>
      (new TextDecoder('latin1').decode(toSheetPdf(p)).match(/N1/g) ?? [])
        .length;
    const before = labelCount(p);
    p = hideObjects(p, a, ['a', 'r']);
    expect(labelCount(p)).toBeLessThan(before);
    const page = composeSheet(p, p.sheets[0].id);
    expect(
      page.views[0].content.filter((l) => l.layerId === 'layer:ARMADURAS'),
    ).toHaveLength(0);
    const plain = toSheetPdf(p);
    p = setVisibility(p, a, { showHidden: true });
    expect(
      composeSheet(p, p.sheets[0].id, true).views[0].hidden.length,
    ).toBeGreaterThan(0);
    expect(composeSheet(p, p.sheets[0].id).views[0].hidden).toEqual([]);
    // Ignore PDF creation timestamps/identifiers; actual content and marks stay equal.
    expect(labelCount(p)).toBe(
      labelCount({
        ...p,
        layerEnvironment: {
          ...p.layerEnvironment!,
          contexts: {
            ...p.layerEnvironment!.contexts,
            [a]: {
              ...p.layerEnvironment!.contexts[a],
              visibility: { ...visibilityState(p, a), showHidden: false },
            },
          },
        },
      }),
    );
    p = setVisibility(p, a, { printHidden: true });
    expect(labelCount(p)).toBe(before);
    p = setLayerState(p, a, 'layer:ARMADURAS', { visible: false });
    expect(
      composeSheet(p, p.sheets[0].id).views[0].content.some(
        (l) => l.layerId === 'layer:ARMADURAS',
      ),
    ).toBe(false);
    expect(toDxf(p)).toBe(toDxf(original));
    expect(toCsv(p)).toBe(toCsv(original));
    expect(mass(p)).toBe(mass(original));
    expect(plain.length).toBeGreaterThan(500);
  });
  it('layers de origem e máscara desligada têm motivo próprio e não são ligados na recuperação', () => {
    const { p: original } = fixture();
    const mask = parseDxf(toDxf(original), 'referencia.dxf');
    let p = completeOwnership({
      ...emptyProject(),
      masks: [{ ...mask, visible: false }],
    });
    p = hideObjects(p, 'model', [mask.id]);
    p = restoreObjects(p, 'model', [mask.id]);
    expect(visibilityReasons(p, 'model', mask.id)).toContain(
      'Máscara desligada',
    );
    expect(
      drawingPrimitives(visibilityProjection(p, 'model', 'visible'), p),
    ).toEqual([]);
    expect(
      drawingPrimitives(visibilityReview(p, 'model'), p).length,
    ).toBeGreaterThan(0);
    expect(p.masks[0].visible).toBe(false);
    const partial = {
      ...p,
      masks: p.masks.map((m) => ({
        ...m,
        visible: true,
        layers: { ARMADURAS: false },
      })),
    };
    expect(
      visibilityReview(partial, 'model').masks[0].primitives.every(
        (q) => q.layer === 'ARMADURAS',
      ),
    ).toBe(true);
    expect(
      visibilityReview(partial, 'model').masks[0].primitives.length,
    ).toBeGreaterThan(0);
  });
  it('duplicar vista/folha copia o ambiente por valor e mantém as novas alterações independentes', () => {
    let { p, a } = fixture();
    p = hideObjects(p, a, ['a']);
    const copy = duplicatePlacement(p, a.slice(5));
    const key = `view:${copy.id}`;
    expect(visibilityState(copy.project, key).hiddenIds).toEqual(['a']);
    expect(
      visibilityState(restoreObjects(copy.project, key, ['a']), a).hiddenIds,
    ).toEqual(['a']);
    const sheet = duplicateSheet(p, p.sheets[0].id);
    const v = sheet.project.hierarchy.placements.find(
      (v) => v.sheetId === sheet.id,
    )!;
    expect(visibilityState(sheet.project, `view:${v.id}`).hiddenIds).toEqual([
      'a',
    ]);
    expect(mass(sheet.project)).toBe(mass(p));
  });
  it('excluir objetos/vistas limpa referências de apresentação; undo por snapshot recupera o ambiente', () => {
    let { p, a } = fixture();
    p = hideObjects(p, a, ['a']);
    const snapshot = JSON.stringify(p);
    const result = executeRebarBatch(
      p,
      [{ type: 'bar.delete', id: 'a', references: 'remove' }],
      {
        units: 'mm',
        layerContext: 'model',
      },
    );
    expect(result.ok).toBe(true);
    expect(visibilityState(result.project, a).hiddenIds).toEqual([]);
    expect(
      pruneVisibility(removePlacement(p, a.slice(5))).layerEnvironment
        ?.contexts[a].visibility,
    ).toBeUndefined();
    expect(visibilityState(decodeProject(snapshot), a).hiddenIds).toEqual([
      'a',
    ]);
  });
  it('contextos de desenho/modelo não propagam ocultação às instâncias de folha nem ao pacote físico', () => {
    let { p, a } = fixture();
    const key = `drawing:${p.hierarchy.drawings[0].id}`;
    p = hideObjects(p, key, ['a']);
    p = hideObjects(p, 'model', ['b']);
    expect(ids(visibilityProjection(p, a, 'visible'))).toEqual(['a', 'b', 'c']);
    const pack = createDetailPackage(p, p.hierarchy.details[0].id, {
      producer: { app: 'AS22', version: '1' },
    });
    const q = readDetailPackage(pack).project;
    expect(q.layerEnvironment).toBeUndefined();
    expect(mass(q)).toBe(mass(p));
  });
  it.each([1, 2, 16])(
    'migra versão %s preservando os objetos, relações e quantitativos',
    (version) => {
      const { p } = fixture();
      const q = decodeProject(
        JSON.stringify({
          ...p,
          schema: `armadurastruct/${version}`,
          details: version < 11 ? [] : p.details,
        }),
      );
      expect(q.schema).toBe('armadurastruct/24');
      expect(q.bars).toEqual(p.bars);
      expect(mass(q)).toBe(mass(p));
      expect(visibilityState(q, 'model').hiddenIds).toEqual([]);
    },
  );
  it('distribuição acima do limite gráfico informa falha de realce sem quebrar a folha ou seu PDF', () => {
    let { p, a } = fixture();
    p = {
      ...p,
      bars: p.bars.map((b) =>
        b.id === 'a'
          ? {
              ...b,
              quantity: 2001,
              quantitySource: {
                kind: 'distribution' as const,
                mode: 'quantity' as const,
              },
              distribution: {
                end: { x: 20000, y: 0 },
                render: 'bars' as const,
              },
            }
          : b,
      ),
    };
    p = setVisibility(hideObjects(p, a, ['a']), a, { showHidden: true });
    const page = composeSheet(p, p.sheets[0].id, true);
    expect(page.views[0].hidden).toEqual([]);
    expect(page.views[0].reviewIssue).toMatch(/2000/);
    expect(page.views[0].content.length).toBeGreaterThan(0);
  });
  it('valida IDs/contextos e recusa metadados novos rotulados v16; move de proprietário limpa só a referência antiga', () => {
    let { p, a } = fixture();
    expect(() => hideObjects(p, 'sheet:missing', ['a'])).toThrow();
    expect(() => hideObjects(p, a, ['missing'])).toThrow();
    p = hideObjects(p, a, ['a']);
    expect(() =>
      decodeProject(JSON.stringify({ ...p, schema: 'armadurastruct/16' })),
    ).toThrow(/17/);
    const raw = structuredClone(p);
    raw.layerEnvironment!.contexts[a].visibility!.hiddenIds = ['a', 'a'];
    expect(() => decodeProject(JSON.stringify(raw))).toThrow();
    const made = createHierarchyNode(
      p,
      'detail',
      'Outro',
      p.hierarchy.elements[0].id,
    );
    const moved = pruneVisibility(
      moveObjectsToDetail(made.project, ['a'], made.id),
    );
    expect(visibilityState(moved, a).hiddenIds).toEqual([]);
  });
});
