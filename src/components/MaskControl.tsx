import { useEffect, useRef, useState } from 'react';
import type { Mask, Project } from '../domain/types';
import {
  nativePrimitive,
  scaleNativeShape,
  type NativeShape,
} from '../domain/nativeMasks';
import { MaskSelector } from './MaskDestination';
import { detailPath } from '../domain/hierarchy';
import { maskCadEntities } from '../domain/maskCadEditing';
import {
  applyMaskManipulation,
  previewMaskManipulation,
} from '../domain/maskManipulation';
import {
  maskDrawingState,
  type MaskDrawingContext,
} from '../domain/maskDrawing';
export default function MaskControl({
  project,
  owner,
  initial,
  entity,
  onChange,
  onCreate,
  onSelect,
  activeId,
  onActivate,
  onOpenContext,
  context,
  creating,
  onDelete,
  onBatch,
  onCalibrate,
  onCadEdit,
  onManipulate,
  onOffset,
  onClose,
}: {
  project: Project;
  owner: string;
  initial: string | null;
  entity?: string;
  onChange: (m: Mask, expected: Mask) => boolean;
  onCreate: (name: string, owner: string, base: Project) => Mask;
  onSelect: (id: string) => boolean;
  activeId?: string;
  onActivate: (id: string) => boolean;
  onOpenContext: (detailId: string) => boolean;
  context: MaskDrawingContext;
  creating?: boolean;
  onDelete: (id: string) => boolean;
  onCalibrate: (id: string) => boolean;
  onOffset: (id: string) => boolean;
  onCadEdit: (
    mode: 'trim' | 'extend',
    id: string,
    entityId?: string,
  ) => boolean;
  onManipulate: (
    mode: 'copy' | 'erase' | 'mirror',
    id: string,
    entityId?: string,
  ) => boolean;
  onBatch: (mode: 'import' | 'associate') => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    [id, setId] = useState(initial ?? ''),
    [eid, setEid] = useState(entity ?? ''),
    [name, setName] = useState('Máscara de desenho'),
    [raw, setRaw] = useState(''),
    [error, setError] = useState(''),
    [dx, setDx] = useState(0),
    [dy, setDy] = useState(0),
    [angle, setAngle] = useState(0),
    [creationOwner, setCreationOwner] = useState(owner);
  const submitting = useRef(false);
  const contextReady = (detailId: string) =>
    !context.key.startsWith('sheet:') &&
    detailId === owner &&
    (!context.scopeDetailId || context.scopeDetailId === detailId);
  const creationReady = contextReady(creationOwner);
  const masks = project.masks,
    m = masks.find((m) => m.id === id),
    e = m?.primitives.find((p) => p.id === eid && p.native);
  const change = (next: Mask) => {
    try {
      if (!m || !onChange(next, m))
        throw new Error(
          'Alteração não aplicada. Confira a proteção e o contexto da máscara.',
        );
      setError('');
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };
  const ready = !!m && contextReady(project.hierarchy.objectDetails[m.id]);
  const drawState = maskDrawingState(project, m?.id, context);
  useEffect(() => {
    const old = document.activeElement as HTMLElement;
    const el = ref.current!;
    el.showModal();
    if (creating)
      el.querySelector<HTMLInputElement>(
        '[aria-label="Nome da nova máscara"]',
      )?.focus();
    return () => {
      el.close();
      if (old?.isConnected) old.focus();
    };
  }, []);
  useEffect(() => {
    setRaw(
      e?.native && m
        ? JSON.stringify(scaleNativeShape(e.native, m.scale), null, 2)
        : '',
    );
    setError('');
  }, [e, m?.scale]);
  const shape: NativeShape | undefined = raw ? JSON.parse(raw) : undefined;
  const pointFields = (
    points: { x: number; y: number }[],
    update: (v: { x: number; y: number }[]) => void,
  ) =>
    points.map((p, i) => (
      <div className="fields-2" key={i}>
        {(['x', 'y'] as const).map((axis) => (
          <label className="field" key={axis}>
            {`Ponto ${i + 1} ${axis.toUpperCase()} (mm)`}
            <input
              aria-label={`Ponto ${i + 1} ${axis.toUpperCase()}`}
              type="number"
              value={p[axis]}
              onChange={(ev) =>
                update(
                  points.map((q, j) =>
                    i === j ? { ...q, [axis]: Number(ev.target.value) } : q,
                  ),
                )
              }
            />
          </label>
        ))}
      </div>
    ));
  const run = (f: () => void) => {
    try {
      setError('');
      f();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <dialog
      ref={ref}
      className="modal mask-control"
      aria-label="Controle de máscaras"
      onCancel={(ev) => {
        ev.preventDefault();
        onClose();
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (
          (e.ctrlKey || e.metaKey) &&
          ['s', 'o'].includes(e.key.toLowerCase())
        )
          e.preventDefault();
      }}
    >
      <h2>Controle de máscaras</h2>
      <div className="batch-actions">
        <button onClick={() => onBatch('import')}>
          Importar DXF/DWG em lote
        </button>
        <button onClick={() => onBatch('associate')}>Associar máscaras</button>
      </div>
      <p>
        Ativa para desenhar:{' '}
        <b>{project.masks.find((m) => m.id === activeId)?.name ?? 'Nenhuma'}</b>
        . Escolher para consultar propriedades não troca o destino.
      </p>
      <MaskSelector
        project={project}
        value={id}
        onChange={(value) => {
          setId(value);
          setEid('');
        }}
        label="Máscara do projeto"
      />
      {m && (
        <>
          {!drawState.editable && (
            <p className="field-help" role="note">
              {drawState.reason}
            </p>
          )}
          <div className="batch-actions">
            <button
              disabled={!ready}
              onClick={() => {
                if (onOffset(m.id)) onClose();
              }}
            >
              Usar esta máscara e Offset
            </button>
            {(['mirror', 'copy', 'erase'] as const).map((mode) => (
              <button
                key={mode}
                disabled={!ready}
                onClick={() => {
                  if (onManipulate(mode, m.id, eid || undefined)) onClose();
                }}
              >
                {mode === 'copy'
                  ? 'Usar esta máscara e Copiar entidades'
                  : mode === 'mirror'
                    ? 'Usar esta máscara e Espelhar entidades'
                    : 'Usar esta máscara e Apagar entidades'}
              </button>
            ))}
            {(['trim', 'extend'] as const).map((mode) => (
              <button
                key={mode}
                disabled={!ready}
                onClick={() => {
                  if (onCadEdit(mode, m.id, eid || undefined)) onClose();
                  else
                    setError(
                      'Edição CAD bloqueada: confira o alvo, contexto e layers.',
                    );
                }}
              >
                Usar esta máscara e{' '}
                {mode === 'trim'
                  ? 'Ajustar (Aparar / Trim)'
                  : 'Estender (Extend)'}
              </button>
            ))}
          </div>
          <button
            disabled={!ready}
            onClick={() => {
              if (onCalibrate(m.id)) onClose();
              else
                setError(
                  'Ajuste de escala bloqueado. Confira a visibilidade, os layers e o contexto da referência; nenhuma alteração foi aplicada.',
                );
            }}
          >
            Ajustar escala desta máscara por 2 pontos
          </button>
          <button
            onClick={() => {
              if (onSelect(m.id)) onClose();
            }}
          >
            Propriedades da máscara
          </button>
          <p>
            {m.format} ·{' '}
            {detailPath(project, project.hierarchy.objectDetails[m.id])} · [
            {m.id.slice(0, 8)}]
          </p>
          <button
            onClick={() =>
              run(() => {
                if (onActivate(m.id)) onClose();
              })
            }
          >
            Ativar esta máscara e desenhar
          </button>
        </>
      )}
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          if (submitting.current) return;
          run(() => {
            if (!creationReady)
              throw new Error('Abra o contexto de criação antes de confirmar.');
            submitting.current = true;
            try {
              onCreate(name, creationOwner, project);
              onClose();
            } catch (e) {
              submitting.current = false;
              throw e;
            }
          });
        }}
      >
        <label className="field">
          Nome da nova máscara
          <input
            aria-label="Nome da nova máscara"
            value={name}
            maxLength={200}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="field">
          Criar no detalhamento
          <select
            aria-label="Contexto da nova máscara"
            value={creationOwner}
            onChange={(e) => setCreationOwner(e.target.value)}
          >
            {project.hierarchy.details.map((d) => (
              <option key={d.id} value={d.id}>
                {detailPath(project, d.id)}
              </option>
            ))}
          </select>
        </label>
        {!creationReady && (
          <p>
            O destino está em outro contexto.{' '}
            <button type="button" onClick={() => onOpenContext(creationOwner)}>
              Abrir contexto de criação
            </button>
          </p>
        )}
        <button disabled={!creationReady}>Criar máscara nativa</button>
      </form>
      {m && (
        <>
          {!ready && (
            <p>
              Abra o contexto para editar.{' '}
              <button
                onClick={() =>
                  onOpenContext(project.hierarchy.objectDetails[m.id])
                }
              >
                Abrir contexto desta máscara
              </button>
            </p>
          )}
          <fieldset disabled={!ready} className="mask-properties">
            <label className="field">
              Nome da máscara
              <input
                aria-label="Nome da máscara"
                value={m.name}
                onChange={(e) => {
                  if (e.target.value.trim())
                    change({ ...m, name: e.target.value.slice(0, 200) });
                }}
              />
            </label>
            <p>
              {m.format === 'NATIVE'
                ? 'Desenho nativo em mm, sem aço.'
                : 'Referência importada; arquivo original preservado.'}
            </p>
            <button onClick={() => change({ ...m, visible: !m.visible })}>
              {m.visible ? 'Ocultar máscara' : 'Mostrar máscara'}
            </button>
            <button
              onClick={() => {
                if (
                  window.confirm(
                    `Excluir máscara “${m.name}” e suas entidades? Armaduras serão preservadas.`,
                  )
                ) {
                  if (!onDelete(m.id)) {
                    setError(
                      'Exclusão bloqueada. Confira o contexto, a visibilidade e os layers.',
                    );
                    return;
                  }
                  {
                    setId('');
                    setEid('');
                  }
                }
              }}
            >
              Excluir máscara
            </button>
          </fieldset>
          <p>
            {m.format !== 'NATIVE'
              ? `${m.primitives.filter((q) => !q.native).length} entidades normalizadas de referência. Ajustar/Estender editam a cópia local; o arquivo CAD original é preservado.`
              : 'Entidades nativas editáveis.'}{' '}
            Cotas têm pontos estáticos: revise-as após copiar/apagar a
            referência. Armaduras permanecem independentes.
          </p>
          <fieldset
            disabled={!ready || !drawState.editable}
            className="mask-properties"
          >
            {
              <>
                <label className="field">
                  Entidade
                  <select
                    aria-label="Entidade da máscara"
                    value={eid}
                    onChange={(ev) => setEid(ev.target.value)}
                  >
                    <option value="">Selecionar entidade</option>
                    {m.primitives
                      .filter((p) => p.native)
                      .map((p, i) => (
                        <option key={p.id} value={p.id}>
                          {i + 1} ·{' '}
                          {p.native
                            ? {
                                line: 'Linha',
                                rectangle: 'Retângulo',
                                circle: 'Círculo',
                                arc: 'Arco',
                                polyline: 'Polilinha',
                              }[p.native.kind]
                            : ''}{' '}
                          · {p.layer}
                        </option>
                      ))}
                  </select>
                </label>
                {e && (
                  <>
                    <p>
                      Eixos da máscara · mm do modelo (escala já considerada) ·{' '}
                      {shape
                        ? {
                            line: 'Linha',
                            rectangle: 'Retângulo',
                            circle: 'Círculo',
                            arc: 'Arco',
                            polyline: 'Polilinha',
                          }[shape.kind]
                        : ''}
                    </p>
                    {shape?.kind === 'circle' || shape?.kind === 'arc' ? (
                      <>
                        {shape.kind === 'arc' &&
                          (['startAngle', 'sweepAngle'] as const).map((key) => (
                            <label className="field" key={key}>
                              {key === 'startAngle'
                                ? 'Ângulo inicial (°)'
                                : 'Abertura orientada (°)'}
                              <input
                                aria-label={
                                  key === 'startAngle'
                                    ? 'Ângulo inicial do arco'
                                    : 'Abertura do arco'
                                }
                                type="number"
                                step="any"
                                value={shape[key]}
                                onChange={(ev) =>
                                  setRaw(
                                    JSON.stringify({
                                      ...shape,
                                      [key]: Number(ev.target.value),
                                    }),
                                  )
                                }
                              />
                            </label>
                          ))}
                        {pointFields([shape.center], (v) =>
                          setRaw(JSON.stringify({ ...shape, center: v[0] })),
                        )}
                        <label className="field">
                          Raio (mm)
                          <input
                            aria-label="Raio da entidade"
                            type="number"
                            value={shape.radius}
                            onChange={(ev) =>
                              setRaw(
                                JSON.stringify({
                                  ...shape,
                                  radius: Number(ev.target.value),
                                }),
                              )
                            }
                          />
                        </label>
                      </>
                    ) : (
                      shape && (
                        <>
                          {pointFields(shape.points, (v) =>
                            setRaw(JSON.stringify({ ...shape, points: v })),
                          )}
                          {shape.kind === 'polyline' && (
                            <>
                              <label>
                                <input
                                  type="checkbox"
                                  checked={shape.closed}
                                  onChange={(ev) =>
                                    setRaw(
                                      JSON.stringify({
                                        ...shape,
                                        closed: ev.target.checked,
                                      }),
                                    )
                                  }
                                />
                                Polilinha fechada
                              </label>
                              <button
                                onClick={() =>
                                  setRaw(
                                    JSON.stringify({
                                      ...shape,
                                      points: [
                                        ...shape.points,
                                        {
                                          x: shape.points.at(-1)!.x + 100,
                                          y: shape.points.at(-1)!.y,
                                        },
                                      ],
                                    }),
                                  )
                                }
                              >
                                Adicionar vértice
                              </button>
                              <button
                                disabled={shape.points.length <= 2}
                                onClick={() =>
                                  setRaw(
                                    JSON.stringify({
                                      ...shape,
                                      points: shape.points.slice(0, -1),
                                    }),
                                  )
                                }
                              >
                                Remover último vértice
                              </button>
                            </>
                          )}
                        </>
                      )
                    )}
                    <button
                      onClick={() =>
                        run(() => {
                          const s = scaleNativeShape(
                            JSON.parse(raw) as NativeShape,
                            1 / m.scale,
                          );
                          const replacement = nativePrimitive(s, e.id, e.layer);
                          change({
                            ...m,
                            primitives: m.primitives.map((p) =>
                              p.id === e.id ? { ...p, ...replacement } : p,
                            ),
                          });
                        })
                      }
                    >
                      Aplicar geometria
                    </button>
                    <label className="field">
                      Layer nativo
                      <select
                        aria-label="Layer da entidade"
                        value={e.layerId ?? ''}
                        onChange={(ev) =>
                          change({
                            ...m,
                            primitives: m.primitives.map((p) =>
                              p.id === eid
                                ? {
                                    ...p,
                                    layerId: ev.target.value || undefined,
                                  }
                                : p,
                            ),
                          })
                        }
                      >
                        <option value="">Herdar da máscara</option>
                        {project.layers.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="fields-2">
                      {[
                        ['Deslocamento X', dx, setDx],
                        ['Deslocamento Y', dy, setDy],
                        ['Ângulo em graus', angle, setAngle],
                      ].map(([label, value, set]) => (
                        <label className="field" key={String(label)}>
                          {String(label)}
                          <input
                            aria-label={String(label)}
                            type="number"
                            value={Number(value)}
                            onChange={(ev) =>
                              (set as (v: number) => void)(
                                Number(ev.target.value),
                              )
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <p>
                      Rotação nos eixos da máscara em torno de (0, 0), seguida
                      de translação em mm do modelo. Copiar cria apenas outra
                      entidade gráfica.
                    </p>
                    {['Mover / girar entidade', 'Copiar entidade'].map(
                      (label, i) => (
                        <button
                          key={label}
                          onClick={() =>
                            run(() => {
                              if (
                                !e.native ||
                                ![dx, dy, angle].every(Number.isFinite)
                              )
                                throw new Error('Transformação inválida.');
                              const t = (angle * Math.PI) / 180;
                              const tr = (p: { x: number; y: number }) => ({
                                x:
                                  p.x * Math.cos(t) -
                                  p.y * Math.sin(t) +
                                  dx / m.scale,
                                y:
                                  p.x * Math.sin(t) +
                                  p.y * Math.cos(t) +
                                  dy / m.scale,
                              });
                              const s: NativeShape =
                                e.native.kind === 'circle' ||
                                e.native.kind === 'arc'
                                  ? {
                                      ...e.native,
                                      center: tr(e.native.center),
                                      ...(e.native.kind === 'arc'
                                        ? {
                                            startAngle:
                                              (((e.native.startAngle + angle) %
                                                360) +
                                                360) %
                                              360,
                                          }
                                        : {}),
                                    }
                                  : {
                                      kind: 'polyline',
                                      points: e.points.map(tr),
                                      closed: !!e.closed,
                                    };
                              const next = nativePrimitive(
                                s,
                                i ? undefined : e.id,
                                e.layer,
                              );
                              change({
                                ...m,
                                primitives: i
                                  ? [...m.primitives, { ...e, ...next }]
                                  : m.primitives.map((p) =>
                                      p.id === eid ? { ...p, ...next } : p,
                                    ),
                              });
                            })
                          }
                        >
                          {label}
                        </button>
                      ),
                    )}
                    <button
                      onClick={() =>
                        run(() => {
                          const ref = maskCadEntities(project, context).find(
                            (entity) =>
                              entity.mask.id === m.id && entity.ref.id === eid,
                          )?.ref;
                          const next = applyMaskManipulation(
                            project,
                            previewMaskManipulation(
                              project,
                              m.id,
                              ref ? [ref] : [],
                              'erase',
                              context,
                            ),
                            context,
                          );
                          if (
                            change(next.masks.find((mask) => mask.id === m.id)!)
                          )
                            setEid('');
                        })
                      }
                    >
                      Excluir entidade
                    </button>
                  </>
                )}
              </>
            }
          </fieldset>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="modal-actions">
        <button onClick={onClose}>Concluir controle de máscaras</button>
      </div>
    </dialog>
  );
}
