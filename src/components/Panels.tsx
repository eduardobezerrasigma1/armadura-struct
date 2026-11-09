import { dimensionReferenceIssue } from '../domain/maskDimensions';
import LayerInspector from './LayerInspector';
import { resolveStyle } from '../domain/layers';
import {
  quantityLabel,
  barQuantities,
  detailTitle,
  barSearchText,
  assemblyLabel,
  quantitySourceLabel,
  quantityExpression,
} from '../domain/detailQuantities';
import { annotationError } from '../domain/drafting';
import HierarchyNavigator from './HierarchyNavigator';
import { toggleDetailSelection } from '../domain/detailEditing';
import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  FileStack,
  Layers,
  LockKeyhole,
  Plus,
  Settings2,
  Shapes,
  Trash2,
  Unlink,
} from 'lucide-react';
import { distance, format, geometry, path, bounds } from '../domain/geometry';
import {
  schedule,
  scheduleChanged,
  scheduleQuantityLabel,
} from '../domain/model';
import type {
  Annotation,
  DraftPolyline,
  Bar,
  Mask,
  Project,
} from '../domain/types';
export function NumberField({
  label,
  compactLabel,
  value,
  onChange,
  min = -1e9,
  max = 1e9,
  step = 'any',
  suffix,
  disabled = false,
}: {
  label: string;
  compactLabel?: string;
  value: number;
  onChange: (n: number) => void | boolean;
  min?: number;
  max?: number;
  step?: number | 'any';
  suffix?: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState(String(value));
  const cancelled = useRef(false);
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false;
      setText(String(value));
      return;
    }
    const n = Number(text.replace(',', '.'));
    if (
      text.trim() &&
      Number.isFinite(n) &&
      n >= min &&
      n <= max &&
      (step !== 1 || Number.isInteger(n))
    ) {
      if (n !== value && onChange(n) === false) setText(String(value));
    } else setText(String(value));
  };
  return (
    <label className="field">
      <span>{compactLabel ?? label}</span>
      <div className="input-suffix">
        <input
          aria-label={label}
          disabled={disabled}
          value={text}
          inputMode="decimal"
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              cancelled.current = true;
              setText(String(value));
              e.currentTarget.blur();
            }
          }}
        />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  );
}
export function TextField({
  label,
  value,
  onChange,
  maxLength = 150,
  allowEmpty = false,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  maxLength?: number;
  allowEmpty?: boolean;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <label className="field">
      <span>{label}</span>
      <input
        aria-label={label}
        maxLength={maxLength}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if ((text.trim() || allowEmpty) && text.trim() !== value)
            onChange(text.trim());
          setText(value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </label>
  );
}
export function ShapePreview({ bar }: { bar: Bar }) {
  const g = geometry(bar),
    b = bounds(g.vertices),
    pad = Math.max(b.width, b.height) * 0.15 + 10;
  return (
    <svg
      className="shape-preview"
      viewBox={`${b.x - pad} ${-b.y - b.height - pad} ${b.width + 2 * pad} ${b.height + 2 * pad}`}
      aria-hidden="true"
    >
      <g transform="scale(1 -1)">
        <path
          d={path(g.segments)}
          fill="none"
          stroke={bar.color}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </g>
    </svg>
  );
}
function Section({
  title,
  children,
  initial = true,
}: {
  title: string;
  children: React.ReactNode;
  initial?: boolean;
}) {
  const [open, setOpen] = useState(initial);
  return (
    <section className="property-section">
      <button className="section-title" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />} {title}
      </button>
      {open && <div className="section-body">{children}</div>}
    </section>
  );
}
export function Inspector({
  bar,
  mask,
  onBar,
  onDistributionSpacing,
  onVertexEdit,
  onDimensionEdit,
  onMask,
  onSelectRepresentation,
  onRemoveDetails,
  project,
  onProject,
}: {
  bar?: Bar;
  mask?: Mask;
  onBar: (patch: Partial<Bar>) => void | boolean;
  onVertexEdit?: (mode: 'insert' | 'extend' | 'remove') => void;
  onDimensionEdit?: (mode: 'segment' | 'lengthen') => void;
  onDistributionSpacing: (spacing: number) => void | boolean;
  onMask: (patch: Partial<Mask>) => void;
  onSelectRepresentation?: (id: string) => void;
  onRemoveDetails: () => void;
  project: Project;
  onProject: (patch: Partial<Project>) => void;
}) {
  const g = bar ? geometry(bar) : null;
  return (
    <aside className="inspector">
      <div className="panel-heading">
        <Settings2 size={15} />
        <b>Propriedades</b>
        <span>{bar ? 'ARMADURA' : mask ? 'MÁSCARA' : 'PROJETO'}</span>
      </div>
      <div className="panel-scroll">
        {(bar || mask) && (
          <Section title="Layer e estilo" initial={false}>
            <LayerInspector
              project={project}
              object={bar ?? mask!}
              role={bar ? 'ARMADURAS' : 'MASCARA'}
              onChange={(patch) => (bar ? onBar(patch) : onMask(patch))}
            />
          </Section>
        )}
        {bar ? (
          <>
            <div className="object-heading">
              <span style={{ background: bar.color }}>{bar.mark}</span>
              <div>
                <b>
                  {bar.kind === 'stirrup'
                    ? 'Estribo retangular'
                    : 'Barra livre'}
                </b>
                <small>{bar.element}</small>
              </div>
            </div>
            <div className="preview-card">
              <ShapePreview bar={bar} />
              <div>
                <small>COMPRIMENTO UNITÁRIO</small>
                <strong>
                  {g!.errors.length ? 'Revisar' : format(g!.length / 1000, 3)}{' '}
                  <em>m</em>
                </strong>
              </div>
            </div>
            {!!g!.errors.length && (
              <div className="inline-warning" role="alert">
                <AlertTriangle size={15} />
                <span>{g!.errors.join(' ')}</span>
              </div>
            )}
            <Section title="Identificação">
              <TextField
                label="Posição"
                maxLength={40}
                value={bar.mark}
                onChange={(mark) => onBar({ mark })}
              />
              <TextField
                label="Descrição da posição"
                maxLength={100}
                allowEmpty
                value={bar.element}
                onChange={(element) => onBar({ element })}
              />
              <div className="fields-2">
                <label className="field">
                  <span>Aço</span>
                  <select
                    aria-label="Aço"
                    value={bar.steel}
                    onChange={(e) =>
                      onBar({ steel: e.target.value as Bar['steel'] })
                    }
                  >
                    <option>CA-50</option>
                    <option>CA-60</option>
                  </select>
                </label>
                <label className="field">
                  <span>Bitola (mm)</span>
                  <select
                    aria-label="Bitola (mm)"
                    value={bar.diameter}
                    onChange={(e) =>
                      onBar({ diameter: Number(e.target.value) })
                    }
                  >
                    {[
                      4.2,
                      5,
                      6.3,
                      8,
                      10,
                      12.5,
                      16,
                      20,
                      22,
                      25,
                      32,
                      40,
                      ...(![
                        4.2, 5, 6.3, 8, 10, 12.5, 16, 20, 22, 25, 32, 40,
                      ].includes(bar.diameter)
                        ? [bar.diameter]
                        : []),
                    ].map((n) => (
                      <option key={n} value={n}>
                        Ø {format(n, n % 1 ? 1 : 0)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="fields-2">
                <NumberField
                  label="Quantidade"
                  compactLabel="Peças por grupo"
                  disabled={
                    bar.quantitySource?.kind === 'distribution' &&
                    bar.quantitySource.mode === 'spacing'
                  }
                  min={bar.distribution ? 2 : 1}
                  max={100000}
                  step={1}
                  value={bar.quantity}
                  onChange={(quantity) => onBar({ quantity })}
                />
                <label className="field">
                  <span>Cor da posição</span>
                  <input
                    type="color"
                    aria-label="Cor da posição"
                    value={resolveStyle(project, bar, 'ARMADURAS').color}
                    onChange={(e) =>
                      onBar({
                        color: e.target.value,
                        style: { ...bar.style, color: e.target.value },
                      })
                    }
                  />
                </label>
              </div>
            </Section>
            <Section title="Composição da quantidade">
              <div className="fields-2">
                <NumberField
                  label="Multiplicador da armadura"
                  compactLabel="Grupos da armadura"
                  value={bar.multiplier ?? 1}
                  min={1}
                  max={10000}
                  step={1}
                  onChange={(multiplier) => onBar({ multiplier })}
                />
                <label className="field">
                  <span>Descrição da quantidade</span>
                  <select
                    aria-label="Descrição da quantidade"
                    value={bar.quantityDisplay ?? 'factored'}
                    onChange={(e) =>
                      onBar({
                        quantityDisplay: e.target.value as 'factored' | 'total',
                      })
                    }
                  >
                    <option value="factored">Fatorada</option>
                    <option value="total">Total efetivo</option>
                  </select>
                </label>
              </div>
              <label className="field">
                <span>Origem da quantidade base</span>
                <select
                  aria-label="Origem da quantidade base"
                  value={
                    bar.quantitySource?.kind === 'distribution'
                      ? bar.quantitySource.mode
                      : 'manual'
                  }
                  onChange={(e) =>
                    onBar({
                      quantitySource:
                        e.target.value === 'manual'
                          ? { kind: 'manual' }
                          : e.target.value === 'quantity'
                            ? { kind: 'distribution', mode: 'quantity' }
                            : {
                                kind: 'distribution',
                                mode: 'spacing',
                                spacing:
                                  distance(
                                    bar.distribution!.start ?? bar.origin,
                                    bar.distribution!.end,
                                  ) / Math.max(1, bar.quantity - 1),
                              },
                    })
                  }
                >
                  <option value="manual">Manual</option>
                  <option value="quantity" disabled={!bar.distribution}>
                    Faixa · quantidade fixa
                  </option>
                  <option value="spacing" disabled={!bar.distribution}>
                    Faixa · espaçamento máximo
                  </option>
                </select>
              </label>
              <p className="field-help" data-testid="bar-effective-quantity">
                Base {bar.quantity} × {bar.multiplier ?? 1} grupos ×{' '}
                {barQuantities(project, bar).repetitions} repetições do detalhe
                = <b>{barQuantities(project, bar).quantity} peças efetivas</b>.
                Por detalhe: {barQuantities(project, bar).perDetailQuantity}.
                Origem: {quantitySourceLabel(bar.quantitySource)}.
              </p>
            </Section>
            <details className="assembly-fields">
              <summary>Montagem · nervura, observação e lance</summary>
              <TextField
                label="Observação da armadura"
                value={bar.comment ?? ''}
                maxLength={500}
                allowEmpty
                onChange={(comment) => onBar({ comment })}
              />
              <TextField
                label="Referência ao lance"
                value={bar.columnLevel ?? ''}
                maxLength={100}
                allowEmpty
                onChange={(columnLevel) => onBar({ columnLevel })}
              />
              <label className="transfer-checkbox">
                <input
                  type="checkbox"
                  aria-label="Armadura por nervura"
                  checked={bar.ribbed ?? false}
                  onChange={(e) => onBar({ ribbed: e.target.checked })}
                />
                Armadura por nervura
              </label>
              <label className="transfer-checkbox">
                <input
                  type="checkbox"
                  aria-label="Mostrar indicação por nervura"
                  checked={bar.showRibbed ?? false}
                  onChange={(e) => onBar({ showRibbed: e.target.checked })}
                />
                Mostrar C/NERV na descrição
              </label>
              <p className="field-help">
                Nervura, observação e lance identificam a montagem. Estes campos
                não acrescentam peças nem verificam o dimensionamento.
              </p>
            </details>
            <details className="manufacturing-fields">
              <summary>Fabricação · terminações e variante</summary>
              <label className="field">
                <span>Variante de fabricação</span>
                <input
                  aria-label="Variante de fabricação"
                  maxLength={100}
                  value={bar.manufacturing?.variant ?? ''}
                  onChange={(e) =>
                    onBar({
                      manufacturing: {
                        ...bar.manufacturing,
                        variant: e.target.value,
                      },
                    })
                  }
                />
              </label>
              {(['start', 'end'] as const).map((end) => (
                <div key={end}>
                  <label className="field">
                    <span>
                      {end === 'start' ? 'Início' : 'Fim'} · especificação (ex.:
                      LUVA-M20)
                    </span>
                    <input
                      aria-label={`Especificação de fabricação ${end === 'start' ? 'início' : 'fim'}`}
                      maxLength={100}
                      value={bar.manufacturing?.[end]?.code ?? ''}
                      onChange={(e) =>
                        onBar({
                          manufacturing: {
                            ...bar.manufacturing,
                            [end]: {
                              kind: e.target.value
                                ? bar.manufacturing?.[end]?.kind ===
                                    'threaded' ||
                                  bar.manufacturing?.[end]?.kind === 'headed'
                                  ? bar.manufacturing[end]!.kind
                                  : 'coupler'
                                : 'plain',
                              code: e.target.value,
                            },
                          },
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Tipo da terminação</span>
                    <select
                      aria-label={`Tipo de terminação ${end === 'start' ? 'início' : 'fim'}`}
                      disabled={!bar.manufacturing?.[end]?.code}
                      value={bar.manufacturing?.[end]?.kind ?? 'plain'}
                      onChange={(e) =>
                        onBar({
                          manufacturing: {
                            ...bar.manufacturing,
                            [end]: {
                              kind: e.target.value as
                                | 'plain'
                                | 'coupler'
                                | 'threaded'
                                | 'headed',
                              code:
                                e.target.value === 'plain'
                                  ? ''
                                  : (bar.manufacturing?.[end]?.code ?? ''),
                            },
                          },
                        })
                      }
                    >
                      <option value="plain">Livre</option>
                      <option value="coupler">Luva</option>
                      <option value="threaded">Rosca</option>
                      <option value="headed">Cabeça</option>
                    </select>
                  </label>
                </div>
              ))}
              <p className="field-help">
                O código identifica a terminação/luva. Não acrescenta
                comprimento nem verifica resistência. Ganchos continuam
                definidos na geometria. Editar uma peça pode separá-la da
                posição compartilhada.
              </p>
            </details>
            <Section title="Geometria e dobras">
              {bar.kind === 'stirrup' && (
                <>
                  <div className="fields-2">
                    <NumberField
                      label="Largura no eixo"
                      value={bar.width}
                      min={1}
                      onChange={(width) => onBar({ width })}
                      suffix="mm"
                    />
                    <NumberField
                      label="Altura no eixo"
                      value={bar.height}
                      min={1}
                      onChange={(height) => onBar({ height })}
                      suffix="mm"
                    />
                  </div>
                  <NumberField
                    label="Prolongamento reto do gancho"
                    value={bar.hook}
                    min={0}
                    onChange={(hook) => onBar({ hook })}
                    suffix="mm"
                  />
                </>
              )}
              <NumberField
                label="Diâmetro interno da dobra"
                min={1}
                max={2000}
                value={bar.mandrel}
                onChange={(mandrel) => onBar({ mandrel })}
                suffix="mm"
              />
              <p className="field-help">
                Comprimento pelo eixo, descontando os trechos retos substituídos
                pelos arcos. Mandril definido pelo projetista.
              </p>
              {bar.kind === 'free' && onDimensionEdit && (
                <div className="visibility-actions">
                  <button onClick={() => onDimensionEdit?.('segment')}>
                    Comprimentos e ângulos
                  </button>
                  <button onClick={() => onDimensionEdit?.('lengthen')}>
                    Estender barra
                  </button>
                </div>
              )}
              {bar.kind === 'free' && (
                <details className="vertices-editor">
                  <summary>Vértices locais · mm</summary>
                  {onVertexEdit && <VertexCommands onAction={onVertexEdit} />}
                  {bar.points.map((pt, i) => (
                    <div key={i} className="vertex-row">
                      <span>{i + 1}</span>
                      <NumberField
                        label={`X do vértice ${i + 1}`}
                        value={pt.x}
                        onChange={(x) =>
                          onBar({
                            points: bar.points.map((p, j) =>
                              j === i ? { ...p, x } : p,
                            ),
                          })
                        }
                      />
                      <NumberField
                        label={`Y do vértice ${i + 1}`}
                        value={pt.y}
                        onChange={(y) =>
                          onBar({
                            points: bar.points.map((p, j) =>
                              j === i ? { ...p, y } : p,
                            ),
                          })
                        }
                      />
                    </div>
                  ))}
                </details>
              )}
            </Section>
            {bar.distribution && (
              <Section title="Distribuição vinculada">
                <label className="field">
                  <span>Representação</span>
                  <select
                    aria-label="Representação da faixa"
                    value={bar.distribution.render ?? 'ticks'}
                    onChange={(e) =>
                      onBar({
                        distribution: {
                          ...bar.distribution!,
                          render: e.target.value as 'ticks' | 'bars',
                        },
                      })
                    }
                  >
                    <option value="ticks">Faixa por traços</option>
                    <option value="bars">Geometria repetida</option>
                  </select>
                </label>
                <NumberField
                  label="Espaçamento máximo"
                  min={1}
                  value={
                    bar.quantitySource?.kind === 'distribution' &&
                    bar.quantitySource.mode === 'spacing'
                      ? bar.quantitySource.spacing
                      : distance(
                          bar.distribution.start ?? bar.origin,
                          bar.distribution.end,
                        ) /
                        (bar.quantity - 1)
                  }
                  suffix="mm"
                  onChange={onDistributionSpacing}
                />
                <p className="field-help">
                  Inclui as duas extremidades. Ao ajustar o espaçamento, a
                  quantidade é arredondada para cima.
                </p>
                <button
                  className="text-button"
                  onClick={() => onBar({ distribution: undefined })}
                >
                  <Unlink size={13} /> Remover distribuição
                </button>
              </Section>
            )}
            <Section title="Posicionamento" initial={false}>
              <div className="fields-2">
                <NumberField
                  label="X da origem"
                  value={bar.origin.x}
                  onChange={(x) => onBar({ origin: { ...bar.origin, x } })}
                  suffix="mm"
                />
                <NumberField
                  label="Y da origem"
                  value={bar.origin.y}
                  onChange={(y) => onBar({ origin: { ...bar.origin, y } })}
                  suffix="mm"
                />
              </div>
              <NumberField
                label="Rotação"
                value={bar.rotation}
                onChange={(rotation) => onBar({ rotation })}
                suffix="°"
              />
            </Section>
            {project.details.some((d) => d.barId === bar.id) && (
              <Section title="Rebatimentos">
                {project.details
                  .filter((d) => d.barId === bar.id)
                  .map((d, i) => (
                    <button
                      key={d.id}
                      onClick={() => onSelectRepresentation?.(d.id)}
                    >
                      Editar inserção {i + 1}
                    </button>
                  ))}
                {project.details
                  .filter((d) => d.barId === bar.id)
                  .map((d, i) => (
                    <div className="fields-2" key={d.id}>
                      <NumberField
                        label={`X do rebatimento ${i + 1}`}
                        value={d.origin.x}
                        suffix="mm"
                        onChange={(x) =>
                          onProject({
                            details: project.details.map((v) =>
                              v.id === d.id
                                ? { ...v, origin: { ...v.origin, x } }
                                : v,
                            ),
                          })
                        }
                      />
                      <NumberField
                        label={`Y do rebatimento ${i + 1}`}
                        value={d.origin.y}
                        suffix="mm"
                        onChange={(y) =>
                          onProject({
                            details: project.details.map((v) =>
                              v.id === d.id
                                ? { ...v, origin: { ...v.origin, y } }
                                : v,
                            ),
                          })
                        }
                      />
                    </div>
                  ))}
                <div className="detail-info">
                  <Layers size={15} />
                  <span>
                    Rebatimento vinculado à posição.
                    <button onClick={onRemoveDetails}>
                      Remover rebatimentos
                    </button>
                  </span>
                </div>
              </Section>
            )}
          </>
        ) : mask ? (
          <>
            <div className="mask-heading">
              <FileStack size={27} />
              <b>{mask.name}</b>
              <small>
                {mask.format === 'NATIVE' ? 'Nativa' : mask.format} ·{' '}
                {mask.primitives.length.toLocaleString('pt-BR')} entidades
              </small>
            </div>
            <Section title="Referência de desenho">
              <div className="readonly-label">
                <LockKeyhole size={13} />{' '}
                {mask.format === 'NATIVE'
                  ? 'Entidades editáveis em Controle de máscaras'
                  : 'Referência importada protegida de edição'}
              </div>
              <label className="field">
                <span>Opacidade · {Math.round(mask.opacity * 100)}%</span>
                <input
                  type="range"
                  min="0.05"
                  max="1"
                  step="0.05"
                  value={mask.opacity}
                  onChange={(e) => onMask({ opacity: Number(e.target.value) })}
                  aria-label="Opacidade"
                />
              </label>
              {mask.format !== 'NATIVE' && (
                <label className="field">
                  <span>Unidade de origem</span>
                  <select
                    aria-label="Unidade da máscara"
                    value={mask.scale}
                    onChange={(e) => onMask({ scale: Number(e.target.value) })}
                  >
                    <option value={1}>Milímetros · 1:1</option>
                    <option value={10}>Centímetros · ×10</option>
                    <option value={1000}>Metros · ×1000</option>
                    <option value={25.4}>Polegadas · ×25,4</option>
                    {![1, 10, 1000, 25.4].includes(mask.scale) && (
                      <option value={mask.scale}>
                        Personalizada · ×{mask.scale}
                      </option>
                    )}
                  </select>
                </label>
              )}
              <NumberField
                label="Fator de escala"
                min={0.000001}
                max={1000000}
                value={mask.scale}
                onChange={(scale) => onMask({ scale })}
              />
              {mask.format !== 'NATIVE' && (
                <p className="field-help">
                  Unidade declarada no arquivo: {mask.sourceUnit}. Confirme com
                  a ferramenta Medir.
                </p>
              )}
              <div className="fields-2">
                <NumberField
                  label="X da máscara"
                  value={mask.origin.x}
                  onChange={(x) => onMask({ origin: { ...mask.origin, x } })}
                />
                <NumberField
                  label="Y da máscara"
                  value={mask.origin.y}
                  onChange={(y) => onMask({ origin: { ...mask.origin, y } })}
                />
              </div>
              <NumberField
                label="Rotação da máscara"
                value={mask.rotation}
                onChange={(rotation) => onMask({ rotation })}
                suffix="°"
              />
            </Section>
            <Section title="Camadas">
              {Object.entries(mask.layers).map(([l, v]) => (
                <label key={l} className="layer-toggle">
                  <input
                    type="checkbox"
                    checked={v}
                    onChange={() =>
                      onMask({ layers: { ...mask.layers, [l]: !v } })
                    }
                  />
                  <Layers size={12} />
                  <span>{l}</span>
                </label>
              ))}
            </Section>
            {!!mask.warnings.length && (
              <Section title="Relatório de importação">
                <div className="import-warnings">
                  {mask.warnings.map((w, i) => (
                    <p key={i}>
                      <AlertTriangle size={12} />
                      {w}
                    </p>
                  ))}
                </div>
              </Section>
            )}
          </>
        ) : (
          <>
            <div className="object-heading">
              <span className="neutral">
                <Shapes size={20} />
              </span>
              <div>
                <b>Dados do projeto</b>
                <small>Selecione uma armadura para editar.</small>
              </div>
            </div>
            <Section title="Projeto">
              <TextField
                label="Nome do projeto"
                value={project.name}
                onChange={(name) => onProject({ name })}
              />
              <TextField
                label="Responsável"
                allowEmpty
                value={project.author}
                onChange={(author) => onProject({ author })}
              />
            </Section>
            <Section title="Desenho / prancha">
              <p className="field-help">
                Pavimentos:{' '}
                {project.hierarchy.floors.map((f) => f.name).join(', ')}. Edite
                a organização na aba Projeto.
              </p>
              <TextField
                label="Revisão"
                value={project.drawing.revision}
                allowEmpty
                maxLength={40}
                onChange={(revision) =>
                  onProject({ drawing: { ...project.drawing, revision } })
                }
              />
              <p className="field-help">
                Defina o formato da folha e a escala de cada vista na aba
                Pranchas.
              </p>
              <TextField
                label="Comentários"
                value={project.notes}
                allowEmpty
                maxLength={5000}
                onChange={(notes) => onProject({ notes })}
              />
            </Section>
            <div className="help-card">
              <b>Precisão desde o primeiro ponto</b>
              <p>
                Digite coordenadas na linha de comando. Use{' '}
                <code>1000,500</code> ou <code>@500,0</code> para deslocamentos
                relativos.
              </p>
              <p>
                <kbd>Enter</kbd> conclui a barra. <kbd>Esc</kbd> cancela o
                comando.
              </p>
            </div>
          </>
        )}
      </div>
      <div className="panel-foot">GEOMETRIA REAL · DADOS VINCULADOS</div>
    </aside>
  );
}
export function ProjectTree({
  project,
  selected,
  maskId,
  onSelect,
  onMask,
  onToggleMask,
  onRemoveMask,
  onImport,
  onDemo,
  activeDetailId,
  onActiveDetail,
  onHierarchy,
  isolatedDetailId,
  onEditDetail,
  onSelectDetail,
  onOpenDrawing,
  onOrganizeHierarchy,
}: {
  project: Project;
  selected: string[];
  maskId: string | null;
  onSelect: (ids: string[]) => void;
  onMask: (id: string) => void;
  onToggleMask: (id: string) => void;
  onRemoveMask: (id: string) => void;
  onImport: () => void;
  onDemo: () => void;
  activeDetailId: string;
  onActiveDetail: (id: string) => void;
  onHierarchy: (project: Project) => void;
  isolatedDetailId?: string;
  onEditDetail: (id: string) => void;
  onSelectDetail: (id: string) => void;
  onOpenDrawing: (id: string) => void;
  onOrganizeHierarchy: () => void;
}) {
  const treeKey = `armadurastruct.contentTree.${project.id}`;
  const [groups, setGroups] = useState<{ bars: boolean; masks: boolean }>(
    () => {
      try {
        const saved = JSON.parse(localStorage.getItem(treeKey) || 'null');
        if (
          typeof saved?.bars === 'boolean' &&
          typeof saved?.masks === 'boolean'
        )
          return saved;
      } catch {
        /* Use expanded groups. */
      }
      return { bars: true, masks: true };
    },
  );
  const barsOpen = groups.bars,
    masksOpen = groups.masks;
  const setBarsOpen = (bars: boolean) =>
    setGroups((current) => ({ ...current, bars }));
  const setMasksOpen = (masks: boolean) =>
    setGroups((current) => ({ ...current, masks }));
  useEffect(() => {
    try {
      localStorage.setItem(treeKey, JSON.stringify(groups));
    } catch {
      /* Optional navigation state. */
    }
  }, [treeKey, groups]);
  const [search, setSearch] = useState('');
  const match = (text: string) =>
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .includes(
        search
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .trim(),
      );
  const owns = (id: string) =>
    project.hierarchy.objectDetails[id] === activeDetailId;
  const bars = project.bars.filter(
    (b) => owns(b.id) && (!search || match(barSearchText(b))),
  );
  const masks = project.masks.filter(
    (m) => owns(m.id) && (!search || match(m.name)),
  );
  const annotations = project.annotations.filter(
    (a) => owns(a.id) && (!search || match(`${a.kind} ${a.label}`)),
  );
  const polylines = project.polylines.filter((l) => owns(l.id));
  const rows = schedule(project),
    valid = rows.filter((r) => !r.errors.length);
  return (
    <aside className="project-tree">
      <div className="panel-heading">
        <Layers size={15} />
        <b>Navegador do projeto</b>
      </div>
      <div className="project-caption">
        <span>PROJETO ATIVO</span>
        <b>{project.name}</b>
        <small>
          {project.bars.length} posições · {project.masks.length} referências
        </small>
      </div>
      <div className="panel-scroll">
        <HierarchyNavigator
          key={project.id}
          project={project}
          activeDetailId={activeDetailId}
          onActive={onActiveDetail}
          onChange={onHierarchy}
          selected={maskId ? [maskId] : selected}
          search={search}
          onSearch={setSearch}
          onEditDetail={onEditDetail}
          onSelectDetail={onSelectDetail}
          onOpenDrawing={onOpenDrawing}
          scopeDetailId={isolatedDetailId}
          onOrganize={onOrganizeHierarchy}
        />
        <p
          className="tree-content-caption"
          title={detailTitle(project, activeDetailId)}
        >
          {detailTitle(project, activeDetailId)}
        </p>
        <button
          className="tree-section"
          onClick={() => setMasksOpen(!masksOpen)}
        >
          {masksOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <FileStack size={14} /> Máscaras <em>{masks.length}</em>
        </button>
        {masksOpen && (
          <>
            <div className="tree-mask-list">
              {masks.map((m) => (
                <div
                  key={m.id}
                  className={`mask-row ${maskId === m.id ? 'selected' : ''}`}
                >
                  <button className="mask-select" onClick={() => onMask(m.id)}>
                    <span className="file-badge">{m.format}</span>
                    <span>{m.name}</span>
                  </button>
                  <button
                    title={m.visible ? 'Ocultar máscara' : 'Mostrar máscara'}
                    aria-label={`${m.visible ? 'Ocultar' : 'Mostrar'} ${m.name}`}
                    onClick={() => onToggleMask(m.id)}
                  >
                    {m.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                  <button
                    title="Remover máscara"
                    aria-label={`Remover ${m.name}`}
                    onClick={() => onRemoveMask(m.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
            <button className="import-tree" onClick={onImport}>
              <Plus size={14} /> Adicionar DXF / DWG
            </button>
          </>
        )}
        <button className="tree-section" onClick={() => setBarsOpen(!barsOpen)}>
          {barsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <Shapes size={14} /> Armaduras <em>{bars.length}</em>
        </button>
        {barsOpen && (
          <div className="bar-list">
            {bars.map((b) => (
              <button
                key={b.id}
                className={`bar-row ${selected.includes(b.id) ? 'selected' : ''}`}
                onClick={(e) =>
                  onSelect(
                    toggleDetailSelection(
                      project,
                      selected,
                      b.id,
                      e.shiftKey,
                      isolatedDetailId,
                    ),
                  )
                }
              >
                <span
                  className="bar-mark"
                  style={{ color: b.color, borderColor: `${b.color}50` }}
                >
                  {b.mark}
                </span>
                <span>
                  <b>
                    {b.kind === 'stirrup' ? 'Estribo' : 'Barra'} Ø
                    {format(b.diameter, b.diameter % 1 ? 1 : 0)}
                  </b>
                  <small>
                    {b.element}
                    {assemblyLabel(b) ? ` · ${assemblyLabel(b)}` : ''}
                  </small>
                </span>
                <em>{quantityLabel(project, b)}</em>
              </button>
            ))}
            {!bars.length && (
              <p className="tree-empty">Suas posições aparecerão aqui.</p>
            )}
          </div>
        )}
        {(polylines.length > 0 || annotations.length > 0) && (
          <>
            <div className="tree-section">
              <Shapes size={14} />
              Desenho e anotações
              <em>{polylines.length + annotations.length}</em>
            </div>
            <div className="draft-object-list">
              {polylines.map((l, i) => (
                <button
                  key={l.id}
                  className={selected.includes(l.id) ? 'selected' : ''}
                  onClick={(e) =>
                    onSelect(
                      toggleDetailSelection(
                        project,
                        selected,
                        l.id,
                        e.shiftKey,
                        isolatedDetailId,
                      ),
                    )
                  }
                >
                  Polilinha {i + 1} · {l.points.length} vértices
                </button>
              ))}
              {annotations.map((a, i) => (
                <button
                  key={a.id}
                  className={selected.includes(a.id) ? 'selected' : ''}
                  onClick={(e) =>
                    onSelect(
                      toggleDetailSelection(
                        project,
                        selected,
                        a.id,
                        e.shiftKey,
                        isolatedDetailId,
                      ),
                    )
                  }
                >
                  {annotationNames[a.kind]} {i + 1}
                  {a.barId
                    ? ` · ${bars.find((b) => b.id === a.barId)?.mark}`
                    : ''}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="tree-note">
          <LockKeyhole size={13} />
          <p>
            As máscaras ficam protegidas. As armaduras permanecem editáveis.
          </p>
        </div>
      </div>
      <div className="tree-summary">
        <span>AÇO DO PROJETO</span>
        <div>
          <strong>
            {format(
              valid.reduce((s, r) => s + r.weight, 0),
              2,
            )}
          </strong>
          <small>kg</small>
        </div>
        <footer>
          <span>{rows.reduce((s, r) => s + r.quantity, 0)} peças</span>
          <span>
            {format(
              valid.reduce((s, r) => s + r.totalLength, 0),
              2,
            )}{' '}
            m
          </span>
        </footer>
        {valid.length !== rows.length && (
          <small className="warning-text">
            Total parcial · geometria a revisar
          </small>
        )}
      </div>
      <button
        className="example-button"
        disabled={!!isolatedDetailId}
        onClick={onDemo}
      >
        Carregar projeto de exemplo
      </button>
    </aside>
  );
}
export function Schedule({
  project,
  onSelect,
}: {
  project: Project;
  onSelect: (id: string) => void;
}) {
  const rows = schedule(project),
    valid = rows.filter((r) => !r.errors.length);
  return (
    <div className="schedule-page">
      <div className="document-intro">
        <span className="eyebrow">DOCUMENTAÇÃO / QUANTITATIVOS</span>
        <h1>
          Quadro de aço
          <span>
            {project.scheduleLock
              ? scheduleChanged(project)
                ? 'Atualização pendente'
                : 'Bloqueado'
              : 'Atualização automática'}
          </span>
        </h1>
        <p>
          Cada posição contabilizada uma vez. Rebatimentos compartilham os
          mesmos dados. Posições equivalentes somam ocorrências sem fundir seus
          elementos. Um asterisco no comprimento indica pequenas diferenças
          dentro da grade de comparação; totais usam cada comprimento real.
        </p>
      </div>
      <div className="schedule-stats">
        <div>
          <span>POSIÇÕES</span>
          <b>{rows.length.toString().padStart(2, '0')}</b>
        </div>
        <div>
          <span>COMPRIMENTO TOTAL</span>
          <b>
            {format(
              valid.reduce((s, r) => s + r.totalLength, 0),
              2,
            )}{' '}
            <small>m</small>
          </b>
        </div>
        <div>
          <span>PESO TEÓRICO</span>
          <b>
            {format(
              valid.reduce((s, r) => s + r.weight, 0),
              2,
            )}{' '}
            <small>kg</small>
          </b>
        </div>
      </div>
      {rows.some((r) => r.errors.length > 0) && (
        <div className="inline-warning">
          Quadro parcial: corrija as posições marcadas antes de exportar.
        </div>
      )}
      <div className="schedule-table-wrap">
        <table className="schedule-table">
          <thead>
            <tr>
              <th>Posição</th>
              <th>Formato</th>
              <th>Elemento</th>
              <th>Aço / Ø mm</th>
              <th>Qtd.</th>
              <th>C. unit. m</th>
              <th>C. total m</th>
              <th>Peso kg</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.positionId}
                onClick={() => onSelect(r.bar.id)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSelect(r.bar.id);
                }}
              >
                <td>
                  <span className="position-tag" style={{ color: r.bar.color }}>
                    {r.mark}
                  </span>
                </td>
                <td>
                  <ShapePreview bar={r.bar} />
                </td>
                <td>
                  {r.element}
                  {(r.contributions.length > 1 ||
                    r.contributions.some(
                      (c) =>
                        c.comment ||
                        c.columnLevel ||
                        c.ribbed ||
                        c.multiplier > 1,
                    )) && (
                    <details
                      className="fabrication-contributions"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <summary>
                        {r.contributions.length} ocorrências · origens
                      </summary>
                      {r.contributions.map((c) => (
                        <p key={c.barId}>
                          <button onClick={() => onSelect(c.barId)}>
                            {c.barId}
                          </button>
                          <br />
                          {c.origin}
                          <br />
                          {quantityExpression(c)} = {c.quantity} peças ·{' '}
                          {format(c.unitLength, 6)} m · {format(c.weight, 4)} kg
                          <br />
                          {assemblyLabel(c)} ·{' '}
                          {quantitySourceLabel(c.quantitySource)}
                        </p>
                      ))}
                    </details>
                  )}
                </td>
                <td>
                  {r.steel} / {format(r.diameter, r.diameter % 1 ? 1 : 0)}
                </td>
                <td title="Base × grupos da armadura × repetições do detalhe = quantidade efetiva">
                  {scheduleQuantityLabel(r)}
                </td>
                <td
                  title={`Intervalo real: ${r.unitLengthRange.join(' – ')} m`}
                >
                  {r.errors.length ? 'Revisar' : format(r.unitLength, 3)}
                  {r.unitLengthRange[1] - r.unitLengthRange[0] > 1e-9
                    ? ' *'
                    : ''}
                </td>
                <td>{r.errors.length ? '—' : format(r.totalLength, 3)}</td>
                <td>{r.errors.length ? '—' : format(r.weight, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <div className="schedule-empty">
            Crie a primeira armadura para gerar o quadro.
          </div>
        )}
      </div>
      <div className="schedule-notes">
        <b>Critério de levantamento</b>
        <p>
          Comprimentos pelo eixo, com arcos de dobra. Massa teórica calculada
          com 7.850 kg/m³. Perdas, emendas adicionais e otimização de corte não
          são acrescentadas automaticamente.
        </p>
        <p>
          O detalhamento utiliza os mandris e os ganchos informados pelo
          projetista.
        </p>
      </div>
    </div>
  );
}

const annotationNames: Record<Annotation['kind'], string> = {
  'dimension-aligned': 'Cota alinhada',
  'dimension-orthogonal': 'Cota ortogonal',
  leader: 'Chamada',
  section: 'Corte e chamada',
  'section-arc': 'Corte em arco',
};
export function DraftInspector({
  annotation,
  polyline,
  project,
  onAnnotation,
  onPolyline,
  onLinks,
  onVertexEdit,
}: {
  annotation?: Annotation;
  polyline?: DraftPolyline;
  project: Project;
  onAnnotation: (patch: Partial<Annotation>) => void;
  onPolyline: (patch: Partial<DraftPolyline>) => void;
  onLinks: (ids: string[]) => void;
  onVertexEdit?: (mode: 'insert' | 'extend' | 'remove') => void;
}) {
  const object = annotation ?? polyline!;
  const updatePoints = (points: typeof object.points) =>
    annotation ? onAnnotation({ points }) : onPolyline({ points });
  return (
    <div className="inspector">
      <div className="panel-heading">
        <Settings2 size={14} />
        <b>{annotation ? annotationNames[annotation.kind] : 'Polilinha CAD'}</b>
      </div>
      <div className="panel-scroll">
        <Section title="Layer e estilo" initial={false}>
          <LayerInspector
            project={project}
            object={object}
            role={
              annotation
                ? annotation.kind.startsWith('dimension')
                  ? 'COTAS'
                  : annotation.kind.startsWith('section')
                    ? 'CORTES'
                    : 'CHAMADAS'
                : 'DESENHO'
            }
            onChange={(patch) =>
              annotation ? onAnnotation(patch) : onPolyline(patch)
            }
          />
        </Section>
        {annotation?.kind.startsWith('dimension') && (
          <p className="field-help">
            Cota estática: não acompanha referências de máscara.{' '}
            {annotation.maskReferences?.length
              ? 'Referências registradas apenas para verificação.'
              : 'Sem verificação de máscara.'}
          </p>
        )}
        {annotation && dimensionReferenceIssue(project, annotation) && (
          <p className="geometry-warning" role="alert">
            {dimensionReferenceIssue(project, annotation)}
          </p>
        )}
        {annotation?.maskReferences && (
          <button onClick={() => onAnnotation({ maskReferences: undefined })}>
            Remover verificação de máscara (manter cota estática)
          </button>
        )}
        {annotation && annotationError(annotation) && (
          <p className="geometry-warning" role="alert">
            {annotationError(annotation)}
          </p>
        )}
        {annotation?.kind.startsWith('dimension') && (
          <Section title="Apresentação da cota">
            <label className="field">
              Unidade
              <select
                aria-label="Unidade da cota"
                value={annotation.dimensionPresentation?.unit ?? 'cm'}
                onChange={(e) =>
                  onAnnotation({
                    dimensionPresentation: {
                      unit: e.target.value as 'mm' | 'cm' | 'm',
                      precision:
                        annotation.dimensionPresentation?.precision ?? 1,
                    },
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
                aria-label="Precisão da cota"
                value={annotation.dimensionPresentation?.precision ?? 1}
                onChange={(e) =>
                  onAnnotation({
                    dimensionPresentation: {
                      unit: annotation.dimensionPresentation?.unit ?? 'cm',
                      precision: Number(e.target.value),
                    },
                  })
                }
              >
                {[0, 1, 2, 3, 4, 5, 6].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <p className="field-help">
              Arredondamento somente do texto. Texto manual substitui o valor
              calculado; deixe vazio para valor automático.
            </p>
          </Section>
        )}
        {annotation && (
          <Section title="Texto e vínculo">
            <TextField
              label="Texto da anotação"
              value={annotation.label}
              allowEmpty
              maxLength={200}
              onChange={(label) => onAnnotation({ label })}
            />
            <p className="field-help">
              Deixe vazio para usar a medida ou a identificação automática da
              armadura.
            </p>
            <NumberField
              label="Altura do texto"
              value={annotation.textHeight}
              min={1}
              max={10000}
              suffix="mm"
              onChange={(textHeight) => onAnnotation({ textHeight })}
            />
            {
              <label className="field">
                <span>Armadura vinculada</span>
                <select
                  aria-label="Armadura vinculada"
                  value={annotation.barId ?? ''}
                  onChange={(e) =>
                    onAnnotation({ barId: e.target.value || undefined })
                  }
                >
                  <option value="">Sem vínculo</option>
                  {project.bars.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.mark} · {b.element}
                    </option>
                  ))}
                </select>
              </label>
            }
          </Section>
        )}
        {polyline && (
          <Section title="Polilinha">
            <label className="layer-toggle">
              <input
                type="checkbox"
                checked={polyline.closed}
                onChange={(e) => onPolyline({ closed: e.target.checked })}
              />
              Fechar contorno
            </label>
            <p className="field-help">
              Esta geometria não entra no quadro de aço. Use Converter polilinha
              e clique nela para criar uma armadura.
            </p>
          </Section>
        )}
        <Section title="Vínculos de cópia">
          <label className="field">
            <span>
              {annotation
                ? 'Outras armaduras vinculadas'
                : 'Armaduras da linha auxiliar'}
            </span>
            <select
              multiple
              size={3}
              aria-label="Armaduras da geometria auxiliar"
              value={object.barIds ?? []}
              onChange={(e) =>
                onLinks([...e.target.selectedOptions].map((o) => o.value))
              }
            >
              {project.bars
                .filter((b) => b.id !== annotation?.barId)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.mark} · {b.element} · {b.id.slice(-6)}
                  </option>
                ))}
            </select>
          </label>
          <p className="field-help">
            Esses vínculos incluem a geometria na cópia completa. Referenciar
            várias armaduras torna o auxiliar compartilhado; não cria aço ou uma
            faixa de cálculo.
          </p>
        </Section>
        <Section title="Vértices">
          {polyline && onVertexEdit && (
            <VertexCommands onAction={onVertexEdit} closed={polyline.closed} />
          )}
          {object.points.map((v, i) => (
            <div className="fields-2" key={i}>
              <NumberField
                label={`X do ponto ${i + 1}`}
                value={v.x}
                onChange={(x) =>
                  updatePoints(
                    object.points.map((p, j) => (j === i ? { ...p, x } : p)),
                  )
                }
              />
              <NumberField
                label={`Y do ponto ${i + 1}`}
                value={v.y}
                onChange={(y) =>
                  updatePoints(
                    object.points.map((p, j) => (j === i ? { ...p, y } : p)),
                  )
                }
              />
            </div>
          ))}
        </Section>
      </div>
      <div className="panel-foot">MOVER · COPIAR · GIRAR · EXCLUIR</div>
    </div>
  );
}

export function RepresentationInspector({
  project,
  representation: d,
  onEditBar,
  onChange,
  onDelete,
}: {
  project: Project;
  representation: import('../domain/types').Detail;
  onEditBar: () => void;
  onChange: (patch: Partial<import('../domain/types').Detail>) => void;
  onDelete: () => void;
}) {
  return (
    <aside className="inspector">
      <div className="panel-heading">
        <b>Representação da armadura</b>
      </div>
      <div className="panel-scroll">
        <Section title="Layer e estilo" initial={false}>
          <LayerInspector
            project={project}
            object={d}
            role="REBATIMENTOS"
            onChange={onChange}
          />
        </Section>
        <p className="field-help">
          ID {d.id} · armadura {d.barId}. Transformações gráficas não alteram
          comprimentos ou aço.
        </p>
        <NumberField
          label="X da inserção"
          value={d.origin.x}
          onChange={(x) => onChange({ origin: { ...d.origin, x } })}
        />
        <NumberField
          label="Y da inserção"
          value={d.origin.y}
          onChange={(y) => onChange({ origin: { ...d.origin, y } })}
        />
        <NumberField
          label="Rotação da inserção"
          value={d.rotation ?? 0}
          onChange={(rotation) => onChange({ rotation })}
        />
        <NumberField
          label="Escala gráfica da inserção"
          value={d.scale ?? 1}
          min={0.000001}
          max={10000}
          onChange={(scale) => onChange({ scale })}
        />
        <label className="field">
          <span>Identificação</span>
          <select
            aria-label="Identificação da inserção"
            value={d.identification ?? 'legacy'}
            onChange={(e) =>
              onChange({
                identification: e.target.value as typeof d.identification,
              })
            }
          >
            <option value="legacy">Descrição (legado)</option>
            <option value="primary">Descrição principal nesta inserção</option>
            <option value="mark">Somente posição</option>
            <option value="none">Sem identificação</option>
          </select>
        </label>
        <button onClick={onEditBar}>Editar armadura física</button>
        {d.label && (
          <fieldset className="compact-fields">
            <legend>Chamada posicionada</legend>
            <NumberField
              label="X local da chamada"
              value={d.label.origin.x}
              onChange={(x) =>
                onChange({
                  label: { ...d.label!, origin: { ...d.label!.origin, x } },
                })
              }
            />
            <NumberField
              label="Y local da chamada"
              value={d.label.origin.y}
              onChange={(y) =>
                onChange({
                  label: { ...d.label!, origin: { ...d.label!.origin, y } },
                })
              }
            />
            <NumberField
              label="Rotação local da chamada"
              value={d.label.rotation}
              onChange={(rotation) =>
                onChange({ label: { ...d.label!, rotation } })
              }
            />
            <NumberField
              label="Altura local da chamada"
              min={0.001}
              value={d.label.height}
              onChange={(height) =>
                onChange({ label: { ...d.label!, height } })
              }
            />
          </fieldset>
        )}
        <label className="field">
          <span>Cotas dos segmentos</span>
          <input
            type="checkbox"
            checked={d.showDimensions !== false}
            onChange={(e) => onChange({ showDimensions: e.target.checked })}
          />
        </label>
        <button onClick={onDelete}>Excluir somente esta inserção</button>
      </div>
    </aside>
  );
}

function VertexCommands({
  onAction,
  closed,
}: {
  onAction: (mode: 'insert' | 'extend' | 'remove') => void;
  closed?: boolean;
}) {
  return (
    <div className="visibility-actions">
      <button onClick={() => onAction('insert')}>Inserir vértices</button>
      {!closed && (
        <button onClick={() => onAction('extend')}>Continuar pela ponta</button>
      )}
      <button onClick={() => onAction('remove')}>Remover vértices</button>
    </div>
  );
}
