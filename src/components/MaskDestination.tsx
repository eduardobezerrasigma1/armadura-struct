import { useEffect, useMemo, useState } from 'react';
import type { Project } from '../domain/types';
import {
  maskPath,
  maskDrawingState,
  type MaskDrawingContext,
} from '../domain/maskDrawing';

export function MaskSelector({
  project,
  value,
  onChange,
  label = 'Escolher máscara',
}: {
  project: Project;
  value: string;
  onChange: (id: string) => void;
  label?: string;
}) {
  const [search, setSearch] = useState('');
  const options = useMemo(
    () =>
      project.masks.map((m) => ({
        id: m.id,
        text: `${m.name} · ${m.format === 'NATIVE' ? 'Nativa' : m.format} · ${maskPath(project, m.id)} · [${m.id}]`,
      })),
    [project],
  );
  const query = search
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return (
    <div className="mask-selector">
      <input
        type="search"
        aria-label="Pesquisar máscaras do projeto"
        placeholder="Pesquisar nome, origem ou contexto…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Escolher máscara do projeto ({options.length})</option>
        {options
          .filter(
            (o) =>
              o.id === value ||
              o.text
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .includes(query),
          )
          .map((o) => (
            <option value={o.id} key={o.id}>
              {o.text}
            </option>
          ))}
      </select>
    </div>
  );
}
export default function MaskDestination({
  project,
  activeId,
  context,
  onActivate,
  onCreate,
  onBatch,
  onCalibrate,
  onCadEdit,
  onManipulate,
  onOffset,
}: {
  project: Project;
  activeId?: string;
  context: MaskDrawingContext;
  onActivate: (id: string) => boolean;
  onCreate: () => void;
  onCalibrate: () => void;
  onCadEdit: (mode: 'trim' | 'extend') => void;
  onManipulate: (mode: 'copy' | 'erase' | 'mirror') => void;
  onOffset: () => void;
  onBatch: (mode: 'import' | 'associate') => void;
}) {
  const [candidate, setCandidate] = useState(activeId ?? '');
  useEffect(() => setCandidate(activeId ?? ''), [activeId, project.id]);
  const state = maskDrawingState(project, activeId, context);
  return (
    <section
      className="mask-destination"
      aria-label="Destino do desenho de máscaras"
      onKeyDown={(e) => e.stopPropagation()}
    >
      <b>Desenhar em</b>
      <MaskSelector
        project={project}
        value={candidate}
        onChange={setCandidate}
      />
      <button
        type="button"
        aria-label="Ativar máscara para desenhar"
        disabled={!project.masks.some((m) => m.id === candidate)}
        onClick={() => onActivate(candidate)}
      >
        Ativar
      </button>
      <button type="button" onClick={onCreate}>
        Nova máscara
      </button>
      <button
        type="button"
        aria-label="Importar máscaras em lote"
        onClick={() => onBatch('import')}
      >
        Importar
      </button>
      <button
        type="button"
        aria-label="Associar máscaras do projeto"
        onClick={() => onBatch('associate')}
      >
        Associar
      </button>
      <button
        type="button"
        aria-label="Ajustar escala da máscara ativa"
        disabled={!activeId}
        onClick={onCalibrate}
      >
        Escala por 2 pontos
      </button>
      <select
        aria-label="Ferramentas CAD da máscara ativa"
        value=""
        onChange={(e) => {
          if (e.target.value === 'offset') onOffset();
          else if (
            e.target.value === 'copy' ||
            e.target.value === 'erase' ||
            e.target.value === 'mirror'
          )
            onManipulate(e.target.value);
          else if (e.target.value)
            onCadEdit(e.target.value as 'trim' | 'extend');
        }}
      >
        <option value="">Ferramentas CAD…</option>
        <option value="offset">Offset — Paralelas</option>
        <option value="trim">Ajustar — Aparar / Trim</option>
        <option value="extend">Estender — Extend</option>
        <option value="mirror">Espelhar entidades</option>
        <option value="copy">Copiar entidades</option>
        <option value="erase">Apagar entidades</option>
      </select>
      <div
        className={`mask-destination-status ${state.editable ? 'editable' : 'protected'}`}
        role="region"
        aria-live="polite"
        aria-label="Máscara ativa para desenhar"
      >
        <strong>
          {state.mask
            ? `${state.mask.name} · ${state.path} · [${state.mask.id}]`
            : 'Nenhuma máscara ativa'}
        </strong>
        <span>
          {state.label}
          {state.mask?.format !== 'NATIVE' && state.mask
            ? ' · Novos traços: desenho local; referência original preservada.'
            : ''}
        </span>
      </div>
    </section>
  );
}
