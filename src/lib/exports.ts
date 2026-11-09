import { plotSettingsSchema } from '../domain/layerSchema';
import {
  plotPrimitives,
  plotColor,
  resolvePlotStyle,
} from '../domain/plotting';
import { stylePrimitive } from '../domain/layers';
import { validateLayers, dashArray } from '../domain/layers';
import type { Primitive } from '../domain/types';
import { quantitySourceLabel } from '../domain/detailQuantities';
import { jsPDF } from 'jspdf';
import { bounds, format } from '../domain/geometry';
import {
  schedule,
  scheduleChanged,
  scheduleQuantityLabel,
} from '../domain/model';
import { annotationError, primitiveBounds } from '../domain/drafting';
import { version as appVersion } from '../../package.json';
import { drawingPrimitives as exportLines } from '../domain/drawingPrimitives';
export { drawingPrimitives as exportLines } from '../domain/drawingPrimitives';
import type { Point, Project } from '../domain/types';
import {
  assertPaperExportable,
  paperInk,
  paperLineWidth,
} from '../domain/paper';
export function assertExportable(p: Project) {
  validateLayers(p);
  if (p.plotting) plotSettingsSchema.parse(p.plotting);
  const annotationIssue = p.annotations.map(annotationError).find(Boolean);
  if (annotationIssue)
    throw new Error(
      `Corrija as anotações antes de exportar: ${annotationIssue}`,
    );
  if (scheduleChanged(p))
    throw new Error(
      'A relação de aço está bloqueada e desatualizada. Use Atualizar RA ou Desbloquear RA antes de exportar.',
    );
  const invalid = schedule({ ...p, scheduleLock: undefined }).filter(
    (r) => r.errors.length,
  );
  if (invalid.length)
    throw new Error(
      `Corrija a geometria de ${invalid.map((r) => r.mark).join(', ')} antes de exportar.`,
    );
}
/** UTF-8 DXF 2007: native and reference layers, ByLayer and explicit overrides. */
export function toDxf(p: Project): string {
  assertExportable(p);
  const out: (string | number)[] = [],
    put = (...pairs: (string | number)[]) => out.push(...pairs);
  const clean = (s: string) =>
    s.replace(/[\r\n\x00-\x1f]/g, ' ').replace(/Ø/g, '%%c');
  const raw = exportLines(p);
  const box = bounds(raw.flatMap((l) => l.points));
  const scheduleLayer =
    p.layers.find((l) => l.id === 'layer:QUADRO_ACO') ?? p.layers[0];
  let scheduleY = box.y - 400;
  for (const text of [
    'QUADRO DE ACO | comprimentos em metros',
    'POS   ACO   DIAM   BASE x REP = QTD   C.UNIT   C.TOTAL   PESO(kg)',
    ...schedule(p).map(
      (r) =>
        `${r.mark}   ${r.steel}   ${r.diameter}   ${scheduleQuantityLabel(r).replace(/×/g, 'x')}   ${format(r.unitLength, 3)}   ${format(r.totalLength, 3)}   ${format(r.weight, 2)}`,
    ),
  ]) {
    raw.push(
      stylePrimitive(
        p,
        { layerId: scheduleLayer.id },
        {
          layer: 'QUADRO_ACO',
          points: [{ x: box.x, y: scheduleY }],
          text,
          textHeight: 45,
        },
      ),
    );
    scheduleY -= 90;
  }
  const lines = plotPrimitives(p, raw, 'dxf');
  const plottedLayers = p.layers.map((l) => ({
    ...l,
    ...plotPrimitives(
      p,
      [{ layer: l.name, layerId: l.id, points: [] }],
      'dxf',
    )[0]?.resolvedStyle,
  }));
  const weights = [
    0, 5, 9, 13, 15, 18, 20, 25, 30, 35, 40, 50, 53, 60, 70, 80, 90, 100, 106,
    120, 140, 158, 200, 211,
  ];
  for (const s of [
    ...plottedLayers.filter((l) => l.plot?.include !== false),
    ...lines.map((l) => l.resolvedStyle).filter((s) => s !== undefined),
  ])
    if (
      !weights.includes(Math.round(s.lineWidth * 100)) ||
      Math.abs(s.lineWidth * 100 - Math.round(s.lineWidth * 100)) > 1e-7
    )
      throw new Error(
        `Espessura ${s.lineWidth} mm não suportada no DXF. Use uma pena CAD, como 0,18 / 0,25 / 0,35 / 0,50 / 0,70 mm.`,
      );
  const types: { name: string; pattern: number[] }[] = [];
  const typeName = (t: { name: string; pattern: number[] }) => {
    const same = types.find(
      (x) =>
        x.name.toUpperCase() === t.name.toUpperCase() &&
        JSON.stringify(x.pattern) === JSON.stringify(t.pattern),
    );
    if (same) return same.name;
    let name = clean(t.name),
      n = 2;
    while (types.some((x) => x.name.toUpperCase() === name.toUpperCase()))
      name = `${clean(t.name)}_${n++}`;
    types.push({ ...t, name });
    return name;
  };
  const layerTypes = new Map(
    plottedLayers.map((l) => [l.id, typeName(l.lineType)]),
  );
  const lineTypes = new Map(
    lines.map((l) => [
      JSON.stringify(l.resolvedStyle!.lineType),
      typeName(l.resolvedStyle!.lineType),
    ]),
  );
  typeName({ name: 'CONTINUOUS', pattern: [] });
  put(
    0,
    'SECTION',
    2,
    'HEADER',
    9,
    '$ACADVER',
    1,
    'AC1021',
    9,
    '$INSUNITS',
    70,
    4,
    0,
    'ENDSEC',
    0,
    'SECTION',
    2,
    'TABLES',
  );
  put(0, 'TABLE', 2, 'LTYPE', 5, '10', 70, types.length);
  for (const t of types) {
    put(
      0,
      'LTYPE',
      100,
      'AcDbSymbolTableRecord',
      100,
      'AcDbLinetypeTableRecord',
      2,
      clean(t.name),
      70,
      0,
      3,
      clean(t.name),
      72,
      65,
      73,
      t.pattern.length,
      40,
      t.pattern.reduce((s, n) => s + Math.abs(n), 0),
    );
    for (const n of t.pattern) put(49, n, 74, 0);
  }
  put(0, 'ENDTAB', 0, 'TABLE', 2, 'LAYER', 5, '11', 70, p.layers.length);
  for (const l of plottedLayers)
    put(
      0,
      'LAYER',
      100,
      'AcDbSymbolTableRecord',
      100,
      'AcDbLayerTableRecord',
      2,
      clean(l.name),
      70,
      0,
      62,
      7,
      420,
      parseInt(l.color.slice(1), 16),
      6,
      layerTypes.get(l.id) ?? 'CONTINUOUS',
      370,
      Math.round(l.lineWidth * 100),
      290,
      l.plot?.include === false ? 0 : 1,
    );
  put(0, 'ENDTAB', 0, 'ENDSEC', 0, 'SECTION', 2, 'ENTITIES');
  const common = (item: Primitive) => {
    const style = item.resolvedStyle!;
    const layer = plottedLayers.find((l) => l.id === item.layerId);
    put(100, 'AcDbEntity', 8, clean(item.layer));
    if (style.color !== layer?.color)
      put(420, parseInt(style.color.slice(1), 16));
    else put(62, 256);
    put(
      6,
      JSON.stringify(style.lineType) === JSON.stringify(layer?.lineType)
        ? 'BYLAYER'
        : (lineTypes.get(JSON.stringify(style.lineType)) ?? 'CONTINUOUS'),
      48,
      style.lineScale,
      370,
      style.lineWidth === layer?.lineWidth
        ? -1
        : Math.round(style.lineWidth * 100),
    );
  };
  for (const item of lines) {
    if (item.text) {
      const a = item.points[0];
      put(0, 'TEXT');
      common(item);
      put(
        100,
        'AcDbText',
        10,
        a.x,
        20,
        a.y,
        30,
        0,
        40,
        item.textHeight ?? 40,
        1,
        clean(item.text),
        50,
        item.textRotation ?? 0,
        72,
        item.textAlign === 'right'
          ? 2
          : item.textAlign === 'center' ||
              (!item.textAlign &&
                ['COTAS', 'DISTRIBUICAO'].includes(item.role ?? item.layer))
            ? 1
            : 0,
        11,
        a.x,
        21,
        a.y,
        31,
        0,
        100,
        'AcDbText',
      );
      continue;
    }
    if (
      item.native?.kind === 'arc' &&
      ['ARMADURAS', 'REBATIMENTOS'].includes(item.role ?? item.layer)
    ) {
      const a = item.native,
        start = a.sweepAngle > 0 ? a.startAngle : a.startAngle + a.sweepAngle,
        end = a.sweepAngle > 0 ? a.startAngle + a.sweepAngle : a.startAngle;
      put(0, 'ARC');
      common(item);
      put(
        100,
        'AcDbCircle',
        10,
        a.center.x,
        20,
        a.center.y,
        30,
        0,
        40,
        a.radius,
        100,
        'AcDbArc',
        50,
        ((start % 360) + 360) % 360,
        51,
        ((end % 360) + 360) % 360,
      );
      continue;
    }
    if (item.points.length < 2) continue;
    put(0, 'LWPOLYLINE');
    common(item);
    put(100, 'AcDbPolyline', 90, item.points.length, 70, item.closed ? 1 : 0);
    for (const v of item.points) put(10, v.x, 20, v.y);
    if (item.closed && item.resolvedStyle?.fill === 'solid') {
      put(0, 'HATCH');
      common({
        ...item,
        resolvedStyle: {
          ...item.resolvedStyle,
          color: item.resolvedStyle.fillColor,
        },
      });
      put(
        100,
        'AcDbHatch',
        10,
        0,
        20,
        0,
        30,
        0,
        210,
        0,
        220,
        0,
        230,
        1,
        2,
        'SOLID',
        70,
        1,
        71,
        0,
        91,
        1,
        92,
        2,
        72,
        0,
        73,
        1,
        93,
        item.points.length,
      );
      for (const v of item.points) put(10, v.x, 20, v.y);
      put(97, 0, 75, 0, 76, 1, 98, 0);
    }
  }
  put(0, 'ENDSEC', 0, 'EOF');
  return out.join('\r\n') + '\r\n';
}
export function toCsv(p: Project) {
  assertExportable(p);
  const safe = (v: unknown) =>
    `"${String(v)
      .replace(/^(?=[=+@\-\t\r])/, "'")
      .replace(/"/g, '""')}"`;
  return (
    '\ufeff' +
    [
      [
        'Posição',
        'Elemento',
        'Aço',
        'Bitola (mm)',
        'Quantidade base',
        'Repetições',
        'Quantidade efetiva',
        'Comprimento unitário (m)',
        'Comprimento total (m)',
        'Peso teórico (kg)',
        'ID da posição de fabricação',
        'Contribuições por ocorrência (JSON)',
        'Fórmula da quantidade',
        'C. unit. mínimo (m)',
        'C. unit. máximo (m)',
        'Multiplicador da armadura',
        'Quantidade por detalhe',
        'Origem da quantidade base',
        'Observação',
        'Por nervura',
        'Mostrar C/NERV',
        'Lance',
      ],
      ...schedule(p).map((r) => [
        r.mark,
        r.element,
        r.steel,
        r.diameter,
        r.baseQuantity,
        r.contributions.length > 1
          ? r.contributions.map((c) => c.repetitions).join('/')
          : r.repetitions,
        r.quantity,
        format(r.unitLength, 3),
        format(r.totalLength, 3),
        format(r.weight, 2),
        r.positionId,
        JSON.stringify(r.contributions),
        scheduleQuantityLabel(r),
        String(r.unitLengthRange[0]),
        String(r.unitLengthRange[1]),
        r.multiplier ?? r.contributions.map((c) => c.multiplier).join('/'),
        r.perDetailQuantity,
        r.contributions
          .map((c) => quantitySourceLabel(c.quantitySource))
          .join(' / '),
        r.contributions.map((c) => c.comment).join(' / '),
        r.contributions.map((c) => (c.ribbed ? 'Sim' : 'Não')).join('/'),
        r.contributions.map((c) => (c.showRibbed ? 'Sim' : 'Não')).join('/'),
        r.contributions.map((c) => c.columnLevel).join(' / '),
      ]),
    ]
      .map((row) => row.map(safe).join(';'))
      .join('\r\n')
  );
}
export function toPdf(p: Project): Uint8Array {
  assertExportable(p);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  const W = 420,
    H = 297;
  const title = (name: string) => {
    doc.setDrawColor(plotColor(p, '#3448d1'));
    doc.setLineWidth(0.5);
    doc.line(14, 24, W - 14, 24);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(plotColor(p, '#192442'));
    doc.text(name, 14, 17);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`OPENSTRUCT / ARMADURASTRUCT ${appVersion}`, W - 14, 17, {
      align: 'right',
    });
    doc.setFontSize(8);
    doc.setTextColor(plotColor(p, '#646464'));
    doc.text(
      doc.splitTextToSize(
        `${p.name} | ${p.author || 'Autor não informado'} | ${p.hierarchy.floors.map((f) => f.name).join(', ')} | Rev. ${p.drawing.revision}`,
        W - 75,
      )[0],
      14,
      H - 12,
    );
    doc.text(`Página ${doc.getNumberOfPages()}`, W - 14, H - 12, {
      align: 'right',
    });
  };
  title('Detalhamento de armaduras');
  const lines = plotPrimitives(p, exportLines(p));
  const box = bounds(lines.flatMap(primitiveBounds));
  const fitScale = Math.min(
    (W - 40) / Math.max(box.width, 1),
    (H - 70) / Math.max(box.height + 150, 1),
  );
  const s = p.drawing.scale ? 1 / p.drawing.scale : fitScale;
  if (s > fitScale + 1e-8)
    throw new Error(
      'O desenho não cabe na folha A3 nesta escala. Escolha uma escala menor ou Ajustar à folha nas propriedades do projeto.',
    );
  const map = (a: Point): Point => ({
    x: 20 + (a.x - box.x) * s,
    y: 40 + (box.y + box.height - a.y) * s,
  });
  for (const item of lines) {
    const c =
      item.layer === 'MASCARA'
        ? [165, 170, 180]
        : item.layer === 'ARMADURAS'
          ? [30, 70, 145]
          : [50, 65, 85];
    if (item.resolvedStyle) {
      doc.setDrawColor(item.resolvedStyle.color);
      doc.setTextColor(item.resolvedStyle.color);
    } else {
      doc.setDrawColor(c[0], c[1], c[2]);
      doc.setTextColor(c[0], c[1], c[2]);
    }
    doc.setLineWidth(item.resolvedStyle?.lineWidth ?? 0.3);
    doc.setLineDashPattern(dashArray(item.resolvedStyle), 0);
    if (item.text) {
      const a = map(item.points[0]);
      doc.setFontSize(((item.textHeight ?? 40) * s * 72) / 25.4);
      doc.text(item.text.replace(/%%c/g, 'Ø'), a.x, a.y, {
        angle: item.textRotation ?? 0,
        align:
          item.textAlign ??
          ((item.role ?? item.layer) === 'COTAS' ||
          (item.role ?? item.layer) === 'DISTRIBUICAO'
            ? 'center'
            : 'left'),
      });
      continue;
    }
    if (item.closed && item.resolvedStyle?.fill === 'solid')
      pdfFill(doc, item.points.map(map), item.resolvedStyle.fillColor);
    const pts = item.closed ? [...item.points, item.points[0]] : item.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = map(pts[i]),
        b = map(pts[i + 1]);
      doc.line(a.x, a.y, b.x, b.y);
    }
  }
  doc.setFontSize(7);
  doc.setTextColor(plotColor(p, '#646464'));
  doc.text(
    `${p.drawing.scale ? `Escala 1:${p.drawing.scale}` : 'Vista ajustada à folha'} · dimensões indicadas em cm · geometria pelo eixo da barra`,
    14,
    279,
  );
  const raLayer =
    p.layers.find((l) => l.id === 'layer:QUADRO_ACO') ?? p.layers[0];
  const ra = resolvePlotStyle(p, {
    layer: raLayer.name,
    layerId: raLayer.id,
    points: [],
  });
  if (!ra.include) return new Uint8Array(doc.output('arraybuffer'));
  doc.setLineDashPattern([], 0);
  doc.addPage();
  title('Quadro de aço');
  let y = 39;
  const header = () => {
    doc.setFillColor(
      p.plotting?.preset === 'monochrome' ? '#ffffff' : plotColor(p, '#ecf0f8'),
    );
    doc.rect(14, y - 6, 392, 10, 'F');
    doc.setTextColor(ra.style.color);
    doc.setFontSize(9);
    [
      'Pos.',
      'Elemento',
      'Aço',
      'Ø mm',
      'Qtd.',
      'C. unit. m',
      'C. total m',
      'Peso kg',
    ].forEach((t, i) =>
      doc.text(t, [18, 44, 170, 205, 240, 275, 323, 370][i], y),
    );
    y += 13;
  };
  header();
  for (const r of schedule(p)) {
    if (y > 258) {
      doc.addPage();
      title('Quadro de aço · continuação');
      y = 39;
      header();
    }
    doc.setTextColor(ra.style.color);
    doc.setFontSize(9);
    [
      r.mark,
      r.element.slice(0, 55),
      r.steel,
      String(r.diameter),
      String(r.quantity),
      format(r.unitLength, 3),
      format(r.totalLength, 3),
      format(r.weight, 2),
    ].forEach((t, i) =>
      doc.text(t, [18, 44, 170, 205, 240, 275, 323, 370][i], y),
    );
    doc.setDrawColor(plotColor(p, '#e1e1e1'));
    doc.setLineWidth(0.1);
    doc.line(14, y + 3, 406, y + 3);
    y += 11;
  }
  if (y > 240) {
    doc.addPage();
    title('Resumo');
    y = 40;
  }
  const rows = schedule(p);
  doc.setFont('helvetica', 'bold');
  doc.text(
    `Total: ${format(
      rows.reduce((s, r) => s + r.totalLength, 0),
      3,
    )} m  /  ${format(
      rows.reduce((s, r) => s + r.weight, 0),
      2,
    )} kg`,
    18,
    y + 8,
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    'Comprimentos pelo eixo, com arcos de dobra. Massa teórica: 7.850 kg/m³. Perdas e emendas adicionais não incluídas.',
    18,
    y + 20,
  );
  doc.text(
    'Mandris e prolongamentos são parâmetros definidos pelo projetista. O programa não realiza dimensionamento estrutural.',
    18,
    y + 26,
  );
  return new Uint8Array(doc.output('arraybuffer'));
}

/** Vector paper-space PDF: one page per sheet, using exactly the preview primitives. */
export function toSheetPdf(
  p: Project,
  sheetIds = p.sheets.map((s) => s.id),
): Uint8Array {
  assertExportable(p);
  const compositions = assertPaperExportable(p, sheetIds);
  const first = compositions[0];
  const doc = new jsPDF({
    unit: 'mm',
    format: [first.size.width, first.size.height],
    orientation: first.sheet.orientation,
    precision: 8,
  });
  doc.setProperties({
    title: p.name,
    author: p.author,
    creator: `ArmaduraStruct ${appVersion}`,
    subject: 'Pranchas - imprimir em tamanho real (100%)',
  });
  compositions.forEach((page, index) => {
    if (index)
      doc.addPage([page.size.width, page.size.height], page.sheet.orientation);
    doc.setFont('helvetica', 'normal');
    for (const line of [
      ...page.decorations,
      ...page.views.flatMap((v) => v.lines),
      ...(page.schedule?.lines ?? []),
    ]) {
      doc.setDrawColor(line.resolvedStyle?.color ?? paperInk(line.layer));
      doc.setTextColor(line.resolvedStyle?.color ?? paperInk(line.layer));
      doc.setLineWidth(
        line.resolvedStyle?.lineWidth ?? paperLineWidth(line.layer),
      );
      doc.setLineDashPattern(dashArray(line.resolvedStyle), 0);
      if (line.text) {
        const at = line.points[0];
        doc.setFontSize(((line.textHeight ?? 2.5) * 72) / 25.4);
        doc.text(line.text, at.x, page.size.height - at.y, {
          angle: line.textRotation ?? 0,
          align:
            line.textAlign ??
            (['COTAS', 'DISTRIBUICAO'].includes(line.role ?? line.layer)
              ? 'center'
              : 'left'),
        });
      } else {
        if (line.closed && line.resolvedStyle?.fill === 'solid')
          pdfFill(
            doc,
            line.points.map((v) => ({ x: v.x, y: page.size.height - v.y })),
            line.resolvedStyle.fillColor,
          );
        const pts =
          line.closed && line.points.length
            ? [...line.points, line.points[0]]
            : line.points;
        for (let i = 1; i < pts.length; i++)
          doc.line(
            pts[i - 1].x,
            page.size.height - pts[i - 1].y,
            pts[i].x,
            page.size.height - pts[i].y,
          );
      }
    }
  });
  return new Uint8Array(doc.output('arraybuffer'));
}

function pdfFill(doc: jsPDF, points: Point[], color: string) {
  if (points.length < 3) return;
  doc.setFillColor(color);
  doc.moveTo(points[0].x, points[0].y);
  for (const p of points.slice(1)) doc.lineTo(p.x, p.y);
  doc.close();
  doc.fill();
}
