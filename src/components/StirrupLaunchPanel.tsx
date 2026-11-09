import type { Bar, Point, Project } from '../domain/types';
import type { StirrupCriteria } from '../domain/stirrupSchema';
import { format, geometry, distance } from '../domain/geometry';
import { distributionStep, distributionOrigins } from '../domain/drafting';
export type StirrupSession = {
  base: Project;
  key: string;
  detailId: string;
  scope?: string;
  maskId?: string;
  c: StirrupCriteria;
  editId?: string;
  id: string;
  mark: string;
  stage: 'shape' | 'section' | 'range-start' | 'range-end' | 'label' | 'ready';
  points: Point[];
  section?: Point;
  start?: Point;
  end?: Point;
  label?: Point;
  cursor?: Point;
  error?: string;
};
export default function StirrupLaunchPanel({
  session: s,
  bar,
  error,
  onConfirm,
  onBack,
  onCancel,
}: {
  session: StirrupSession;
  bar?: Bar;
  error?: string;
  onConfirm: () => void;
  onBack: () => void;
  onCancel: () => void;
}) {
  const prompts = {
    shape: 'Clique os vértices da forma livre. Enter conclui; Esc cancela.',
    section: `Posicione a seção: ${s.c.profile.shape === 'circle' ? 'centro' : s.c.profile.shape === 'free' ? 'primeiro vértice' : 'canto inferior esquerdo da referência escolhida'}.`,
    'range-start': 'Indique a primeira face / início da faixa.',
    'range-end': 'Indique a segunda face / fim da faixa.',
    label: 'Escolha a posição da linha e da identificação da faixa.',
    ready: 'Confira a prévia. Confirmar lançamento ou Enter grava tudo junto.',
  };
  const origins = bar?.distribution ? distributionOrigins(bar, 2) : [];
  return (
    <section
      className="stirrup-launch-panel"
      aria-label="Lançamento de estribo"
    >
      <b>Estribo · {s.mark}</b>
      <p role="status">{prompts[s.stage]}</p>
      {bar && (
        <p>
          Comprimento unitário: {format(geometry(bar).length, 2)} mm ·{' '}
          {bar.quantity} peça(s)
          {bar.distribution
            ? ` · passo efetivo ${format(distributionStep(bar), 2)} mm`
            : ''}
        </p>
      )}
      {origins.length === 2 && (
        <small>
          Primeiro ({format(origins[0].x, 2)}, {format(origins[0].y, 2)}) ·
          último ({format(origins[1].x, 2)}, {format(origins[1].y, 2)}) mm ·
          trecho ocupado {format(distance(origins[0], origins[1]), 2)} mm.
          Referências estáticas.
        </small>
      )}
      {(s.error || error) && (
        <p role="alert" className="stirrup-error">
          {s.error || error}
        </p>
      )}
      <div className="dialog-actions">
        <button onClick={onBack}>Voltar etapa</button>
        <button onClick={onCancel}>Cancelar lançamento</button>
        <button
          className="primary"
          disabled={s.stage !== 'ready' || !!error || !!s.error}
          onClick={onConfirm}
        >
          Confirmar lançamento
        </button>
      </div>
    </section>
  );
}
