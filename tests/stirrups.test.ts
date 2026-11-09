import { describe, it, expect } from 'vitest';
import {
  criteriaBar,
  criteriaFromBar,
  withStirrupRange,
} from '../src/domain/stirrups';
import { defaultStirrupCriteria } from '../src/domain/stirrupSchema';
import { geometry, world, distance } from '../src/domain/geometry';
import {
  stirrupEnvelope,
  stirrupGeometry,
  stirrupPrimitives,
  displayedBarGeometry,
} from '../src/domain/stirrupGeometry';
import {
  distributionOrigins,
  distributionPrimitives,
  distributionStep,
} from '../src/domain/drafting';
import {
  emptyProject,
  newBar,
  decodeProject,
  schedule,
} from '../src/domain/model';
import { completeOwnership } from '../src/domain/hierarchy';
import {
  executeRebarBatch,
  applyRebarBatch,
  rebarDefinition,
} from '../src/domain/rebarApi';
import {
  createDetailPackage,
  readDetailPackage,
} from '../src/domain/detailPackage';
import { fabricationSignature } from '../src/domain/fabrication';
import { drawingPrimitives } from '../src/domain/drawingPrimitives';
import { representationPrimitives } from '../src/domain/representations';
import { toDxf, toPdf, toCsv } from '../src/lib/exports';
import { transformSelection } from '../src/domain/transforms';
const pt = (x: number, y: number) => ({ x, y });
const bare = () => {
  const c = defaultStirrupCriteria();
  c.profile.start.angle = 0;
  c.profile.end.angle = 0;
  return c;
};
const bar = (c = defaultStirrupCriteria()) =>
  criteriaBar(c, pt(100, 200), 'N2', 'stirrup');
const fixture = () =>
  completeOwnership({
    ...emptyProject(),
    bars: [{ ...newBar('N1'), id: 'old', quantity: 3 }],
  });

describe('Critérios e lançamento de estribos', () => {
  it('concreto e eixo distinguem cobrimento até face do aço; mandril arredonda eixo sem mudar envelope', () => {
    const c = bare();
    Object.assign(c, { width: 300, height: 500, diameter: 10, mandrel: 50 });
    Object.assign(c.profile, { reference: 'concrete', cover: 30 });
    const b = bar(c),
      g = geometry(b);
    expect(stirrupEnvelope(b)).toEqual({ width: 230, height: 430, inset: 35 });
    expect(g.errors).toEqual([]);
    expect(g.length).toBeCloseTo(
      2 * (230 + 430) - 8 * 30 + 2 * Math.PI * 30,
      9,
    );
    expect(g.segments.filter((s) => s.type === 'arc')).toHaveLength(4);
    expect(
      g.vertices.every(
        (p) =>
          p.x >= 35 - 1e-8 &&
          p.x <= 265 + 1e-8 &&
          p.y >= 35 - 1e-8 &&
          p.y <= 465 + 1e-8,
      ),
    ).toBe(true);
    expect(() => bar({ ...c, width: 60 })).toThrow(/cobrimento|insuficiente/);
  });
  it('ganchos independentes somam arco e trecho reto; multiplicador phi reage à bitola', () => {
    const c = bare();
    c.profile.start = { angle: 90, mode: 'diameters', length: 10, turn: 1 };
    c.profile.end = { angle: 180, mode: 'mm', length: 80, turn: -1 };
    const b = bar(c),
      r = (b.mandrel + b.diameter) / 2;
    expect(geometry(b).length - stirrupGeometry(b, true).length).toBeCloseTo(
      r * Math.PI * 1.5 + 10 * b.diameter + 80,
      9,
    );
    c.diameter = 10;
    const bigger = bar(c);
    expect(geometry(bigger).segments[0].type).toBe('line');
    expect(
      distance(geometry(bigger).segments[0].a, geometry(bigger).segments[0].b),
    ).toBeCloseTo(100);
    expect(criteriaFromBar(b).profile).toEqual(c.profile);
  });
  it('fechamento retangular com 135° usa canto e conserva o comprimento da geometria legada equivalente', () => {
    const c = defaultStirrupCriteria();
    Object.assign(c, { width: 230, height: 430, diameter: 10, mandrel: 50 });
    const b = bar(c),
      old = {
        ...newBar('N1'),
        kind: 'stirrup' as const,
        width: 230,
        height: 430,
        diameter: 10,
        mandrel: 50,
        hook: 100,
      };
    expect(geometry(b).length).toBeCloseTo(geometry(old).length, 9);
    expect(geometry(b).segments[0].a.x).toBeCloseTo(
      geometry(b).segments.at(-1)!.b.x,
      9,
    );
    expect(geometry(b).segments[0].a.y).toBeCloseTo(
      geometry(b).segments.at(-1)!.b.y,
      9,
    );
    expect(stirrupGeometry(b, true).segments[0].a).toEqual(
      pt(30 * Math.tan((3 * Math.PI) / 8), 0),
    );
  });
  it('circular é analítico, aberto ou fechado; orientação e visualização não alteram aço', () => {
    const c = bare();
    c.profile.shape = 'circle';
    c.width = 1000;
    c.rotation = 33;
    const b = bar(c),
      g = geometry(b);
    expect(g.length).toBeCloseTo(1000 * Math.PI, 10);
    expect(g.segments).toHaveLength(2);
    expect(g.segments.every((s) => s.type === 'arc' && s.radius === 500)).toBe(
      true,
    );
    c.profile.closed = false;
    c.profile.gapAngle = 60;
    expect(geometry(bar(c)).length).toBeCloseTo((500 * Math.PI * 5) / 3, 9);
    const hooked = bar({
      ...c,
      profile: {
        ...c.profile,
        start: { angle: 135, mode: 'mm', length: 80, turn: -1 },
      },
    });
    const hidden = {
      ...hooked,
      stirrupDisplay: {
        dimensions: false,
        identification: false,
        hooks: false,
      },
    };
    expect(geometry(hidden)).toEqual(geometry(hooked));
    expect(displayedBarGeometry(hidden)!.length).toBeLessThan(
      geometry(hidden).length,
    );
    expect(() => bar({ ...c, width: 10 })).toThrow(/Raio/);
    const prim = stirrupPrimitives(b);
    expect(prim[0].native?.kind).toBe('arc');
    expect(prim[0].points[0]).toEqual(world(pt(500, 0), b));
  });
  it('forma livre suporta fechamento, concavidade e recusa cruzamento/retorno/trecho curto sem alterar entrada', () => {
    const c = bare();
    c.profile.shape = 'free';
    c.profile.points = [
      pt(0, 0),
      pt(600, 0),
      pt(600, 400),
      pt(300, 200),
      pt(0, 400),
    ];
    const before = structuredClone(c),
      b = bar(c);
    expect(geometry(b).errors).toEqual([]);
    expect(c).toEqual(before);
    c.profile.points = [pt(0, 0), pt(300, 300), pt(0, 300), pt(300, 0)];
    expect(() => bar(c)).toThrow(/cruza/);
    c.profile.closed = false;
    c.profile.points = [pt(0, 0), pt(200, 0), pt(0, 0)];
    expect(() => bar(c)).toThrow(/180/);
    c.profile.points = [pt(0, 0), pt(2, 0), pt(2, 2)];
    expect(() => bar(c)).toThrow(/insuficiente/);
    c.profile.points = [pt(0, 0), pt(500, 0), pt(500, 300)];
    expect(geometry(bar(c)).errors).toEqual([]);
    c.profile.reference = 'concrete';
    expect(() => bar(c)).toThrow(/Forma livre/);
  });
  it.each([0, -1, NaN, Infinity])(
    'recusa valores inválidos %s sem criar geometria parcial',
    (n) => {
      expect(() => bar({ ...bare(), diameter: n })).toThrow();
      expect(() => bar({ ...bare(), spacing: n })).toThrow();
    },
  );
  it('espaçamento máximo e fixo usam comprimento real, afastamentos e posição gráfica independente', () => {
    const c = bare();
    Object.assign(c, { spacing: 200, startInset: 50, endInset: 75 });
    const b = bar(c);
    const max = withStirrupRange(b, c, pt(0, 0), pt(1100, 0), pt(400, -300));
    expect(max.quantity).toBe(6);
    expect(distributionStep(max)).toBe(195);
    expect(distributionOrigins(max)).toEqual(
      [50, 245, 440, 635, 830, 1025].map((x) => pt(x, 0)),
    );
    const fixed = withStirrupRange(
      b,
      { ...c, fit: 'fixed' },
      pt(0, 0),
      pt(1100, 0),
      pt(400, -300),
    );
    expect(fixed.quantity).toBe(5);
    expect(distributionOrigins(fixed).at(-1)).toEqual(pt(850, 0));
    expect(distributionStep(fixed)).toBe(200);
    expect(
      distributionPrimitives(fixed).some((p) =>
        p.text?.includes('5 N2 Ø6,3 c/20,0 cm'),
      ),
    ).toBe(true);
    expect(
      distributionPrimitives(fixed).find(
        (p) =>
          p.points.length === 2 &&
          p.points[0].x === 50 &&
          p.points[1].x === 850,
      )?.points,
    ).toEqual([pt(50, -300), pt(850, -300)]);
    const diag = withStirrupRange(
      b,
      { ...c, startInset: 0, endInset: 0, spacing: 1000 },
      pt(0, 0),
      pt(3000, 4000),
    );
    expect(diag.quantity).toBe(6);
    expect(distributionStep(diag)).toBe(1000);
    expect(() => withStirrupRange(b, c, pt(0, 0), pt(100, 0))).toThrow(/faixa/);
    expect(() =>
      withStirrupRange(b, { ...c, fit: 'fixed' }, pt(0, 0), pt(200, 0)),
    ).toThrow();
    expect(() => withStirrupRange(b, c, pt(0, 0), pt(NaN, 0))).toThrow(
      /finitos/,
    );
  });
  it('lote cria uma só posição, preserva aço anterior e legado, serializa perfil/faixa/defaults e valida pacote mm/cm/m', () => {
    const p = fixture(),
      old = schedule(p),
      oldCsv = toCsv(p),
      c = bare();
    c.profile.shape = 'circle';
    c.width = 1000;
    const b = withStirrupRange(bar(c), c, pt(0, 0), pt(1000, 0), pt(0, -250));
    const batch = executeRebarBatch(
      p,
      [
        {
          type: 'bar.create',
          id: b.id,
          detailId: p.hierarchy.details[0].id,
          definition: {
            ...rebarDefinition(b),
            quantitySource: { kind: 'manual' },
          },
        },
        {
          type: 'distribution.set',
          barId: b.id,
          distribution: b.distribution!,
          count: { mode: 'spacing', spacing: c.spacing, fit: c.fit },
        },
      ],
      { units: 'mm' },
    );
    const q = { ...applyRebarBatch(p, batch), stirrupDefaults: c };
    expect(q.bars).toHaveLength(2);
    expect(q.bars[0]).toEqual(p.bars[0]);
    expect(p.bars).toHaveLength(1);
    expect(schedule(q).find((r) => r.mark === 'N1')).toEqual(old[0]);
    expect(toCsv(p)).toBe(oldCsv);
    const reopened = decodeProject(JSON.stringify(q));
    expect(reopened).toEqual(q);
    for (const unit of ['mm', 'cm', 'm'] as const) {
      const pack = createDetailPackage(q, q.hierarchy.details[0].id, {
        unit,
        producer: { app: 'ArmaduraStruct', version: '0.4.0' },
      });
      const recovered = readDetailPackage(pack).project.bars.find(
        (b) => b.id === 'stirrup',
      )!;
      expect(recovered.stirrupProfile).toEqual(b.stirrupProfile);
      expect(geometry(recovered).length).toBeCloseTo(geometry(b).length, 8);
      expect(recovered.distribution).toEqual(b.distribution);
    }
    const legacy = decodeProject(
      JSON.stringify({ ...p, schema: 'armadurastruct/24' }),
    );
    expect(legacy.bars).toEqual(p.bars);
    expect(() =>
      decodeProject(JSON.stringify({ ...q, schema: 'armadurastruct/24' })),
    ).toThrow(/25/);
  });
  it('DXF guarda arcos reais e PDF/representações usam o mesmo perfil e comprimento analítico', () => {
    const c = bare();
    c.profile.shape = 'circle';
    c.width = 1000;
    const b = bar(c),
      p = completeOwnership({ ...emptyProject(), bars: [b] });
    const dxf = toDxf(p).replace(/\r/g, '');
    expect(dxf.match(/\nARC\n/g)).toHaveLength(2);
    expect(dxf).toContain('\n40\n500\n');
    expect(toPdf(p).byteLength).toBeGreaterThan(1000);
    expect(
      drawingPrimitives(p).filter((p) => p.native?.kind === 'arc'),
    ).toHaveLength(2);
    const repr = representationPrimitives(
      b,
      {
        id: 'r',
        barId: b.id,
        origin: pt(1000, 1000),
        rotation: 90,
        scale: 2,
        mirrored: true,
      },
      p,
    );
    const arc = repr.find((p) => p.native?.kind === 'arc')!.native!;
    expect(arc.kind === 'arc' && arc.radius).toBe(1000);
    expect(arc.kind === 'arc' && arc.sweepAngle).toBe(-180);
    expect(fabricationSignature(b)).toBe(
      fabricationSignature({
        ...b,
        origin: pt(-500, 40),
        rotation: 90,
        stirrupDisplay: {
          hooks: false,
          identification: false,
          dimensions: false,
        },
      }),
    );
    expect(fabricationSignature({ ...b, width: 1100 })).not.toBe(
      fabricationSignature(b),
    );
  });
  it('duplo reflexo restaura eixo/ganchos e espelha a faixa sem mudar comprimento/quantidade', () => {
    const c = bare();
    c.rotation = 37;
    const b = withStirrupRange(
      bar(c),
      c,
      pt(100, 200),
      pt(1400, 650),
      pt(800, 900),
    );
    const p = completeOwnership({ ...emptyProject(), bars: [b] }),
      t = { kind: 'mirror' as const, base: pt(0, 0), axisEnd: pt(100, 100) };
    const q = transformSelection(p, [b.id], t);
    expect(q.bars[0].distribution!.annotationOffset).toBeCloseTo(
      -b.distribution!.annotationOffset!,
    );
    expect(geometry(q.bars[0]).length).toBeCloseTo(geometry(b).length, 8);
    const r = transformSelection(q, [b.id], t).bars[0];
    expect(r.origin.x).toBeCloseTo(b.origin.x);
    expect(r.origin.y).toBeCloseTo(b.origin.y);
    expect(r.quantity).toBe(b.quantity);
    expect(geometry(r).segments).toEqual(geometry(b).segments);
  });
  it('espelhar pelo comando legado mantém novo perfil analítico, em vez de discretizar em vértices', () => {
    const c = bare();
    c.profile.shape = 'circle';
    const b = bar(c),
      p = completeOwnership({ ...emptyProject(), bars: [b] });
    const q = applyRebarBatch(
      p,
      executeRebarBatch(
        p,
        [{ type: 'bar.transform', id: b.id, operation: 'mirror' }],
        { units: 'mm' },
      ),
    );
    expect(q.bars[0].kind).toBe('stirrup');
    expect(q.bars[0].stirrupProfile).toEqual(b.stirrupProfile);
    expect(geometry(q.bars[0]).length).toBeCloseTo(geometry(b).length);
    expect(decodeProject(JSON.stringify(q)).bars).toEqual(q.bars);
  });
  it('cancelar uma prévia não muda arquivo/RA; API rejeita perfil inválido atomicamente', () => {
    const p = fixture(),
      before = JSON.stringify(p),
      b = bar();
    criteriaBar(defaultStirrupCriteria(), pt(0, 0), 'N2', 'preview');
    expect(JSON.stringify(p)).toBe(before);
    const bad = executeRebarBatch(
      p,
      [
        {
          type: 'bar.create',
          id: 'new',
          detailId: p.hierarchy.details[0].id,
          definition: rebarDefinition({ ...b, width: 1 }),
        },
        { type: 'bar.delete', id: 'old' },
      ],
      { units: 'mm' },
    );
    expect(bad.ok).toBe(false);
    expect(JSON.stringify(p)).toBe(before);
  });
});
