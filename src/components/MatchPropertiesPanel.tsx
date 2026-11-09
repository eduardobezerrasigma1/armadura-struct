import { useState } from 'react';
import {
  graphicNames,
  type GraphicRef,
  type MatchOptions,
  type MatchPlan,
  type GraphicProperty,
} from '../domain/matchProperties';
export type MatchSession = {
  source?: GraphicRef;
  targets: GraphicRef[];
  options: MatchOptions;
  stage: 'source' | 'properties' | 'targets';
  issue?: string;
};
export default function MatchPropertiesPanel({
  session: s,
  entities,
  plan,
  error,
  onChange,
  onApply,
  onEnd,
}: {
  session: MatchSession;
  entities: GraphicRef[];
  plan?: MatchPlan;
  error?: string;
  onChange: (s: MatchSession) => void;
  onApply: () => void;
  onEnd: () => void;
}) {
  const [query, setQuery] = useState('');
  const list = entities
    .filter((e) =>
      e.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
    )
    .slice(0, 200);
  return (
    <section
      className="mask-cad-panel"
      aria-label="Copiar propriedades"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onEnd();
        }
        if (e.key === 'Enter') e.stopPropagation();
      }}
    >
      <div className="transform-heading">
        <b>Copiar propriedades</b>
        <span>
          {s.stage === 'source'
            ? '1/3 · Fonte'
            : s.stage === 'properties'
              ? '2/3 · Propriedades'
              : '3/3 · Destinos / prévia'}
        </span>
      </div>
      <p>
        {s.source
          ? `Fonte: ${s.source.label}`
          : 'Escolha uma fonte. Seleção anterior não é aproveitada.'}
      </p>
      {s.stage !== 'properties' && (
        <label className="field">
          Pesquisar
          <input
            aria-label="Pesquisar propriedades CAD"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      )}
      {s.stage === 'source' ? (
        <label className="field">
          Fonte
          <select
            aria-label="Fonte de propriedades"
            value=""
            onChange={(e) => {
              const source = entities.find((q) => q.key === e.target.value);
              if (source)
                onChange({
                  ...s,
                  source,
                  stage: 'properties',
                  issue: undefined,
                });
            }}
          >
            <option value="">Escolher entidade</option>
            {list.map((e) => (
              <option key={e.key} value={e.key}>
                {e.label}
              </option>
            ))}
          </select>
        </label>
      ) : s.stage === 'properties' ? (
        <>
          <label className="field">
            Modo
            <select
              aria-label="Modo de cópia gráfica"
              value={s.options.mode}
              onChange={(e) =>
                onChange({
                  ...s,
                  options: {
                    ...s.options,
                    mode: e.target.value as MatchOptions['mode'],
                  },
                })
              }
            >
              <option value="binding">Vínculos ByLayer e overrides</option>
              <option value="resolved">
                Aparência resolvida (overrides fixos)
              </option>
            </select>
          </label>
          <p>
            ByLayer continua vinculado ao layer do destino, a menos que Layer
            também seja copiado. Aparência resolvida fixa somente os atributos
            escolhidos.
          </p>
          {(Object.entries(graphicNames) as [GraphicProperty, string][]).map(
            ([key, label]) => (
              <label className="match-check" key={key}>
                <input
                  type="checkbox"
                  checked={s.options.properties.includes(key)}
                  onChange={() =>
                    onChange({
                      ...s,
                      options: {
                        ...s.options,
                        properties: s.options.properties.includes(key)
                          ? s.options.properties.filter((p) => p !== key)
                          : [...s.options.properties, key],
                      },
                    })
                  }
                />
                {label}
              </label>
            ),
          )}
          <button
            onClick={() =>
              onChange({ ...s, stage: 'targets', issue: undefined })
            }
          >
            Escolher destinos
          </button>
        </>
      ) : (
        <>
          <p>
            {s.targets.length} destino(s) · prévia no canvas; projeto ainda não
            alterado. Clique novamente para retirar.
          </p>
          <div className="mask-manip-list">
            {list
              .filter((e) => e.key !== s.source?.key)
              .map((e) => (
                <label key={e.key}>
                  <input
                    type="checkbox"
                    checked={s.targets.some((q) => q.key === e.key)}
                    onChange={() =>
                      onChange({
                        ...s,
                        targets: s.targets.some((q) => q.key === e.key)
                          ? s.targets.filter((q) => q.key !== e.key)
                          : [...s.targets, e],
                        issue: undefined,
                      })
                    }
                  />
                  {e.label}
                  {!e.editable ? ' · protegido' : ''}
                </label>
              ))}
          </div>
          <button onClick={() => onChange({ ...s, stage: 'properties' })}>
            Alterar propriedades
          </button>
          {plan && (
            <p>
              {plan.count} alteração(ões). {plan.notes.join(' ')}
            </p>
          )}
          <button
            className="primary"
            disabled={!plan || !plan.count}
            onClick={onApply}
          >
            Aplicar propriedades
          </button>
        </>
      )}
      {(error || s.issue) && <p role="alert">{s.issue || error}</p>}
      <p className="field-help">
        Lista: até 200 resultados por pesquisa. Canvas seleciona entidades da
        máscara ativa; demais objetos são escolhidos por nome/ID. Não copia
        geometria, IDs, conteúdo ou atributos de aço.
      </p>
      <button onClick={onEnd}>Concluir / cancelar</button>
    </section>
  );
}
