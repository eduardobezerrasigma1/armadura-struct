import {
  folderAvailable,
  pickProjectFolder,
  PROJECT_FILE,
  type ProjectFolder,
} from '../lib/projectFolder';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import type { Project } from '../domain/types';
import { detailPath, type HierarchyKind } from '../domain/hierarchy';
import { elementGroups } from '../domain/hierarchyPresentation';
import {
  newProjectSetup,
  projectSetupIssues,
  prepareProjectSetup,
  editProjectSetupNode,
  addProjectSetupNode,
  removeProjectSetupNode,
  projectSetupRemoval,
  hasProjectSetupToReplace,
  type ProjectSetupDraft,
} from '../domain/projectSetup';
const noun = {
  floor: 'pavimento',
  element: 'grupo',
  detail: 'detalhamento',
};
export default function NewProjectDialog({
  current,
  pendingWork,
  onCreate,
  onSaveCurrent,
  onOpenExisting,
  onClose,
}: {
  current: Project;
  pendingWork: boolean;
  onCreate: (
    draft: ProjectSetupDraft,
    base: Project,
    folder?: ProjectFolder,
  ) => Promise<boolean>;
  onOpenExisting: (
    raw: string,
    folder: ProjectFolder,
    base: Project,
  ) => Promise<boolean>;
  onSaveCurrent: (base: Project) => Promise<boolean>;
  onClose: () => void;
}) {
  const [folder, setFolder] = useState<ProjectFolder>();
  const [existing, setExisting] = useState<string>();
  const [folderError, setFolderError] = useState('');
  const close = () => {
    if (!submitting.current) onClose();
  };
  const pending = useRef(pendingWork).current;
  const backdropStart = useRef(false);
  const base = useRef(current).current,
    dialog = useRef<HTMLDialogElement>(null),
    name = useRef<HTMLInputElement>(null),
    submitting = useRef(false),
    alive = useRef(true);
  const [draft, setDraft] = useState(newProjectSetup),
    [touched, setTouched] = useState<Set<string>>(() => new Set()),
    [submitted, setSubmitted] = useState(false),
    [busy, setBusy] = useState(false),
    [ack, setAck] = useState(false),
    [status, setStatus] = useState('');
  const [removal, setRemoval] = useState<{
      kind: HierarchyKind;
      id: string;
    } | null>(null),
    [operationError, setOperationError] = useState<{
      id?: string;
      message: string;
    } | null>(null);
  const p = draft.project,
    h = p.hierarchy,
    issues = useMemo(() => projectSetupIssues(draft), [draft]),
    replacement = hasProjectSetupToReplace(base) || pending,
    stale = current !== base;
  const impact = removal
    ? projectSetupRemoval(draft, removal.kind, removal.id)
    : undefined;
  useEffect(() => {
    const old = document.activeElement as HTMLElement | null,
      el = dialog.current!;
    alive.current = true;
    el.showModal();
    name.current?.focus();
    name.current?.select();
    return () => {
      alive.current = false;
      if (el.open) el.close();
      if (old?.isConnected) old.focus({ preventScroll: true });
    };
  }, []);
  const touch = (key: string) => setTouched((v) => new Set([...v, key]));
  const error = (field: string, id?: string) =>
    submitted || touched.has(id ?? field)
      ? issues.find((i) => i.field === field && i.objectId === id)?.message
      : undefined;
  const changeNode = (
    kind: HierarchyKind,
    id: string,
    value: string,
    parentId?: string,
  ) => {
    setOperationError(null);
    try {
      setDraft(editProjectSetupNode(draft, kind, id, value, parentId));
    } catch (e) {
      setOperationError({ id, message: (e as Error).message });
    }
  };
  const add = (kind: HierarchyKind, parent?: string) => {
    setOperationError(null);
    try {
      const made = addProjectSetupNode(draft, kind, parent);
      setDraft(made.draft);
      requestAnimationFrame(() =>
        document.getElementById(`setup-node-${made.id}`)?.focus(),
      );
    } catch (e) {
      setOperationError({ id: parent, message: (e as Error).message });
    }
  };
  const remove = (kind: HierarchyKind, id: string) => {
    setOperationError(null);
    const result = projectSetupRemoval(draft, kind, id);
    if (result.blocked) setOperationError({ id, message: result.message });
    else setRemoval({ kind, id });
  };
  const row = (
    kind: HierarchyKind,
    node: { id: string; name: string },
    parentLabel: string,
    parentId?: string,
    children?: ReactNode,
  ) => {
    const fieldError = error('name', node.id),
      operation =
        operationError?.id === node.id ? operationError.message : undefined;
    return (
      <SetupNode
        key={node.id}
        kind={kind}
        id={node.id}
        label={parentLabel}
        value={node.name}
        error={fieldError ?? operation}
        onBlur={() => touch(node.id)}
        onName={(value) => changeNode(kind, node.id, value, parentId)}
        onRemove={() => remove(kind, node.id)}
        onAdd={
          kind === 'detail'
            ? undefined
            : () => add(kind === 'floor' ? 'element' : 'detail', node.id)
        }
        parent={
          kind === 'floor' ||
          (kind === 'element' ? h.floors.length : h.elements.length) <
            2 ? undefined : (
            <details className="setup-parent">
              <summary>
                Alterar {kind === 'element' ? 'pavimento' : 'grupo'}
              </summary>
              <label>
                <span>
                  {kind === 'element'
                    ? 'Pavimento do grupo'
                    : 'Grupo do detalhamento'}
                </span>
                <select
                  aria-label={
                    kind === 'element'
                      ? 'Pavimento do grupo'
                      : 'Grupo do detalhamento'
                  }
                  value={parentId}
                  onChange={(e) =>
                    changeNode(kind, node.id, node.name, e.target.value)
                  }
                >
                  {(kind === 'element'
                    ? h.floors.map((f, i) => ({
                        id: f.id,
                        label: `${i + 1} · ${f.name || 'Sem nome'}`,
                      }))
                    : h.elements.map((e, i) => ({
                        id: e.id,
                        label: `${h.floors.find((f) => f.id === e.floorId)?.name || 'Sem nome'} / ${i + 1} · ${e.name || 'Sem nome'}`,
                      }))
                  ).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </details>
          )
        }
      >
        {children}
      </SetupNode>
    );
  };
  return (
    <dialog
      ref={dialog}
      className="modal project-setup"
      aria-labelledby="setup-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClose={() => {
        if (!dialog.current?.open) onClose();
      }}
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        backdropStart.current =
          e.target === e.currentTarget &&
          (e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom);
      }}
      onClick={(e) => {
        if (!backdropStart.current || e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
          close();
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Tab') {
          const nodes = [
            ...e.currentTarget.querySelectorAll<HTMLElement>(
              'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]',
            ),
          ].filter(
            (n) =>
              !n.closest('[inert]') &&
              n.tabIndex >= 0 &&
              n.getClientRects().length > 0 &&
              getComputedStyle(n).visibility !== 'hidden',
          );
          if (e.shiftKey && document.activeElement === nodes[0]) {
            e.preventDefault();
            nodes.at(-1)?.focus();
          } else if (!e.shiftKey && document.activeElement === nodes.at(-1)) {
            e.preventDefault();
            nodes[0]?.focus();
          }
        }
        if (
          e.key === 'Enter' &&
          (e.target as HTMLElement).tagName === 'INPUT' &&
          (e.target as HTMLElement).closest('.setup-organization')
        )
          e.preventDefault();
        if (
          (e.ctrlKey || e.metaKey) &&
          ['s', 'o'].includes(e.key.toLowerCase())
        )
          e.preventDefault();
      }}
    >
      <header className="setup-heading">
        <div>
          <span className="eyebrow">ARMADURASTRUCT</span>
          <h2 id="setup-title">Novo projeto</h2>
        </div>
        <button
          type="button"
          className="modal-close"
          aria-label="Fechar Novo projeto"
          onClick={close}
        >
          <X size={19} />
        </button>
      </header>
      <form
        noValidate
        aria-busy={busy}
        onSubmit={async (e) => {
          e.preventDefault();
          if (submitting.current || stale) return;
          setSubmitted(true);
          const prepared = prepareProjectSetup(draft);
          if (!prepared.ok) {
            if (
              prepared.issues.some(
                (i) =>
                  i.objectId ||
                  ['structure', 'activeDetailId'].includes(i.field),
              )
            ) {
              const section = dialog.current?.querySelector<HTMLDetailsElement>(
                '.setup-organization',
              );
              if (section) section.open = true;
            }
            if (prepared.issues.some((i) => i.field === 'author')) {
              const section =
                dialog.current?.querySelector<HTMLDetailsElement>(
                  '.setup-optional',
                );
              if (section) section.open = true;
            }
            requestAnimationFrame(() =>
              dialog.current
                ?.querySelector<HTMLElement>('[aria-invalid="true"]')
                ?.focus(),
            );
            return;
          }
          if (replacement && !ack) {
            setStatus(
              'Confirme a substituição do projeto atual ou salve uma cópia antes de criar.',
            );
            return;
          }
          if (folderAvailable() && !folder) {
            setFolderError('Escolha uma pasta gravável para criar.');
            return;
          }
          if (existing) {
            setFolderError(
              'A pasta já possui um projeto. Abra o existente ou escolha outra pasta.',
            );
            return;
          }
          submitting.current = true;
          setBusy(true);
          try {
            if (
              !(await onCreate(
                {
                  ...draft,
                  project: prepared.project,
                  activeDetailId: prepared.activeDetailId,
                },
                base,
                folder,
              ))
            ) {
              submitting.current = false;
              setBusy(false);
              setStatus(
                'Não foi possível criar. O projeto atual permanece aberto; confira o aviso do aplicativo.',
              );
            }
          } catch (e) {
            if (alive.current) {
              setFolderError((e as Error).message);
              setStatus(
                'Falha: projeto anterior preservado. Pode haver artefatos em save-v1; confira o aviso.',
              );
            }
          } finally {
            if (alive.current) {
              submitting.current = false;
              setBusy(false);
            }
          }
        }}
      >
        <div className="setup-body" inert={busy}>
          <label className="field" htmlFor="setup-project-name">
            <span>Nome do projeto</span>
            <input
              ref={name}
              id="setup-project-name"
              value={p.name}
              maxLength={150}
              autoFocus
              aria-invalid={!!error('name')}
              aria-describedby={
                error('name') ? 'setup-name-error' : 'setup-name-help'
              }
              onBlur={() => touch('name')}
              onChange={(e) =>
                setDraft({ ...draft, project: { ...p, name: e.target.value } })
              }
            />
          </label>
          <small id="setup-name-help">
            Até 150 caracteres. Você pode criar agora e organizar depois.
          </small>
          {error('name') && (
            <p className="setup-error" role="alert" id="setup-name-error">
              {error('name')}
            </p>
          )}
          <section aria-label="Pasta do projeto">
            <label className="field">
              Pasta do projeto
              <input
                aria-label="Pasta do projeto"
                readOnly
                aria-invalid={!!folderError}
                aria-describedby={
                  folderError ? 'setup-folder-error' : undefined
                }
                value={folder?.label ?? ''}
                placeholder={
                  folderAvailable()
                    ? 'Escolha uma pasta'
                    : 'Modo compatível: recuperação local e download manual'
                }
              />
            </label>
            {folderAvailable() ? (
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  try {
                    const next = await pickProjectFolder();
                    if (!next || !alive.current) return;
                    const raw = await next.read();
                    if (!alive.current) return;
                    setFolder(next);
                    setExisting(raw);
                    setFolderError('');
                  } catch (e) {
                    if (alive.current) setFolderError(String(e));
                  }
                }}
              >
                Escolher pasta
              </button>
            ) : (
              <p>
                Este navegador não oferece escrita de diretório. O editor
                funciona com recuperação local; use Salvar para solicitar
                download, sem confirmação de gravação em disco.
              </p>
            )}
            {folder && (
              <p>
                Arquivo principal: {folder.label}/{PROJECT_FILE}. Somente
                save-v1 é criado ao confirmar; exportações mantêm seus diálogos.
              </p>
            )}
            {existing && folder && (
              <button
                type="button"
                disabled={busy || stale}
                onClick={async () => {
                  if (submitting.current) return;
                  if (replacement && !ack) {
                    setStatus(
                      'Confirme a substituição antes de abrir o existente.',
                    );
                    return;
                  }
                  submitting.current = true;
                  setBusy(true);
                  try {
                    if (
                      !(await onOpenExisting(existing, folder, base)) &&
                      alive.current
                    )
                      setFolderError(
                        'Não foi possível abrir. Confira o arquivo e o aviso do aplicativo.',
                      );
                  } catch (e) {
                    if (alive.current) setFolderError(String(e));
                  } finally {
                    if (alive.current) {
                      submitting.current = false;
                      setBusy(false);
                    }
                  }
                }}
              >
                Abrir projeto existente nesta pasta
              </button>
            )}
            {folderError && (
              <p role="alert" className="setup-error" id="setup-folder-error">
                {folderError}
              </p>
            )}
            {busy && (
              <p role="status">
                Gravando/preparando. Aguarde antes de fechar; o projeto aberto
                só será substituído após sucesso.
              </p>
            )}
          </section>
          <details className="setup-optional">
            <summary>Responsável (opcional)</summary>
            <label className="field">
              <span>Responsável</span>
              <input
                value={p.author}
                maxLength={150}
                aria-invalid={!!error('author')}
                onBlur={() => touch('author')}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    project: { ...p, author: e.target.value },
                  })
                }
              />
            </label>
            {error('author') && (
              <p className="setup-error" role="alert">
                {error('author')}
              </p>
            )}
          </details>
          <div
            className="setup-summary"
            aria-label="Resumo da organização inicial"
          >
            <b>Início: {detailPath(p, draft.activeDetailId)}</b>
            <span>
              {h.floors.length} pavimento(s) · {h.elements.length} grupo(s) ·{' '}
              {h.details.length} detalhamento(s)
            </span>
            <small>Uma folha inicial vazia; nenhuma armadura é gerada.</small>
          </div>
          <details className="setup-organization">
            <summary>Organizar pavimentos, grupos e detalhamentos</summary>
            <div className="setup-guide" aria-label="Como organizar o projeto">
              <span>
                <b>Pavimento</b>Térreo, Cobertura
              </span>
              <span>
                <b>Grupo de elementos</b>Vigas, Pilares, Lajes
              </span>
              <span>
                <b>Detalhamento</b>V1, V2, P1
              </span>
            </div>
            <button
              type="button"
              className="setup-add-floor"
              onClick={() => add('floor')}
            >
              <Plus size={13} /> Adicionar pavimento
            </button>
            <div
              className="setup-tree"
              role="group"
              aria-label="Prévia da estrutura do projeto"
            >
              {h.floors.map((f, fi) =>
                row(
                  'floor',
                  f,
                  `Pavimento ${fi + 1}`,
                  undefined,
                  <>
                    {h.elements
                      .filter((e) => e.floorId === f.id)
                      .map((el, ei) =>
                        row(
                          'element',
                          el,
                          `${f.name || 'Sem nome'} / Grupo de elementos ${ei + 1}`,
                          f.id,
                          <>
                            {h.details
                              .filter((d) => d.elementId === el.id)
                              .map((d, di) =>
                                row(
                                  'detail',
                                  d,
                                  `${f.name || 'Sem nome'} / ${el.name || 'Sem nome'} / Detalhamento ${di + 1}`,
                                  el.id,
                                ),
                              )}
                            {!h.details.some((d) => d.elementId === el.id) && (
                              <p className="field-help">
                                Sem detalhamento neste grupo; poderá ser
                                preparado depois.
                              </p>
                            )}
                          </>,
                        ),
                      )}
                    {!h.elements.some((e) => e.floorId === f.id) && (
                      <p className="field-help">
                        Sem grupos neste pavimento; você pode cadastrá-los
                        depois.
                      </p>
                    )}
                  </>,
                ),
              )}
            </div>
            <label className="field">
              <span>Detalhamento inicial ativo</span>
              <select
                aria-label="Detalhamento inicial ativo"
                value={draft.activeDetailId}
                onChange={(e) =>
                  setDraft({ ...draft, activeDetailId: e.target.value })
                }
              >
                {h.details.map((d, i) => (
                  <option key={d.id} value={d.id}>
                    {i + 1} · {detailPath(p, d.id)}
                  </option>
                ))}
              </select>
            </label>
          </details>
          {removal && impact && (
            <section
              className="setup-removal"
              role="group"
              aria-label="Confirmar remoção do rascunho"
            >
              <p>{impact.message}</p>
              <ul>
                {[...impact.floors, ...impact.elements, ...impact.details].map(
                  (n) => (
                    <li key={n.id}>{n.name || 'Sem nome'}</li>
                  ),
                )}
              </ul>
              <button
                type="button"
                disabled={impact.blocked}
                onClick={() => {
                  try {
                    setDraft(
                      removeProjectSetupNode(
                        draft,
                        removal.kind,
                        removal.id,
                        true,
                      ),
                    );
                    setRemoval(null);
                  } catch (e) {
                    setOperationError({
                      id: removal.id,
                      message: (e as Error).message,
                    });
                  }
                }}
              >
                Remover conjunto do rascunho
              </button>
              <button type="button" onClick={() => setRemoval(null)}>
                Manter itens
              </button>
            </section>
          )}
          {submitted &&
            issues
              .filter((i) => ['structure', 'activeDetailId'].includes(i.field))
              .map((i, k) => (
                <p className="setup-error" role="alert" key={k}>
                  {i.message}
                </p>
              ))}
          {operationError && !operationError.id && (
            <p className="setup-error" role="alert">
              {operationError.message}
            </p>
          )}
          {replacement && (
            <section
              className="setup-replacement"
              aria-label="Substituição do projeto atual"
            >
              <b>Projeto atual: {base.name}</b>
              <p>
                Criar substitui o projeto aberto. Um Desfazer recupera o atual;
                a recuperação automática passará a guardar o novo projeto. Salve
                uma cópia se quiser manter ambos.
              </p>
              {pending && (
                <p>
                  Há um comando em andamento. Ao criar, seu preenchimento
                  pendente será cancelado. Conclua-o antes se quiser mantê-lo; a
                  cópia salva contém os objetos já confirmados.
                </p>
              )}
              <button
                type="button"
                disabled={busy || stale}
                onClick={async () => {
                  if (submitting.current) return;
                  submitting.current = true;
                  setBusy(true);
                  try {
                    const saved = await onSaveCurrent(base);
                    if (alive.current) {
                      setStatus(
                        saved
                          ? 'Cópia solicitada. Confira o arquivo salvo antes de criar.'
                          : 'Salvamento cancelado; o projeto atual permanece aberto.',
                      );
                      if (saved) setAck(true);
                    }
                  } catch (e) {
                    if (alive.current) setStatus((e as Error).message);
                  } finally {
                    if (alive.current) {
                      setBusy(false);
                      submitting.current = false;
                    }
                  }
                }}
              >
                Salvar cópia do projeto atual
              </button>
              <label className="setup-ack">
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                />
                Confirmar substituição do projeto atual
              </label>
            </section>
          )}
          {stale && (
            <p className="setup-error" role="alert">
              O projeto aberto mudou. Cancele e reabra o assistente para criar
              com segurança.
            </p>
          )}
          {status && (
            <p className="field-help" role="status">
              {status}
            </p>
          )}
        </div>
        <footer className="modal-actions">
          <button type="button" disabled={busy} onClick={close}>
            Cancelar
          </button>
          <button
            className="primary"
            type="submit"
            disabled={busy || stale || (replacement && !ack)}
          >
            Criar projeto
          </button>
        </footer>
      </form>
    </dialog>
  );
}
function SetupNode({
  kind,
  id,
  label,
  value,
  error,
  onBlur,
  onName,
  onRemove,
  onAdd,
  parent,
  children,
}: {
  kind: HierarchyKind;
  id: string;
  label: string;
  value: string;
  error?: string;
  onBlur: () => void;
  onName: (s: string) => void;
  onRemove: () => void;
  onAdd?: () => void;
  parent?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section
      className={`setup-node setup-${kind}`}
      data-testid={`setup-${kind}`}
      data-node-id={id}
      aria-label={label}
    >
      <div className="setup-node-row">
        <label className="field" htmlFor={`setup-node-${id}`}>
          <span title={label}>
            {kind === 'floor'
              ? 'Pavimento'
              : kind === 'element'
                ? 'Grupo de elementos'
                : 'Detalhamento'}
          </span>
          <input
            id={`setup-node-${id}`}
            aria-label={`Nome do ${noun[kind]}`}
            placeholder={
              kind === 'floor'
                ? 'Térreo, Cobertura…'
                : kind === 'element'
                  ? 'Vigas, Pilares, Lajes…'
                  : 'V1, V2, P1…'
            }
            list={kind === 'element' ? `setup-groups-${id}` : undefined}
            maxLength={100}
            value={value}
            aria-invalid={!!error}
            aria-describedby={error ? `setup-error-${id}` : undefined}
            onBlur={onBlur}
            onChange={(e) => onName(e.target.value)}
          />
          {kind === 'element' && (
            <datalist id={`setup-groups-${id}`}>
              {elementGroups.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          )}
        </label>
        <div className="setup-node-actions">
          {onAdd && (
            <button
              type="button"
              title={`Adicionar ${kind === 'floor' ? 'grupo de elementos' : 'detalhamento'} em ${value || 'Sem nome'}`}
              aria-label={
                kind === 'floor' ? 'Adicionar grupo' : 'Adicionar detalhamento'
              }
              onClick={onAdd}
            >
              <Plus size={14} />
              <span>{kind === 'floor' ? 'Grupo' : 'Detalhamento'}</span>
            </button>
          )}
          <button
            type="button"
            title={`Remover ${noun[kind]} ${value || 'Sem nome'}`}
            aria-label={`Remover ${noun[kind]}`}
            onClick={onRemove}
          >
            <X size={14} />
          </button>
        </div>
      </div>
      {error && (
        <p className="setup-error" role="alert" id={`setup-error-${id}`}>
          {error}
        </p>
      )}
      {parent}
      {children && <div className="setup-children">{children}</div>}
    </section>
  );
}
