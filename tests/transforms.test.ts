import { describe, expect, it } from 'vitest';
import {
  transformSelection,
  transformPoint,
  angleByPoints,
  selectionTransformIds,
  type SelectionTransform,
} from '../src/domain/transforms';
import {
  emptyProject,
  newBar,
  schedule,
  decodeProject,
  createScheduleLock,
} from '../src/domain/model';
import {
  completeOwnership,
  createHierarchyNode,
  moveObjectsToDetail,
} from '../src/domain/hierarchy';
import { geometry, sampled, world, distance } from '../src/domain/geometry';
import { representationPoints } from '../src/domain/representations';
import { annotationPrimitives } from '../src/domain/drafting';
import { executeRebarBatch } from '../src/domain/rebarApi';
import {
  createDetailPackage,
  readDetailPackage,
} from '../src/domain/detailPackage';
import { hideObjects } from '../src/domain/visibility';
import { setLayerState } from '../src/domain/layerProfiles';
import { parseDxf } from '../src/cad/import';
import { toDxf, toSheetPdf } from '../src/lib/exports';
import { maskPrimitives } from '../src/cad/import';
import { placeDrawing } from '../src/domain/sheets';
import { alignPlacement } from '../src/domain/paper';
function fixture() {
  return completeOwnership({
    ...emptyProject(),
    bars: [
      {
        ...newBar('N1'),
        id: 'a',
        origin: { x: 400, y: 200 },
        rotation: 23,
        quantity: 8,
        distribution: { start: { x: 400, y: 200 }, end: { x: 1400, y: 500 } },
      },
      {
        ...newBar('N2'),
        id: 'b',
        kind: 'stirrup',
        width: 300,
        height: 500,
        origin: { x: 1800, y: 900 },
      },
    ],
    details: [
      {
        id: 'r',
        barId: 'a',
        origin: { x: 0, y: -1000 },
        rotation: 16,
        scale: 2,
        label: { origin: { x: 200, y: -100 }, rotation: 15, height: 40 },
      },
    ],
    annotations: [
      {
        id: 'call',
        kind: 'leader',
        barId: 'a',
        points: [
          { x: 400, y: 200 },
          { x: 200, y: -100 },
          { x: 1000, y: -100 },
        ],
        label: '',
        textHeight: 40,
        color: '#888888',
      },
      {
        id: 'dim',
        kind: 'dimension-orthogonal',
        points: [
          { x: 0, y: 0 },
          { x: 1200, y: 300 },
          { x: 500, y: 600 },
        ],
        label: '',
        textHeight: 40,
        color: '#888888',
      },
    ],
    polylines: [
      {
        id: 'line',
        barIds: ['a'],
        points: [
          { x: 400, y: 200 },
          { x: 800, y: 800 },
        ],
        closed: false,
        color: '#777777',
      },
    ],
  });
}
const base = { x: -400, y: 800 };
const turn: SelectionTransform = { kind: 'rotate', base, angle: 37 };
const mirror: SelectionTransform = {
  kind: 'mirror',
  base,
  axisEnd: { x: 500, y: 1300 },
};
const weight = (p: ReturnType<typeof fixture>) =>
  schedule(p).reduce((s, r) => s + r.weight, 0);
const close = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  expect(a.x).toBeCloseTo(b.x, 7);
  expect(a.y).toBeCloseTo(b.y, 7);
};
describe('AS-24 · transformação rígida da seleção', () => {
  it('37° por uma base comum conserva distâncias entre objetos, comprimento, aço, IDs e faixas', () => {
    const p = fixture(),
      before = JSON.stringify(p),
      q = transformSelection(p, ['a', 'b', 'r', 'dim'], turn);
    for (let i = 0; i < p.bars.length; i++) {
      close(q.bars[i].origin, transformPoint(p.bars[i].origin, turn));
      const old = sampled(geometry(p.bars[i]).segments).map((v) =>
        world(v, p.bars[i]),
      );
      const fresh = sampled(geometry(q.bars[i]).segments).map((v) =>
        world(v, q.bars[i]),
      );
      old.forEach((v, j) => close(fresh[j], transformPoint(v, turn)));
      expect(geometry(q.bars[i]).length).toBeCloseTo(
        geometry(p.bars[i]).length,
        8,
      );
      expect(q.bars[i].id).toBe(p.bars[i].id);
    }
    close(
      q.bars[0].distribution!.end,
      transformPoint(p.bars[0].distribution!.end, turn),
    );
    close(
      q.bars[0].distribution!.start!,
      transformPoint(p.bars[0].distribution!.start!, turn),
    );
    expect(distance(q.bars[0].origin, q.bars[1].origin)).toBeCloseTo(
      distance(p.bars[0].origin, p.bars[1].origin),
      8,
    );
    expect(weight(q)).toBeCloseTo(weight(p), 10);
    expect(JSON.stringify(p)).toBe(before);
    expect(q.annotations.find((a) => a.id === 'call')?.points).not.toEqual(
      p.annotations[0].points,
    );
    expect(q.polylines[0].points).not.toEqual(p.polylines[0].points);
  });
  it.each([turn, mirror])(
    'transforma cota ortogonal junto com o referencial sem mudar a medida (%j)',
    (t) => {
      const p = fixture(),
        q = transformSelection(p, ['dim'], t);
      const a = annotationPrimitives(p.annotations[1], p),
        b = annotationPrimitives(q.annotations[1], q);
      expect(b.find((v) => v.text)?.text).toBe(a.find((v) => v.text)?.text);
      expect(b.filter((v) => !v.text).flatMap((v) => v.points).length).toBe(
        a.filter((v) => !v.text).flatMap((v) => v.points).length,
      );
      expect(decodeProject(JSON.stringify(q)).annotations[1]).toEqual(
        q.annotations[1],
      );
    },
  );
  it('cota no empate de orientação mantém o eixo após rotação com ponto flutuante', () => {
    const p = fixture();
    p.annotations[1].points[2] = { x: 1100, y: 650 };
    const before = annotationPrimitives(p.annotations[1], p).find(
      (v) => v.text,
    )?.text;
    for (const angle of [17, 37, 91, 213]) {
      const q = transformSelection(p, ['dim'], { kind: 'rotate', base, angle });
      expect(
        annotationPrimitives(q.annotations[1], q).find((v) => v.text)?.text,
      ).toBe(before);
    }
  });
  it('espelha estribo com ganchos sem converter família e duas reflexões recuperam a geometria', () => {
    const p = fixture(),
      q = transformSelection(p, ['a', 'b'], mirror),
      r = transformSelection(q, ['a', 'b'], mirror);
    expect(q.bars[1].kind).toBe('stirrup');
    expect(q.bars[1].stirrupMirrored).toBe(true);
    expect(q.bars[1].width).toBe(p.bars[1].width);
    expect(q.bars[1].hook).toBe(p.bars[1].hook);
    for (let i = 0; i < p.bars.length; i++) {
      const a = sampled(geometry(p.bars[i]).segments).map((v) =>
        world(v, p.bars[i]),
      );
      const b = sampled(geometry(q.bars[i]).segments).map((v) =>
        world(v, q.bars[i]),
      );
      const c = sampled(geometry(r.bars[i]).segments).map((v) =>
        world(v, r.bars[i]),
      );
      a.forEach((v, j) => {
        close(b[j], transformPoint(v, mirror));
        close(c[j], v);
      });
    }
    expect(weight(q)).toBeCloseTo(weight(p), 9);
  });
  it('uma inserção pode espelhar sem modificar a peça; peça e inserção selecionadas recebem o movimento uma vez', () => {
    const p = fixture();
    for (const ids of [['r'], ['a', 'r']]) {
      const q = transformSelection(p, ids, mirror);
      const old = representationPoints(p.bars[0], p.details[0]),
        fresh = representationPoints(q.bars[0], q.details[0]);
      old.forEach((v, j) => close(fresh[j], transformPoint(v, mirror)));
      expect(weight(q)).toBeCloseTo(weight(p), 9);
      expect(q.details[0].scale).toBe(2);
      expect(q.details[0].barId).toBe('a');
    }
    expect(transformSelection(p, ['r'], mirror).bars).toEqual(p.bars);
  });
  it('auxiliares próprios seguem a seleção uma vez; compartilhados exigem seleção explícita', () => {
    let p = fixture();
    p = completeOwnership({
      ...p,
      polylines: [
        ...p.polylines,
        { ...p.polylines[0], id: 'shared', barIds: ['a', 'b'] },
      ],
    });
    expect(selectionTransformIds(p, ['a']).shared).toEqual(['shared']);
    const q = transformSelection(p, ['a', 'call'], turn);
    close(
      q.annotations[0].points[0],
      transformPoint(p.annotations[0].points[0], turn),
    );
    expect(q.polylines[1]).toBe(p.polylines[1]);
    expect(
      transformSelection(p, ['a'], turn, { associated: false }).annotations,
    ).toEqual(p.annotations);
  });
  it('ângulo por pontos é orientado, aceita quadrantes e recusa direção/eixo nulos sem mutação', () => {
    expect(
      angleByPoints(
        base,
        { x: base.x + 100, y: base.y },
        { x: base.x, y: base.y + 100 },
      ),
    ).toBeCloseTo(90);
    expect(
      angleByPoints(
        base,
        { x: base.x + 100, y: base.y },
        { x: base.x, y: base.y - 100 },
      ),
    ).toBeCloseTo(-90);
    const p = fixture(),
      before = JSON.stringify(p);
    expect(() => angleByPoints(base, base, { x: 0, y: 0 })).toThrow();
    expect(() =>
      transformSelection(p, ['a'], { ...mirror, axisEnd: base }),
    ).toThrow();
    expect(() => transformSelection(p, ['missing'], turn)).toThrow();
    expect(() =>
      transformSelection(p, ['a'], { ...turn, angle: NaN }),
    ).toThrow();
    expect(JSON.stringify(p)).toBe(before);
  });
  it('API aplica todo o conjunto atomicamente e respeita layer, ocultação e edição isolada', () => {
    const p = fixture();
    const commands = [
      {
        type: 'selection.transform' as const,
        ids: ['a', 'r'],
        transform: turn,
      },
    ];
    const ok = executeRebarBatch(p, commands, { units: 'mm' });
    expect(ok.ok).toBe(true);
    const bad = executeRebarBatch(
      p,
      [...commands, { ...commands[0], ids: ['missing'] }],
      { units: 'mm' },
    );
    expect(bad.ok).toBe(false);
    expect(bad.project).toBe(p);
    const hidden = hideObjects(p, 'model', ['a']);
    expect(executeRebarBatch(hidden, commands, { units: 'mm' }).ok).toBe(false);
    const locked = setLayerState(p, 'model', 'layer:ARMADURAS', {
      editable: false,
    });
    expect(executeRebarBatch(locked, commands, { units: 'mm' }).ok).toBe(false);
    p.scheduleLock = createScheduleLock(p);
    const rotated = executeRebarBatch(p, commands, { units: 'mm' });
    expect(rotated.ok).toBe(true);
    expect(weight(rotated.project)).toBeCloseTo(weight(p), 9);
  });
  it('auxiliar de outro detalhamento permanece protegido na edição isolada', () => {
    const p = fixture();
    const made = createHierarchyNode(
      p,
      'detail',
      'Outro desenho',
      p.hierarchy.elements[0].id,
    );
    const project = moveObjectsToDetail(made.project, ['call'], made.id);
    const scope = project.hierarchy.objectDetails.a;
    expect(selectionTransformIds(project, ['a']).shared).toEqual(['call']);
    const q = transformSelection(project, ['a'], turn, {
      scopeDetailId: scope,
    });
    expect(q.annotations[0]).toBe(project.annotations[0]);
    expect(() =>
      transformSelection(project, ['a', 'call'], turn, {
        scopeDetailId: scope,
      }),
    ).toThrow();
  });
  it('máscaras giram/espelham pelo mesmo ponto e preservam estilos, texto e coordenadas no DXF', () => {
    const p = fixture(),
      mask = parseDxf(toDxf(p), 'synthetic.dxf');
    const project = completeOwnership({ ...emptyProject(), masks: [mask] });
    for (const t of [turn, mirror]) {
      const q = transformSelection(project, [mask.id], t);
      const a = maskPrimitives(mask),
        b = maskPrimitives(q.masks[0]);
      a.forEach((v, i) =>
        v.points.forEach((pt, j) =>
          close(b[i].points[j], transformPoint(pt, t)),
        ),
      );
      expect(q.layers).toEqual(project.layers);
      expect(q.masks[0].layers).toEqual(mask.layers);
      expect(() => toDxf(q)).not.toThrow();
    }
  });
  it.each(['mm', 'cm', 'm'] as const)(
    'pacote v10 em %s e projeto v18 preservam espelhos, famílias, cotas e quantitativos',
    (unit) => {
      const p = fixture(),
        q = transformSelection(p, ['a', 'b', 'r', 'dim'], mirror);
      expect(decodeProject(JSON.stringify(q))).toEqual(q);
      const pack = createDetailPackage(q, q.hierarchy.details[0].id, {
        producer: { app: 'AS24', version: '1' },
        unit,
      });
      expect(pack.schema).toBe('openstruct.detail/15');
      const result = readDetailPackage(pack).project;
      expect(weight(result)).toBeCloseTo(weight(q), 9);
      expect(result.bars[1].stirrupMirrored).toBe(true);
      expect(result.details).toEqual(q.details);
      expect(() =>
        readDetailPackage({ ...pack, schema: 'openstruct.detail/9' }),
      ).toThrow(/v10/);
    },
  );
  it('rotação de desenho composto pode ser colocada em folha e exportada sem duplicar aço', () => {
    const p = transformSelection(fixture(), ['a', 'b', 'r', 'dim'], turn);
    const placed = placeDrawing(p, p.sheets[0].id, p.hierarchy.drawings[0].id);
    const q = alignPlacement(placed.project, placed.id);
    expect(weight(q)).toBe(weight(p));
    expect(toSheetPdf(q).length).toBeGreaterThan(1000);
  });
  it.each([1, 2, 17])(
    'migração de v%s não inventa espelhos nem altera aço',
    (version) => {
      const p = fixture(),
        q = decodeProject(
          JSON.stringify({
            ...p,
            schema: `armadurastruct/${version}`,
            polylines: p.polylines.map((l) => ({
              ...l,
              barIds: version < 13 ? undefined : l.barIds,
            })),
            details:
              version < 11
                ? []
                : p.details.map((d) => ({ ...d, label: undefined })),
          }),
        );
      expect(q.schema).toBe('armadurastruct/24');
      expect(q.bars).toEqual(p.bars);
      expect(weight(q)).toBe(weight(p));
    },
  );
});
