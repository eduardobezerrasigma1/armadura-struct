import { useEffect, useRef, useState } from 'react';
import { criteriaBar } from '../domain/stirrups';
import { path, bounds, geometry, format } from '../domain/geometry';
import { stirrupEnvelope } from '../domain/stirrupGeometry';
import type { StirrupCriteria, StirrupProfile } from '../domain/stirrupSchema';

export default function StirrupCriteriaDialog({
  initial,
  editMark,
  onAccept,
  onDraw,
  onClose,
  issue,
}: {
  initial: StirrupCriteria;
  editMark?: string;
  issue?: string;
  onAccept: (c: StirrupCriteria) => void;
  onDraw: (c: StirrupCriteria) => void;
  onClose: () => void;
}) {
  const [c, set] = useState(() => structuredClone(initial)),
    [tab, setTab] = useState('Forma'),
    [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const old = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    dialog.current?.querySelector<HTMLElement>('select,input')?.focus();
    return () => {
      dialog.current?.close();
      if (old?.isConnected) old.focus();
    };
  }, []);
  const change = (patch: Partial<StirrupCriteria>) => {
    set((v) => ({ ...v, ...patch }));
    setError('');
  };
  const profile = (patch: Partial<StirrupProfile>) =>
    change({ profile: { ...c.profile, ...patch } });
  let preview,
    previewIssue = '';
  try {
    preview = criteriaBar(c, { x: 0, y: 0 }, 'N?', 'preview');
  } catch (e) {
    previewIssue = (e as Error).message;
  }
  const box = preview
    ? bounds(geometry(preview).vertices)
    : { x: 0, y: 0, width: 200, height: 400 };
  const margin = Math.max(box.width, box.height) * 0.12 + 20;
  const num = (
    label: string,
    value: number,
    fn: (v: number) => void,
    min = 0,
  ) => (
    <label className="field">
      {label}
      <input
        type="number"
        step="any"
        min={min}
        required
        aria-label={label}
        value={Number.isNaN(value) ? '' : value}
        onChange={(e) =>
          fn(e.target.value === '' ? NaN : Number(e.target.value))
        }
      />
    </label>
  );
  return (
    <dialog
      ref={dialog}
      className="modal stirrup-dialog"
      aria-labelledby="stirrup-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (previewIssue) {
            setError(previewIssue);
            return;
          }
          onAccept(c);
        }}
      >
        <div className="panel-heading">
          <b id="stirrup-title">
            {editMark
              ? `Editar critérios de ${editMark}`
              : 'Critérios do estribo'}
          </b>
          <button
            type="button"
            aria-label="Fechar critérios do estribo"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <nav className="stirrup-tabs" aria-label="Etapas dos critérios">
          {['Forma', 'Distribuição', 'Representação'].map((t) => (
            <button
              type="button"
              key={t}
              aria-pressed={tab === t}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </nav>
        <div className="stirrup-dialog-body">
          <div>
            {tab === 'Forma' && (
              <>
                <div className="fields-2">
                  <label className="field">
                    Formato
                    <select
                      aria-label="Formato do estribo"
                      value={c.profile.shape}
                      onChange={(e) =>
                        profile({
                          shape: e.target.value as StirrupProfile['shape'],
                          ...(e.target.value === 'free'
                            ? { reference: 'axis' as const }
                            : {}),
                        })
                      }
                    >
                      <option value="rectangle">Retangular</option>
                      <option value="circle">Circular</option>
                      <option value="free">Livre</option>
                    </select>
                  </label>
                  <label className="field">
                    Contorno
                    <select
                      aria-label="Fechamento do estribo"
                      value={c.profile.closed ? 'closed' : 'open'}
                      onChange={(e) =>
                        profile({ closed: e.target.value === 'closed' })
                      }
                    >
                      <option value="closed">Fechado</option>
                      <option value="open">Aberto</option>
                    </select>
                  </label>
                </div>
                {c.profile.shape !== 'free' ? (
                  <>
                    <label className="field">
                      Referência das medidas
                      <select
                        aria-label="Referência das medidas"
                        value={c.profile.reference}
                        onChange={(e) =>
                          profile({
                            reference: e.target
                              .value as StirrupProfile['reference'],
                          })
                        }
                      >
                        <option value="axis">
                          Dimensões no eixo do estribo
                        </option>
                        <option value="concrete">
                          Seção de concreto + cobrimento
                        </option>
                      </select>
                    </label>
                    <div className="fields-2">
                      {num(
                        c.profile.shape === 'circle'
                          ? 'Diâmetro da seção (mm)'
                          : 'Base da seção (mm)',
                        c.width,
                        (width) => change({ width }),
                        0.01,
                      )}
                      {c.profile.shape === 'rectangle' &&
                        num(
                          'Altura da seção (mm)',
                          c.height,
                          (height) => change({ height }),
                          0.01,
                        )}
                      {c.profile.reference === 'concrete' &&
                        num(
                          'Cobrimento até face do aço (mm)',
                          c.profile.cover,
                          (cover) => profile({ cover }),
                        )}
                    </div>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => onDraw(c)}>
                      Desenhar forma livre no CAD
                    </button>
                    <p className="field-help">
                      {c.profile.points.length} vértices no eixo. Snaps e
                      coordenadas; Enter conclui o contorno. Fechamento
                      automático, sem repetir o primeiro ponto.
                    </p>
                  </>
                )}
                {c.profile.shape === 'circle' &&
                  !c.profile.closed &&
                  num(
                    'Abertura circular (graus)',
                    c.profile.gapAngle,
                    (gapAngle) => profile({ gapAngle }),
                    0.01,
                  )}
                <div className="fields-2">
                  {num(
                    'Bitola do estribo (mm)',
                    c.diameter,
                    (diameter) => change({ diameter }),
                    0.01,
                  )}
                  {num(
                    'Mandril interno (mm)',
                    c.mandrel,
                    (mandrel) => change({ mandrel }),
                    0.01,
                  )}
                  <label className="field">
                    Aço
                    <select
                      aria-label="Aço do estribo"
                      value={c.steel}
                      onChange={(e) =>
                        change({
                          steel: e.target.value as StirrupCriteria['steel'],
                        })
                      }
                    >
                      <option>CA-50</option>
                      <option>CA-60</option>
                    </select>
                  </label>
                  {num(
                    'Rotação da seção (graus)',
                    c.rotation,
                    (rotation) => change({ rotation }),
                    -360000,
                  )}
                </div>
                {(['start', 'end'] as const).map((end, i) => {
                  const hook = c.profile[end],
                    update = (v: Partial<typeof hook>) =>
                      profile({ [end]: { ...hook, ...v } });
                  return (
                    <fieldset key={end}>
                      <legend>Gancho {i + 1}</legend>
                      <div className="fields-2">
                        <label className="field">
                          Dobra
                          <select
                            aria-label={`Ângulo do gancho ${i + 1}`}
                            value={hook.angle}
                            onChange={(e) =>
                              update({
                                angle: Number(
                                  e.target.value,
                                ) as typeof hook.angle,
                              })
                            }
                          >
                            {[0, 90, 135, 180].map((a) => (
                              <option key={a} value={a}>
                                {a ? `${a}°` : 'Sem gancho'}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          Sentido
                          <select
                            aria-label={`Sentido do gancho ${i + 1}`}
                            value={hook.turn}
                            onChange={(e) =>
                              update({ turn: Number(e.target.value) as 1 | -1 })
                            }
                          >
                            <option value={-1}>Horário</option>
                            <option value={1}>Anti-horário</option>
                          </select>
                        </label>
                        {num(
                          `Trecho reto do gancho ${i + 1}`,
                          hook.length,
                          (length) => update({ length }),
                        )}
                        <label className="field">
                          Unidade
                          <select
                            aria-label={`Unidade do gancho ${i + 1}`}
                            value={hook.mode}
                            onChange={(e) =>
                              update({
                                mode: e.target.value as typeof hook.mode,
                              })
                            }
                          >
                            <option value="diameters">× bitola</option>
                            <option value="mm">mm</option>
                          </select>
                        </label>
                      </div>
                      <small>
                        Reto:{' '}
                        {format(
                          hook.mode === 'diameters'
                            ? hook.length * c.diameter
                            : hook.length,
                          2,
                        )}{' '}
                        mm; arco de dobra acrescentado ao comprimento.
                      </small>
                    </fieldset>
                  );
                })}
                <p className="field-help">
                  Fechado: contorno completo com encontro das duas pontas;
                  ganchos somados, sem solda presumida. Aberto retangular: três
                  lados (U). Ramos múltiplos, grampos e abas de laje ficam para
                  outra entrega.
                </p>
              </>
            )}
            {tab === 'Distribuição' && (
              <>
                {editMark ? (
                  <p>
                    Esta ação edita a seção desta posição. A faixa e sua
                    quantidade são preservadas; edite o espaçamento nas
                    propriedades da distribuição.
                  </p>
                ) : (
                  <>
                    <label className="field">
                      Lançamento
                      <select
                        aria-label="Modo de lançamento do estribo"
                        value={c.distribute ? 'range' : 'section'}
                        onChange={(e) =>
                          change({ distribute: e.target.value === 'range' })
                        }
                      >
                        <option value="range">
                          Seção + faixa na vista longitudinal
                        </option>
                        <option value="section">Somente seção</option>
                      </select>
                    </label>
                    {c.distribute ? (
                      <>
                        <div className="fields-2">
                          {num(
                            'Espaçamento solicitado (mm)',
                            c.spacing,
                            (spacing) => change({ spacing }),
                            0.01,
                          )}
                          <label className="field">
                            Política
                            <select
                              aria-label="Política do espaçamento"
                              value={c.fit}
                              onChange={(e) =>
                                change({
                                  fit: e.target.value as StirrupCriteria['fit'],
                                })
                              }
                            >
                              <option value="maximum">
                                Máximo: distribuir entre extremos
                              </option>
                              <option value="fixed">
                                Fixo: manter passo informado
                              </option>
                            </select>
                          </label>
                          {num(
                            'Afastamento da primeira face (mm)',
                            c.startInset,
                            (startInset) => change({ startInset }),
                          )}
                          {num(
                            'Afastamento da segunda face (mm)',
                            c.endInset,
                            (endInset) => change({ endInset }),
                          )}
                        </div>
                        <p className="field-help">
                          Máximo ajusta o passo para alcançar os dois extremos.
                          Fixo mantém o passo e deixa eventual sobra junto à
                          segunda face. Mínimo de duas peças. Os cliques definem
                          referências estáticas; não há associação automática
                          aos pilares.
                        </p>
                      </>
                    ) : (
                      num(
                        'Quantidade da seção',
                        c.quantity,
                        (quantity) => change({ quantity }),
                        1,
                      )
                    )}
                  </>
                )}
                <p>
                  Posicione a seção; depois indique as duas faces e a posição da
                  linha de distribuição. A seção e a faixa pertencem à mesma
                  posição de aço.
                </p>
              </>
            )}
            {tab === 'Representação' && (
              <>
                <p>
                  Usa os layers e estilos CAD atuais. Ocultar ganchos muda a
                  representação, mantendo comprimento e peso da peça completa.
                </p>
                {(['dimensions', 'identification', 'hooks'] as const).map(
                  (key, i) => (
                    <label className="check" key={key}>
                      <input
                        type="checkbox"
                        checked={c.display[key]}
                        onChange={(e) =>
                          change({
                            display: { ...c.display, [key]: e.target.checked },
                          })
                        }
                      />
                      {
                        [
                          'Exibir cotas da seção',
                          'Identificar posição e comprimento',
                          'Exibir ganchos',
                        ][i]
                      }
                    </label>
                  ),
                )}
              </>
            )}
          </div>
          <aside
            className="stirrup-shape-preview"
            aria-label="Prévia dos critérios"
          >
            <svg
              role="img"
              aria-label="Forma do estribo"
              viewBox={`${box.x - margin} ${-box.y - box.height - margin} ${box.width + margin * 2} ${box.height + margin * 2}`}
            >
              <g transform="scale(1,-1)">
                {preview && (
                  <path
                    d={path(geometry(preview).segments)}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={Math.max(
                      1,
                      Math.max(box.width, box.height) / 120,
                    )}
                  />
                )}
              </g>
            </svg>
            {preview && (
              <>
                <b>Comprimento: {format(geometry(preview).length, 2)} mm</b>
                {c.profile.shape !== 'free' && (
                  <span>
                    Eixo: {format(stirrupEnvelope(preview).width, 2)}
                    {c.profile.shape === 'rectangle'
                      ? ` × ${format(stirrupEnvelope(preview).height, 2)}`
                      : ''}{' '}
                    mm
                  </span>
                )}
              </>
            )}
            <small>
              Valores definidos pelo projetista. A prévia não verifica
              dimensionamento, ancoragem ou compatibilidade normativa.
            </small>
          </aside>
        </div>
        {(error || previewIssue || issue) && (
          <p className="stirrup-error" role="alert">
            {error || previewIssue || issue}
          </p>
        )}
        {!editMark && (
          <p className="field-help stirrup-criteria-note">
            Critérios para os próximos lançamentos. Serão salvos com o projeto
            ao confirmar um lançamento.
          </p>
        )}
        <footer className="dialog-actions">
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary" type="submit" disabled={!!previewIssue}>
            {editMark ? 'Aplicar nesta posição' : 'Usar critérios e lançar'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
