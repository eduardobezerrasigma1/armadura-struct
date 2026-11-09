import {
  initialExampleProject,
  INITIAL_EXAMPLE_SHEETS,
} from '../src/examples/initial';
import { initialReference } from '../src/examples/review';
import { describe, it, expect } from 'vitest';
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
import {
  createSheet,
  placeDrawing,
  duplicatePlacement,
  duplicateSheet,
  deleteSheet,
  updatePlacement,
  updateSheet,
} from '../src/domain/sheets';
import {
  defaultSheetSchedule,
  setSheetSchedule,
  sheetScheduleData,
  sheetScheduleGeometry,
} from '../src/domain/sheetSchedule';
import {
  composeSheet,
  alignPlacement,
  sheetScheduleIssues,
  paperPrimitiveBounds,
} from '../src/domain/paper';
import { toSheetPdf } from '../src/lib/exports';
import { groupFabrication } from '../src/domain/fabrication';
import { setDetailRepetition } from '../src/domain/detailRepetition';
import { hideObjects } from '../src/domain/visibility';
function fixture() {
  let p = completeOwnership({
    ...emptyProject(),
    name: 'Pranchas com relação do aço',
    bars: [
      { ...newBar('N1'), id: 'a', quantity: 4, diameter: 10 },
      { ...newBar('N2'), id: 'b', quantity: 3, diameter: 5, steel: 'CA-60' },
    ],
  });
  const made = createHierarchyNode(
    p,
    'detail',
    'Pilares',
    p.hierarchy.elements[0].id,
  );
  p = moveObjectsToDetail(made.project, ['b'], made.id);
  const second = createSheet(p, 'Pilares');
  p = second.project;
  const a = placeDrawing(
    p,
    p.sheets[0].id,
    p.hierarchy.drawings.find(
      (d) => d.detailId === p.hierarchy.objectDetails.a,
    )!.id,
  );
  p = a.project;
  const b = placeDrawing(
    p,
    second.id,
    p.hierarchy.drawings.find((d) => d.detailId === made.id)!.id,
  );
  p = b.project;
  for (const v of p.hierarchy.placements) {
    p = updatePlacement(p, v.id, {
      origin: { x: 160, y: 140 },
      scale: 50,
      frame: { width: 120, height: 70 },
    });
    p = alignPlacement(p, v.id);
  }
  return p;
}
const config = defaultSheetSchedule({ x: 20, y: 270 });
describe('quadro vetorial de aço por prancha', () => {
  it('exemplo real separa vigas e pilares e fecha as 64 posições/1181 peças sem contar as vistas duas vezes', async () => {
    const p = await initialExampleProject();
    const data = INITIAL_EXAMPLE_SHEETS.map((id) => sheetScheduleData(p, id));
    initialReference.sources.forEach((source, i) => {
      const expected = initialReference.positions.filter(
        (r) => r.sheetKey === source.key,
      );
      expect(new Set(data[i].barIds)).toEqual(
        new Set(expected.flatMap((r) => r.occurrences.map((o) => o.barId))),
      );
      expect(data[i].rows).toHaveLength(expected.length);
      expect(data[i].rows.reduce((s, r) => s + r.quantity, 0)).toBe(
        expected.reduce((s, r) => s + r.quantity, 0),
      );
    });
    expect(data.reduce((s, d) => s + d.rows.length, 0)).toBe(64);
    expect(
      data.flatMap((d) => d.rows).reduce((s, r) => s + r.quantity, 0),
    ).toBe(1181);
    expect(
      data.flatMap((d) => d.rows).reduce((s, r) => s + r.weight, 0),
    ).toBeCloseTo(
      schedule(p).reduce((s, r) => s + r.weight, 0),
      8,
    );
  });

  it('separa folhas e deduplica vistas/rebatimentos por ID físico, sem multiplicar o aço', () => {
    let p = fixture();
    p = duplicatePlacement(p, p.hierarchy.placements[0].id).project;
    const a = sheetScheduleData(p, p.sheets[0].id),
      b = sheetScheduleData(p, p.sheets[1].id);
    expect(a.barIds).toEqual(['a']);
    expect(a.rows[0].quantity).toBe(4);
    expect(b.barIds).toEqual(['b']);
    expect(b.rows[0].quantity).toBe(3);
    p = completeOwnership({
      ...p,
      details: [
        { id: 'rep1', barId: 'a', origin: { x: 0, y: 500 } },
        { id: 'rep2', barId: 'a', origin: { x: 0, y: 1000 } },
      ],
    });
    expect(sheetScheduleData(p, p.sheets[0].id).rows).toEqual(a.rows);
  });
  it('inclui uma peça exibida por inserção externa, mas chamadas sozinhas não trazem aço estrangeiro', () => {
    let p = fixture();
    p = completeOwnership({
      ...p,
      details: [{ id: 'r', barId: 'a', origin: { x: 0, y: 0 } }],
      annotations: [
        {
          id: 'call',
          kind: 'leader',
          barId: 'b',
          points: [
            { x: 0, y: 0 },
            { x: 50, y: 50 },
            { x: 100, y: 50 },
          ],
          textHeight: 40,
          label: '',
          color: '#888888',
        },
      ],
    });
    p = moveObjectsToDetail(p, ['r'], p.hierarchy.objectDetails.b);
    expect(sheetScheduleData(p, p.sheets[1].id).barIds.sort()).toEqual([
      'a',
      'b',
    ]);
    expect(sheetScheduleData(p, p.sheets[0].id).barIds).toEqual(['a']);
  });
  it('posição de fabricação compartilhada soma somente as contribuições da folha e preserva fatores/ocultos', () => {
    let p = fixture();
    p.bars[1] = {
      ...p.bars[0],
      id: 'b',
      mark: 'N2',
      quantity: 2,
      origin: { x: 1500, y: 0 },
    };
    p = groupFabrication(p, ['a', 'b'], 'a');
    p = setDetailRepetition(p, p.hierarchy.objectDetails.a, {
      factor: 3,
      elements: [],
    });
    p = hideObjects(p, `view:${p.hierarchy.placements[0].id}`, ['a']);
    expect(schedule(p)[0].quantity).toBe(14);
    expect(sheetScheduleData(p, p.sheets[0].id).rows[0].quantity).toBe(12);
    expect(sheetScheduleData(p, p.sheets[1].id).rows[0].quantity).toBe(2);
    expect(sheetScheduleData(p, p.sheets[1].id).rows[0].bar.id).toBe('b');
  });
  it('cm/m/kg e reserva de 10% têm valores analíticos e não alteram o aço físico', () => {
    const p = fixture(),
      before = JSON.stringify(p),
      t = sheetScheduleGeometry(p, p.sheets[0].id, config),
      r = t.data.rows[0];
    const mass = ((4 * Math.PI * 0.01 ** 2) / 4) * 7850;
    expect(r.unitLength).toBe(1);
    expect(r.totalLength).toBe(4);
    expect(r.weight).toBeCloseTo(mass, 10);
    const labels = t.lines.map((l) => l.text).filter(Boolean);
    expect(labels).toContain('100,0');
    expect(labels).toContain('400,0');
    expect(labels).toContain('4,0');
    expect(labels).toContain(
      (mass * 1.1).toLocaleString('pt-BR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    );
    expect(labels).toContain('PESO + 10%');
    expect(
      sheetScheduleGeometry(p, p.sheets[0].id, {
        ...config,
        allowancePercent: 0.5,
      }).lines.map((l) => l.text),
    ).toContain('PESO + 0,5%');
    expect(JSON.stringify(p)).toBe(before);
    const q = setSheetSchedule(p, p.sheets[0].id, config);
    expect(schedule(q)).toEqual(schedule(p));
    expect(
      sheetScheduleGeometry(q, q.sheets[0].id, {
        ...config,
        allowancePercent: 0,
      }).data.rows,
    ).toEqual(t.data.rows);
  });
  it('texto tem dimensões reais e o mesmo quadro/PDF vetorial ignora escalas das vistas', () => {
    let p = fixture();
    p = setSheetSchedule(p, p.sheets[0].id, config);
    const t = composeSheet(p, p.sheets[0].id).schedule!;
    const q = updatePlacement(p, p.hierarchy.placements[0].id, { scale: 100 });
    expect(composeSheet(q, q.sheets[0].id).schedule).toEqual(t);
    expect(
      t.lines.filter((l) => l.text).every((l) => l.textHeight === 2.5),
    ).toBe(true);
    const points = t.lines.flatMap(paperPrimitiveBounds);
    expect(Math.max(...points.map((v) => v.x))).toBeLessThanOrEqual(
      config.origin.x + t.width + 0.01,
    );
    expect(Math.min(...points.map((v) => v.y))).toBeGreaterThanOrEqual(
      config.origin.y - t.height - 0.01,
    );
    const pdf = new TextDecoder('latin1').decode(
      toSheetPdf(p, [p.sheets[0].id]),
    );
    expect(pdf).toContain('RESUMO DO');
    expect(pdf).toContain('C.TOTAL');
    expect(pdf).not.toContain('/Subtype /Image');
  });
  it('v19 persiste, duplica layout sem duplicar aço e migra 1/2/18 sem criar tabelas', () => {
    let p = fixture();
    p = setSheetSchedule(p, p.sheets[0].id, config);
    expect(decodeProject(JSON.stringify(p))).toEqual(p);
    const copy = duplicateSheet(p, p.sheets[0].id);
    expect(
      copy.project.sheets.find((s) => s.id === copy.id)!.steelSchedule,
    ).toEqual(config);
    expect(schedule(copy.project)).toEqual(schedule(p));
    const removed = deleteSheet(copy.project, copy.id);
    expect(schedule(removed)).toEqual(schedule(p));
    expect(() =>
      decodeProject(JSON.stringify({ ...p, schema: 'armadurastruct/18' })),
    ).toThrow(/19/);
    const old = fixture();
    for (const version of [1, 2, 18]) {
      const q = decodeProject(
        JSON.stringify({ ...old, schema: `armadurastruct/${version}` }),
      );
      expect(q.schema).toBe('armadurastruct/24');
      expect(q.sheets.every((s) => !s.steelSchedule)).toBe(true);
      expect(schedule(q).reduce((s, r) => s + r.quantity, 0)).toBe(7);
    }
  });
  it('crescimento, bordas/selo, texto inválido e RA desatualizada são apontados sem recorte silencioso', () => {
    let p = fixture();
    const sheet = p.sheets[0],
      table = sheetScheduleGeometry(p, sheet.id, config);
    expect(sheetScheduleIssues(sheet, table)).toEqual([]);
    expect(
      sheetScheduleIssues(
        sheet,
        sheetScheduleGeometry(p, sheet.id, {
          ...config,
          origin: { x: 400, y: 20 },
        }),
      ).map((i) => i.code),
    ).toContain('schedule-paper-overflow');
    expect(
      sheetScheduleIssues(
        sheet,
        sheetScheduleGeometry(p, sheet.id, {
          ...config,
          origin: { x: 260, y: 50 },
        }),
      ).map((i) => i.code),
    ).toContain('schedule-seal-overlap');
    p.scheduleLock = createScheduleLock(p);
    p = {
      ...p,
      bars: p.bars.map((b) => (b.id === 'a' ? { ...b, quantity: 8 } : b)),
    };
    expect(sheetScheduleData(p, sheet.id).rows[0].quantity).toBe(8);
    expect(
      sheetScheduleIssues(
        sheet,
        sheetScheduleGeometry(p, sheet.id, config),
      ).map((i) => i.code),
    ).toContain('schedule-stale');
    p = setSheetSchedule(p, sheet.id, config);
    expect(() => toSheetPdf(p, [sheet.id])).toThrow(/desatualizada/);
    expect(() =>
      setSheetSchedule(p, sheet.id, { ...config, textHeight: 0 }),
    ).toThrow();
    expect(() =>
      setSheetSchedule(p, sheet.id, { ...config, allowancePercent: -10 }),
    ).toThrow();
    expect(() => setSheetSchedule(p, 'missing', config)).toThrow(/inexistente/);
  });
  it('quadro vazio é persistente e passa a receber as armaduras ao colocar desenhos, sem cópias físicas', () => {
    const base = emptyProject(),
      p = setSheetSchedule(base, base.sheets[0].id, config),
      q = completeOwnership({ ...p, bars: [{ ...newBar('N1'), id: 'a' }] });
    expect(sheetScheduleData(q, q.sheets[0].id).rows).toHaveLength(0);
    const placed = placeDrawing(
      q,
      q.sheets[0].id,
      q.hierarchy.drawings[0].id,
    ).project;
    expect(
      sheetScheduleData(placed, placed.sheets[0].id).rows[0].quantity,
    ).toBe(1);
    expect(
      schedule(setSheetSchedule(placed, placed.sheets[0].id, undefined)),
    ).toEqual(schedule(placed));
  });
});
