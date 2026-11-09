import { useState } from 'react';
import type { Point, Project } from '../domain/types';
import type { MaskDrawingContext } from '../domain/maskDrawing';
import type { MaskCadEntity, MaskEntityRef } from '../domain/maskCadEditing';
import type { MaskOffsetPlan } from '../domain/maskOffset';
import { format } from '../domain/geometry';

export type MaskOffsetSession = {
  project: Project;
  maskId: string;
  context: MaskDrawingContext;
  stage: 'distance' | 'measure' | 'entity' | 'side';
  input: string;
  distanceMm?: number;
  points: Point[];
  target?: MaskEntityRef;
  cursor?: Point;
  pickTolerance?: number;
  hadOperations: boolean;
  issue?: string;
};
export default function MaskOffsetPanel({
  session: s,
  entities,
  preview,
  onInput,
  onDistance,
  onMeasure,
  onTarget,
  onRestart,
  onEnd,
}: {
  session: MaskOffsetSession;
  entities: MaskCadEntity[];
  preview: { plan?: MaskOffsetPlan; error?: string };
  onInput: (raw: string) => void;
  onDistance: () => void;
  onMeasure: () => void;
  onTarget: (ref?: MaskEntityRef) => void;
  onRestart: () => void;
  onEnd: () => void;
}) {
  const [query, setQuery] = useState('');
  const mask = s.project.masks.find((m) => m.id === s.maskId)!;
  const matches = entities.filter(
    (e) =>
      e.mask.id === s.maskId &&
      e.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  return (
    <section
      className="mask-cad-panel"
      aria-label="Offset de máscaras"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onEnd();
        }
        if (
          e.key === 'Enter' &&
          (e.target as HTMLElement).closest('input,select,button')
        )
          e.stopPropagation();
      }}
    >
      <div className="transform-heading">
        <b>Offset · Paralelas</b>
        <span>
          {s.stage === 'distance'
            ? '1/3 · Distância'
            : s.stage === 'measure'
              ? `Medir · P${s.points.length + 1}`
              : s.stage === 'entity'
                ? '2/3 · Entidade'
                : '3/3 · Lado / prévia'}
        </span>
      </div>
      <p>
        <strong>{mask.name}</strong> · somente entidades desta máscara. Original
        e aço permanecem.
      </p>
      {s.stage === 'distance' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDistance();
          }}
        >
          <label className="field">
            Distância positiva (unidade obrigatória)
            <input
              aria-label="Distância do Offset"
              placeholder="100 mm ou 2,5 cm"
              inputMode="decimal"
              value={s.input}
              onChange={(e) => onInput(e.target.value)}
            />
          </label>
          <button type="submit" className="primary">
            Confirmar distância
          </button>
          <button type="button" onClick={onMeasure}>
            Distância por dois pontos
          </button>
        </form>
      ) : s.stage === 'measure' ? (
        <p>
          Escolha P{s.points.length + 1} por clique/snap ou coordenadas no
          Comando CAD. A distância física entre P1/P2 será adotada, sem alterar
          objetos.
        </p>
      ) : (
        <>
          <p>
            Distância:{' '}
            <output data-testid="offset-distance">
              {format(s.distanceMm!, 9)} mm
            </output>
            . Clique{' '}
            {s.stage === 'entity'
              ? 'numa entidade ou escolha seu ID abaixo.'
              : 'no lado físico desejado, após conferir a prévia. Clique sobre a linha ou região ambígua é recusado.'}
          </p>
          {s.stage === 'entity' ? (
            <>
              <label className="field">
                Pesquisar entidade
                <input
                  aria-label="Pesquisar entidades Offset"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <label className="field">
                Entidade
                <select
                  aria-label="Entidade para Offset"
                  value=""
                  onChange={(e) =>
                    onTarget(
                      entities.find((q) => q.ref.key === e.target.value)?.ref,
                    )
                  }
                >
                  <option value="">Selecionar pelo nome/ID</option>
                  {matches.slice(0, 200).map((e) => (
                    <option key={e.ref.key} value={e.ref.key}>
                      {e.label}
                      {!e.editable ? ' · protegido' : ''}
                    </option>
                  ))}
                </select>
              </label>
              {matches.length > 200 && (
                <p>200 resultados; refine a pesquisa.</p>
              )}
            </>
          ) : (
            <>
              <p>
                Original: #{s.target!.index + 1} · [
                {s.target!.id?.slice(0, 8) ?? 'referência importada'}]
              </p>
              <button onClick={() => onTarget(undefined)}>
                Escolher outra entidade
              </button>
            </>
          )}
          <button onClick={onRestart}>Alterar distância</button>
        </>
      )}
      {preview.plan && (
        <div data-testid="offset-result">
          <p>
            Lado {preview.plan.side} · {preview.plan.results.length} nova(s)
            entidade(s) · layer/estilo herdados da origem.
          </p>
          {preview.plan.notes.map((n) => (
            <p key={n}>{n}</p>
          ))}
        </div>
      )}
      {mask.format !== 'NATIVE' && (
        <p className="field-help">
          Referência normalizada: curvas já importadas como segmentos usam essa
          aproximação. Círculos/arcos analíticos continuam analíticos. O arquivo
          CAD externo é preservado.
        </p>
      )}
      {(s.issue || preview.error) && (
        <p role="alert">{s.issue || preview.error}</p>
      )}
      <p className="field-help">
        Junções retas; cantos acima de 20×d são recusados. Cada clique
        confirmado cria todos os remanescentes em uma transação. Enter/Esc
        encerra e descarta somente a prévia pendente. Cotas estáticas exigem
        revisão. Sem modo Through implícito.
      </p>
      <button onClick={onEnd}>
        {s.hadOperations ? 'Concluir Offset' : 'Cancelar Offset'}
      </button>
    </section>
  );
}
