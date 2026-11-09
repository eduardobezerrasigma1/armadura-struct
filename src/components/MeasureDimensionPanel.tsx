import type { Point, Project } from '../domain/types';
import type { MaskDrawingContext } from '../domain/maskDrawing';
import {
  formatDimension,
  measuredDistance,
  type DimensionPresentation,
  type MaskDimensionReference,
} from '../domain/maskDimensions';
export type MeasureSession = {
  project: Project;
  context: MaskDrawingContext;
  maskId?: string;
  barId?: string;
  cursor?: Point;
  result?: ReturnType<typeof measuredDistance>;
  references: MaskDimensionReference[];
  presentation: DimensionPresentation;
  issue?: string;
};
export default function MeasureDimensionPanel({
  session: s,
  tool,
  points,
  onMode,
  onPresentation,
  onEnd,
}: {
  session: MeasureSession;
  tool: string;
  points: Point[];
  onMode: (
    mode: 'measure' | 'dimension-aligned' | 'dimension-orthogonal',
  ) => void;
  onPresentation: (v: DimensionPresentation) => void;
  onEnd: () => void;
}) {
  let values = s.result;
  try {
    if (points.length === 1 && s.cursor)
      values = measuredDistance(points[0], s.cursor);
  } catch {
    /* Invalid cursor is reported at confirmation. */
  }
  return (
    <section
      className="mask-cad-panel"
      aria-label="Medir e cotar"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          e.preventDefault();
          onEnd();
        }
        if (e.key === 'Enter') e.stopPropagation();
      }}
    >
      <div className="transform-heading">
        <b>
          {tool === 'measure'
            ? 'Medir distância · consulta'
            : 'Inserir cota · anotação'}
        </b>
        <span>
          {points.length === 0
            ? 'P1'
            : points.length === 1
              ? 'P2'
              : 'Posição / confirmar'}
        </span>
      </div>
      <label className="field">
        Operação
        <select
          aria-label="Operação de medir e cotar"
          value={tool}
          onChange={(e) =>
            onMode(
              e.target.value as
                | 'measure'
                | 'dimension-aligned'
                | 'dimension-orthogonal',
            )
          }
        >
          <option value="measure">Medir distância — consulta</option>
          <option value="dimension-orthogonal">
            Inserir cota linear / ortogonal
          </option>
          <option value="dimension-aligned">Inserir cota alinhada</option>
        </select>
      </label>
      <div className="field-row">
        <label className="field">
          Unidade
          <select
            aria-label="Unidade da medida"
            value={s.presentation.unit}
            onChange={(e) =>
              onPresentation({
                ...s.presentation,
                unit: e.target.value as DimensionPresentation['unit'],
              })
            }
          >
            {['mm', 'cm', 'm'].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Casas decimais
          <select
            aria-label="Precisão da medida"
            value={s.presentation.precision}
            onChange={(e) =>
              onPresentation({
                ...s.presentation,
                precision: Number(e.target.value),
              })
            }
          >
            {[0, 1, 2, 3, 4, 5, 6].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      </div>
      {values && (
        <p role="status">
          Distância: {formatDimension(values.distance, s.presentation)}
          <br />
          ΔX: {formatDimension(values.dx, s.presentation)} · ΔY:{' '}
          {formatDimension(values.dy, s.presentation)}
        </p>
      )}
      <p>
        {tool === 'measure'
          ? 'Indique P1 e P2 por snap/clique ou coordenadas em mm no Comando CAD. Após P2, repita com outro par ou conclua. Consulta não cria objetos nem altera o histórico.'
          : 'Indique P1, P2 e depois a posição da linha/texto. O terceiro clique ou coordenada confirma uma cota. Esc antes disso descarta a prévia.'}
      </p>
      {tool === 'dimension-orthogonal' && (
        <p>
          Posição acima/abaixo do centro dos pontos: horizontal. Posição nos
          lados: vertical. A prévia mostra a projeção escolhida.
        </p>
      )}
      {tool !== 'measure' && (
        <p>
          Cota estática: não acompanha a máscara. Referências capturadas na
          máscara ativa serão verificadas; se mudarem ou desaparecerem, a cota e
          as saídas receberão aviso. Texto, altura e estilo usam o editor
          existente.
        </p>
      )}
      <p className="field-help">
        Modelo em mm; unidade e precisão mudam apenas a apresentação.{' '}
        {s.maskId
          ? 'Máscara ativa disponível para snaps e verificação.'
          : 'Sem máscara ativa: pontos livres, sem verificação de referência.'}{' '}
        Aço e arquivos externos permanecem intactos.
      </p>
      {s.issue && <p role="alert">{s.issue}</p>}
      <button onClick={onEnd}>Concluir / cancelar · Esc</button>
    </section>
  );
}
