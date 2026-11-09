import { describe, expect, it } from 'vitest';
import { jsPDF } from 'jspdf';
import {
  decodeProject,
  demoProject,
  emptyProject,
  newBar,
  schedule,
} from '../src/domain/model';
import { completeOwnership } from '../src/domain/hierarchy';
import {
  duplicatePlacement,
  placeDrawing,
  updatePlacement,
  updateSheet,
} from '../src/domain/sheets';
import {
  alignPlacement,
  composeSheet,
  fitPlacement,
  modelToPaper,
  paperPrimitiveBounds,
  paperTextWidth,
} from '../src/domain/paper';
import { toSheetPdf } from '../src/lib/exports';
import { sheetSize } from '../src/domain/paperFormat';

function fixture() {
  let p = emptyProject();
  p.name = 'Escalas de armadura';
  p.author = 'OpenStruct';
  p = completeOwnership({ ...p, bars: [{ ...newBar('N1'), quantity: 3 }] });
  const first = placeDrawing(p, p.sheets[0].id, p.hierarchy.drawings[0].id);
  p = first.project;
  p = updatePlacement(p, first.id, {
    origin: { x: 30, y: 90 },
    scale: 50,
    frame: { width: 160, height: 80 },
  });
  p = alignPlacement(p, first.id);
  const second = duplicatePlacement(p, first.id);
  p = second.project;
  p = updatePlacement(p, second.id, { origin: { x: 225, y: 90 }, scale: 100 });
  p = alignPlacement(p, second.id);
  return { p, first: first.id, second: second.id, sheetId: p.sheets[0].id };
}
const raw = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes);
const pdfLines = (value: string) =>
  [...value.matchAll(/([-\d.]+) ([-\d.]+) m\s+([-\d.]+) ([-\d.]+) l/g)].map(
    (m) =>
      (Math.hypot(Number(m[3]) - Number(m[1]), Number(m[4]) - Number(m[2])) *
        25.4) /
      72,
  );

describe('physical model to paper composition', () => {
  it('reports an existing source export limit without crashing the sheet editor or losing steel', () => {
    const { p, sheetId } = fixture();
    const large = {
      ...p,
      bars: [
        {
          ...p.bars[0],
          quantity: 2001,
          distribution: { end: { x: 5000, y: 0 }, render: 'bars' as const },
        },
      ],
    };
    const page = composeSheet(large, sheetId);
    expect(
      page.issues.some(
        (i) => i.code === 'source-error' && i.message.includes('2000'),
      ),
    ).toBe(true);
    expect(() => toSheetPdf(large)).toThrow(/2000/);
    expect(large.bars[0].quantity).toBe(2001);
    expect(() =>
      updateSheet(p, sheetId, {
        seal: { enabled: false, width: 6000, height: 20 },
      }),
    ).toThrow(/inválidas/);
  });
  it('keeps empty drawing instances editable and permits recovering a small custom sheet without losing content', () => {
    let p = emptyProject();
    const empty = placeDrawing(p, p.sheets[0].id, p.hierarchy.drawings[0].id);
    expect(composeSheet(empty.project, p.sheets[0].id).issues).toEqual([]);
    p = updateSheet(p, p.sheets[0].id, {
      format: 'custom',
      customSize: { width: 50, height: 50 },
      seal: { enabled: false, width: 20, height: 10 },
    });
    p = completeOwnership({ ...p, bars: [newBar('N1')] });
    const placed = placeDrawing(p, p.sheets[0].id, p.hierarchy.drawings[0].id);
    expect(placed.project.bars).toBe(p.bars);
    expect(
      composeSheet(placed.project, p.sheets[0].id).issues.some(
        (i) => i.code === 'view-overflow',
      ),
    ).toBe(true);
    let recovered = updateSheet(placed.project, p.sheets[0].id, {
      format: 'A3',
    });
    recovered = updatePlacement(recovered, placed.id, {
      frame: { width: 160, height: 100 },
    });
    recovered = fitPlacement(recovered, placed.id);
    expect(composeSheet(recovered, p.sheets[0].id).issues).toEqual([]);
  });

  it('rejects incomplete schema-5 composition and malformed custom dimensions instead of silently migrating it', () => {
    for (const fault of [
      'modelOrigin',
      'textHeight',
      'title',
      'margins',
      'customSize',
      'seal',
    ]) {
      const { p } = fixture(),
        raw = JSON.parse(JSON.stringify(p));
      if (['modelOrigin', 'textHeight', 'title'].includes(fault))
        delete raw.hierarchy.placements[0][fault];
      else delete raw.sheets[0][fault];
      expect(() => decodeProject(JSON.stringify(raw))).toThrow(
        /composição incompleta/,
      );
    }
  });
  it('prints one 1000 mm source as exactly 20 mm and 10 mm in the same vector PDF, without changing steel', () => {
    const { p, sheetId } = fixture(),
      before = structuredClone(p),
      quantities = schedule(p);
    const paper = composeSheet(p, sheetId);
    expect(paper.issues).toEqual([]);
    const lengths = paper.views.map((v) => {
      const line = v.content.find((l) => l.layer === 'ARMADURAS')!;
      return Math.hypot(
        line.points[1].x - line.points[0].x,
        line.points[1].y - line.points[0].y,
      );
    });
    expect(lengths[0]).toBeCloseTo(20, 10);
    expect(lengths[1]).toBeCloseTo(10, 10);
    const pdf = raw(toSheetPdf(p)),
      printed = pdfLines(pdf);
    expect(printed.some((n) => Math.abs(n - 20) < 1e-7)).toBe(true);
    expect(printed.some((n) => Math.abs(n - 10) < 1e-7)).toBe(true);
    expect(pdf).toContain('Escala 1:50');
    expect(pdf).toContain('Escala 1:100');
    expect(pdf).not.toContain('/Subtype /Image');
    expect(pdf.match(/\/Type \/Page\b/g)).toHaveLength(1);
    expect(schedule(p)).toEqual(quantities);
    expect(p).toEqual(before);
  });

  it('uses the same anchor and rotation in paper geometry and PDF, including text bounds', () => {
    const { p, first, sheetId } = fixture();
    let next = updatePlacement(p, first, {
      origin: { x: 130, y: 120 },
      rotation: 37,
      frame: { width: 110, height: 75 },
      modelOrigin: { x: 0, y: 0 },
    });
    next = alignPlacement(next, first);
    const v = next.hierarchy.placements[0],
      anchor = modelToPaper(v.modelOrigin, v);
    expect(anchor).toEqual(v.origin);
    const page = composeSheet(next, sheetId);
    expect(page.issues).toEqual([]);
    const line = page.views[0].content.find((l) => l.layer === 'ARMADURAS')!;
    expect(
      (Math.atan2(
        line.points[1].y - line.points[0].y,
        line.points[1].x - line.points[0].x,
      ) *
        180) /
        Math.PI,
    ).toBeCloseTo(37, 9);
    expect(
      pdfLines(raw(toSheetPdf(next))).some((n) => Math.abs(n - 20) < 1e-7),
    ).toBe(true);
    expect(
      page.views[0].lines
        .filter((l) => l.text)
        .every((l) => paperPrimitiveBounds(l).length === 4),
    ).toBe(true);
  });

  it.each(['A0', 'A1', 'A2', 'A3', 'A4', 'custom'] as const)(
    'persists and exports correct MediaBox dimensions for %s in both orientations',
    (format) => {
      for (const orientation of ['portrait', 'landscape'] as const) {
        let p = emptyProject();
        p = updateSheet(p, p.sheets[0].id, {
          format,
          orientation,
          customSize: { width: 320, height: 650 },
        });
        const expected = sheetSize(p.sheets[0]),
          pdf = raw(toSheetPdf(p));
        const box = pdf.match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/)!;
        expect((Number(box[1]) * 25.4) / 72).toBeCloseTo(expected.width, 6);
        expect((Number(box[2]) * 25.4) / 72).toBeCloseTo(expected.height, 6);
        expect(decodeProject(JSON.stringify(p))).toEqual(p);
      }
    },
  );

  it('keeps view scales and physical geometry while changing A3 to A1, and rejects overflow when shrinking', () => {
    const { p, sheetId } = fixture();
    const big = updateSheet(p, sheetId, { format: 'A1' });
    expect(big.hierarchy.placements).toBe(p.hierarchy.placements);
    expect(composeSheet(big, sheetId).issues).toEqual([]);
    const small = updateSheet(big, sheetId, { format: 'A4' });
    expect(
      composeSheet(small, sheetId).issues.some(
        (i) => i.code === 'paper-overflow',
      ),
    ).toBe(true);
    expect(() => toSheetPdf(small)).toThrow(/área útil/);
    expect(small.bars).toBe(p.bars);
    expect(schedule(small)).toEqual(schedule(p));
  });

  it('validates viewport overflow, rotated useful-area bounds, seal collision and seal text before any PDF is returned', () => {
    const { p, first, sheetId } = fixture();
    const tooSmall = updatePlacement(p, first, {
      frame: { width: 20, height: 20 },
    });
    expect(
      composeSheet(tooSmall, sheetId).issues.some(
        (i) => i.code === 'view-overflow',
      ),
    ).toBe(true);
    expect(() => toSheetPdf(tooSmall)).toThrow(/quadro/);
    const collision = updatePlacement(p, first, { origin: { x: 260, y: 15 } });
    expect(
      composeSheet(collision, sheetId).issues.some(
        (i) => i.code === 'seal-overlap',
      ),
    ).toBe(true);
    expect(() => toSheetPdf(collision)).toThrow(/selo/);
    const rotated = updatePlacement(p, first, {
      origin: { x: 20, y: 100 },
      rotation: 90,
    });
    expect(
      composeSheet(rotated, sheetId).issues.some(
        (i) => i.code === 'paper-overflow',
      ),
    ).toBe(true);
    const tinySeal = updateSheet(p, sheetId, {
      seal: { enabled: true, width: 160, height: 8 },
    });
    expect(() => toSheetPdf(tinySeal)).toThrow(/textos do selo/);
    const overSeal = updateSheet(p, sheetId, {
      seal: { enabled: true, width: 1000, height: 400 },
    });
    expect(() => toSheetPdf(overSeal)).toThrow(/reserva do selo/);
  });

  it('keeps labels, dimension values, ticks and titles legible in paper units without rescaling physical endpoints', () => {
    const { p, first, sheetId } = fixture();
    const dimension = {
      id: 'dimension',
      kind: 'dimension-orthogonal' as const,
      points: [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { x: 500, y: 400 },
      ],
      label: '',
      textHeight: 40,
      color: '#777777',
    };
    let next = completeOwnership({ ...p, annotations: [dimension] });
    next = alignPlacement(next, first);
    const page = composeSheet(next, sheetId),
      view = page.views[0];
    expect(
      view.lines.filter((l) => l.text).every((l) => l.textHeight! >= 2.5),
    ).toBe(true);
    expect(
      view.lines.some((l) => l.layer === 'COTAS' && l.text === '100,0'),
    ).toBe(true);
    expect(
      view.lines.some(
        (l) => l.layer === 'TITULO_VISTA' && l.text?.includes('1:50'),
      ),
    ).toBe(true);
    expect(next.annotations).toEqual([dimension]);
    expect(next.bars).toBe(p.bars);
    // Low denominator views must not inherit the 40 mm model lettering size.
    const enlarged = updatePlacement(next, first, { scale: 1 });
    const lettering = composeSheet(enlarged, sheetId).views[0].lines.filter(
      (l) => l.text && l.layer !== 'TITULO_VISTA',
    );
    expect(lettering.every((l) => l.textHeight === 2.5)).toBe(true);
  });

  it('matches Helvetica advance metrics and rejects unsupported PDF glyphs rather than corrupting them', () => {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'normal');
    // jsPDF rounds standard-font widths and includes kerning in its estimator.
    for (const text of [
      'WWW iii 1000',
      'Armação N1 Ø 12,5',
      'Folha A0 - revisão 03',
    ])
      expect(
        Math.abs(paperTextWidth(text, 3) - doc.getStringUnitWidth(text) * 3),
      ).toBeLessThan(0.25);
    const p = emptyProject();
    p.name = 'Elemento 🔩';
    expect(() => toSheetPdf(p)).toThrow(/caracteres/);
  });

  it('migrates a real v4 fit preview into a fixed scale while retaining IDs, origins, frames, rotations, steel and old metadata', () => {
    const p = demoProject();
    const old = JSON.parse(JSON.stringify(p));
    old.schema = 'armadurastruct/4';
    for (const s of old.sheets) {
      delete s.customSize;
      delete s.margins;
      delete s.seal;
    }
    for (const v of old.hierarchy.placements) {
      delete v.modelOrigin;
      delete v.textHeight;
      delete v.title;
      v.scale = 2;
    }
    const migrated = decodeProject(JSON.stringify(old));
    expect(migrated.schema).toBe('armadurastruct/25');
    expect(migrated.hierarchy.placements[0]).toMatchObject({
      id: old.hierarchy.placements[0].id,
      origin: old.hierarchy.placements[0].origin,
      rotation: old.hierarchy.placements[0].rotation,
      frame: old.hierarchy.placements[0].frame,
      legacyScale: 2,
    });
    expect(migrated.bars).toEqual(p.bars);
    expect(migrated.details).toEqual(p.details);
    expect(schedule(migrated)).toEqual(schedule(p));
    expect(decodeProject(JSON.stringify(migrated))).toEqual(migrated);
  });

  it('allows only explicit fitting to choose another scale; stale RA and impossible paper dimensions remain protected', () => {
    const { p, first, sheetId } = fixture();
    const changed = updatePlacement(p, first, { scale: 1 });
    expect(() => toSheetPdf(changed)).toThrow(/quadro/);
    const fitted = fitPlacement(changed, first);
    expect(fitted.hierarchy.placements[0].scale).toBeGreaterThan(1);
    expect(fitted.bars).toBe(p.bars);
    const locked = {
      ...p,
      scheduleLock: { at: 'now', bars: structuredClone(p.bars) },
    };
    locked.bars = [{ ...p.bars[0], quantity: 10 }];
    expect(() => toSheetPdf(locked)).toThrow(/desatualizada/);
    expect(() =>
      updateSheet(p, sheetId, {
        margins: { left: 300, right: 300, top: 10, bottom: 10 },
      }),
    ).toThrow(/área útil/);
    expect(() =>
      updateSheet(p, sheetId, { customSize: { width: Infinity, height: 297 } }),
    ).toThrow(/inválidas/);
  });
});
