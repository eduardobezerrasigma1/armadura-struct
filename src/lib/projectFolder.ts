import { isTauri, invoke } from '@tauri-apps/api/core';
import { decodeProject } from '../domain/model';
import type { Project } from '../domain/types';
export const PROJECT_FILE = 'save-v1/projeto.armstruct.json';
export const RESERVED_EXPORTS = [
  'exportacoes/desenhos',
  'exportacoes/configuracoes',
] as const;
type FH = {
  getFile(): Promise<File>;
  createWritable(options: { mode: 'exclusive' }): Promise<{
    write(data: string): Promise<void>;
    close(): Promise<void>;
    abort(): Promise<void>;
  }>;
};
type DH = {
  name: string;
  entries(): AsyncIterableIterator<[string, unknown]>;
  getDirectoryHandle(n: string, o?: { create: boolean }): Promise<DH>;
  getFileHandle(n: string, o?: { create: boolean }): Promise<FH>;
  queryPermission?(o: { mode: string }): Promise<PermissionState>;
};
export type ProjectFolder = {
  label: string;
  read: () => Promise<string | undefined>;
  write: (data: string, expected: string | undefined) => Promise<void>;
};
export const folderAvailable = () =>
  isTauri() ||
  (typeof (window as unknown as { showDirectoryPicker?: unknown })
    .showDirectoryPicker === 'function' &&
    typeof navigator.locks?.request === 'function');
const missing = (e: unknown) =>
  e instanceof DOMException && e.name === 'NotFoundError';
export function managedNameConflict(actual: string, expected: string) {
  const normalized = actual.normalize('NFC').replace(/[. ]+$/, '');
  return (
    actual !== expected &&
    (normalized.toLowerCase() === expected.toLowerCase() ||
      normalized.toUpperCase() === expected.toUpperCase())
  );
}
async function checkNames(d: DH, name: string) {
  for await (const [n] of d.entries())
    if (managedNameConflict(n, name))
      throw Error(
        `Conflito de caixa no nome administrado: ${n}. Escolha outra pasta.`,
      );
}
export async function pickProjectFolder(): Promise<ProjectFolder | null> {
  if (isTauri()) {
    const choice = await invoke<{ token: string; label: string } | null>(
      'project_folder_choose',
    );
    if (!choice) return null;
    return {
      label: choice.label,
      read: () =>
        invoke<string | null>('project_folder_read', {
          token: choice.token,
        }).then((s) => s ?? undefined),
      write: (data, expected) =>
        invoke('project_folder_write', {
          token: choice.token,
          data,
          expected: expected ?? null,
        }),
    };
  }
  const picker = (
    window as unknown as {
      showDirectoryPicker: (o: { mode: string }) => Promise<DH>;
    }
  ).showDirectoryPicker;
  if (!picker || !navigator.locks?.request)
    throw Error(
      'Este navegador usa recuperação local e download manual; não grava uma pasta.',
    );
  let root: DH;
  try {
    root = await picker.call(window, { mode: 'readwrite' });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return null;
    throw e;
  }
  const read = async () => {
    if (
      root.queryPermission &&
      (await root.queryPermission({ mode: 'readwrite' })) !== 'granted'
    )
      throw Error(
        'Acesso à pasta perdido; use Localizar/associar pasta para reautorizar.',
      );
    await checkNames(root, 'save-v1');
    let dir: DH;
    try {
      dir = await root.getDirectoryHandle('save-v1');
    } catch (e) {
      if (missing(e)) return;
      throw e;
    }
    await checkNames(dir, 'projeto.armstruct.json');
    try {
      return await (
        await (await dir.getFileHandle('projeto.armstruct.json')).getFile()
      ).text();
    } catch (e) {
      if (!missing(e)) throw e;
      for await (const [n] of dir.entries())
        throw Error(`Diretório save-v1 ocupado por ${n}; escolha outra pasta.`);
    }
  };
  return {
    label: root.name,
    read,
    write: async (data, expected) => {
      const work = async () => {
        const old = await read();
        if (old !== expected)
          throw Error(
            'Arquivo alterado externamente ou pasta ocupada. Abra o existente ou salve uma cópia.',
          );
        const dir = await root.getDirectoryHandle('save-v1', { create: true });
        const f = await dir.getFileHandle('projeto.armstruct.json', {
          create: true,
        });
        const w = await f.createWritable({ mode: 'exclusive' });
        try {
          await w.write(data);
          if ((await read()) !== (expected ?? ''))
            throw Error('Arquivo mudou durante a gravação.');
          await w.close();
        } catch (e) {
          await w.abort().catch(() => {});
          throw e;
        }
      };
      // A common origin lock also protects initial creation by DIFFERENT project IDs.
      await navigator.locks.request('armstruct-project-folder-write-v1', work);
    },
  };
}
type Binding = {
  folder: ProjectFolder;
  expected: string;
  tail: Promise<unknown>;
};
const bindings = new WeakMap<Project, Binding>(),
  detached = new WeakSet<Project>();
export const detachProject = (p: Project) => {
  detached.add(p);
  try {
    localStorage.removeItem('armstruct.folder.hint');
  } catch {
    /* optional */
  }
  return p;
};
export function inheritProjectFolder(
  before: Project,
  next: Project,
  complete: Project,
) {
  const b =
    bindings.get(next) ??
    (next.id === before.id && !detached.has(next)
      ? bindings.get(before)
      : undefined);
  if (b) bindings.set(complete, b);
}
export const projectFolderLabel = (p: Project) => bindings.get(p)?.folder.label;
export function attachProjectFolder(
  p: Project,
  folder: ProjectFolder,
  raw: string,
) {
  if (decodeProject(raw).id !== p.id)
    throw Error('A pasta pertence a outro projeto.');
  bindings.set(p, { folder, expected: raw, tail: Promise.resolve() });
}
let pendingWrites = 0;
export const hasPendingFolderWrites = () => pendingWrites > 0;
export async function createProjectInFolder(p: Project, folder: ProjectFolder) {
  pendingWrites++;
  try {
    const raw = JSON.stringify(decodeProject(JSON.stringify(p)), null, 2);
    if ((await folder.read()) !== undefined)
      throw Error(
        'Já existe um projeto nesta pasta. Use Abrir existente ou escolha outra pasta.',
      );
    await folder.write(raw, undefined);
    if ((await folder.read()) !== raw)
      throw Error(
        'Arquivo inicial divergente após escrita. Preserve save-v1 e abra explicitamente; projeto anterior mantido.',
      );
    attachProjectFolder(p, folder, raw);
  } finally {
    pendingWrites--;
  }
}
export async function saveProjectFolder(p: Project): Promise<boolean> {
  const b = bindings.get(p);
  if (!b) return false;
  const raw = JSON.stringify(decodeProject(JSON.stringify(p)), null, 2);
  pendingWrites++;
  const task = b.tail
    .catch(() => {})
    .then(async () => {
      if ((await b.folder.read()) !== b.expected)
        throw Error(
          'Arquivo alterado externamente ou acesso perdido. Abra o existente ou salve uma cópia.',
        );
      if (raw === b.expected) return;
      await b.folder.write(raw, b.expected);
      b.expected = raw;
      if ((await b.folder.read()) !== raw)
        throw Error(
          'Arquivo divergente após escrita; confira a pasta e preserve a recuperação.',
        );
    });
  b.tail = task;
  try {
    await task;
    return true;
  } finally {
    pendingWrites--;
  }
}

function hintHash(p: Project) {
  const s = JSON.stringify(p);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++)
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return s.length + ':' + (h >>> 0);
}
export function rememberFolder(p: Project) {
  try {
    const b = bindings.get(p);
    if (b)
      localStorage.setItem(
        'armstruct.folder.hint',
        JSON.stringify({ id: p.id, hash: hintHash(p), label: b.folder.label }),
      );
  } catch {
    /* Hint is optional; never an authorization. */
  }
}
export function folderHint(p: Project): string | undefined {
  try {
    const h = JSON.parse(
      localStorage.getItem('armstruct.folder.hint') ?? 'null',
    );
    return h?.id === p.id && h.hash === hintHash(p) ? h.label : undefined;
  } catch {
    return;
  }
}
