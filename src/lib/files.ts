import { detachProject, rememberFolder } from './projectFolder';
import { isTauri } from '@tauri-apps/api/core';
import type { Mask, Project } from '../domain/types';
import { decodeProject } from '../domain/model';
import type { CadState } from '../components/CadCanvas';

export type DocumentWorkspace = {
  active: string;
  opened: string[];
  cameras: Record<string, CadState>;
};
/** Local navigation preferences; document content is always serialized in Project. */
export function readDocumentWorkspace(
  projectId: string,
): DocumentWorkspace | undefined {
  try {
    const value = JSON.parse(
      localStorage.getItem(`armadurastruct.documents.${projectId}`) || 'null',
    );
    if (
      !value ||
      typeof value.active !== 'string' ||
      !Array.isArray(value.opened) ||
      !value.opened.every((k: unknown) => typeof k === 'string')
    )
      return;
    const camera = (c: unknown) => {
      const v = c as { x?: number; y?: number; s?: number } | undefined;
      return (
        v &&
        [v.x, v.y, v.s].every(
          (n) => typeof n === 'number' && Number.isFinite(n),
        ) &&
        v.s! > 0
      );
    };
    const cameras: Record<string, CadState> = {};
    for (const [key, raw] of Object.entries(value.cameras ?? {})) {
      const state = raw as CadState;
      if (
        camera(state?.view) &&
        (!state.overview ||
          (typeof state.overview.projectId === 'string' &&
            camera(state.overview.view)))
      )
        cameras[key] = state;
    }
    return {
      active: value.active,
      opened: value.opened.slice(0, 1000),
      cameras,
    };
  } catch {
    return;
  }
}
export function saveDocumentWorkspace(
  projectId: string,
  value: DocumentWorkspace,
) {
  try {
    localStorage.setItem(
      `armadurastruct.documents.${projectId}`,
      JSON.stringify(value),
    );
  } catch {
    /* Navigation preferences are optional. */
  }
}
/** Full opens are strict; selective transfers expose missing bar references for explicit mapping. */
export async function readProjectFile(
  file: File,
  forDetailTransfer = false,
): Promise<Project> {
  if (file.size > 100 * 1024 * 1024)
    throw new Error('Use um projeto de até 100 MB.');
  return detachProject(
    decodeProject(await file.text(), {
      allowOrphanReferences: forDetailTransfer,
    }),
  );
}
/** Packages and complete projects converge on the same AS-08 comparison. */
export async function readDetailSourceFile(
  file: File,
): Promise<{ project: Project; detailId?: string }> {
  if (file.size > 100 * 1024 * 1024)
    throw new Error('Use um pacote de até 100 MB.');
  const raw = await file.text();
  const header = JSON.parse(raw) as { schema?: unknown } | null;
  if (
    typeof header?.schema === 'string' &&
    header.schema.startsWith('openstruct.detail/')
  ) {
    const { readDetailPackage } = await import('../domain/detailPackage');
    const { package: pack, project } = readDetailPackage(header);
    return {
      project,
      detailId: pack.context.detail.id,
    };
  }
  return { project: decodeProject(raw, { allowOrphanReferences: true }) };
}
export async function pickNativeFile(
  extensions: string[],
): Promise<File | null | undefined> {
  if (!isTauri()) return undefined;
  const { open } = await import('@tauri-apps/plugin-dialog');
  const path = await open({
    multiple: false,
    directory: false,
    filters: [{ name: extensions.join(' / ').toUpperCase(), extensions }],
  });
  if (!path || Array.isArray(path)) return null;
  const { readFile } = await import('@tauri-apps/plugin-fs');
  const data = await readFile(path);
  return new File(
    [new Uint8Array(data).buffer],
    path.split(/[\\/]/).at(-1) || 'desenho',
  );
}
export const safeName = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 80) || 'armaduras';
export async function saveFile(
  name: string,
  data: string | Uint8Array,
  mime: string,
  extension: string,
) {
  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const path = await save({
      defaultPath: name,
      filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
    });
    if (!path) return false;
    const fs = await import('@tauri-apps/plugin-fs');
    if (typeof data === 'string') await fs.writeTextFile(path, data);
    else await fs.writeFile(path, data);
    return true;
  }
  const blob = new Blob(
    [typeof data === 'string' ? data : new Uint8Array(data).buffer],
    { type: mime },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}
export type MaskSource = {
  name: string;
  size?: number;
  load: (signal: AbortSignal) => Promise<File>;
};
export const maskFileSources = (files: File[]): MaskSource[] =>
  files.map((file) => ({
    name: file.name,
    size: file.size,
    load: async (signal) => {
      signal.throwIfAborted();
      return file;
    },
  }));
/** Selected paths are held only during preparation; read one file at a time. */
export async function pickNativeMaskFiles(): Promise<
  MaskSource[] | null | undefined
> {
  if (!isTauri()) return undefined;
  const { open } = await import('@tauri-apps/plugin-dialog');
  const paths = await open({
    multiple: true,
    directory: false,
    filters: [{ name: 'DXF / DWG', extensions: ['dxf', 'dwg'] }],
  });
  if (!paths) return null;
  return (Array.isArray(paths) ? paths : [paths]).map((path) => ({
    name: path.split(/[\\/]/).at(-1) || 'desenho',
    load: async (signal: AbortSignal) => {
      signal.throwIfAborted();
      const { readFile, stat } = await import('@tauri-apps/plugin-fs');
      const info = await stat(path);
      if (info.size > 30 * 1024 * 1024)
        throw new Error('Use uma máscara de até 30 MB nesta versão.');
      signal.throwIfAborted();
      const data = await readFile(path);
      signal.throwIfAborted();
      return new File(
        [new Uint8Array(data).buffer],
        path.split(/[\\/]/).at(-1) || 'desenho',
      );
    },
  }));
}
export function importMask(file: File, signal?: AbortSignal): Promise<Mask> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      reject(new Error('Use uma máscara de até 30 MB nesta versão.'));
      return;
    }
    const worker = new Worker(
      new URL('../cad/import.worker.ts', import.meta.url),
      { type: 'module' },
    );
    let done = false;
    const end = (error?: unknown, mask?: Mask) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      worker.terminate();
      if (error) reject(error);
      else resolve(mask!);
    };
    const abort = () =>
      end(
        signal?.reason ?? new DOMException('Leitura cancelada.', 'AbortError'),
      );
    const timer = setTimeout(
      () =>
        end(
          new Error(
            'Leitura interrompida após 60 segundos. Simplifique o arquivo ou use DXF.',
          ),
        ),
      60000,
    );
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = (e) =>
      end(e.data.error ? new Error(e.data.error) : undefined, e.data.mask);
    worker.onerror = (e) =>
      end(new Error(e.message || 'Não foi possível iniciar o leitor CAD.'));
    file
      .arrayBuffer()
      .then((buffer) => {
        if (!done)
          worker.postMessage(
            {
              name: file.name,
              buffer,
              base: new URL(
                `${import.meta.env.BASE_URL}wasm`,
                window.location.origin,
              ).href,
            },
            [buffer],
          );
      })
      .catch((e) => end(e));
  });
}
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('armadurastruct', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('projects');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
let recoveryQueue: Promise<unknown> = Promise.resolve();
export function autosave(p: Project) {
  const task = recoveryQueue.catch(() => {}).then(() => writeRecovery(p));
  recoveryQueue = task;
  return task;
}
async function writeRecovery(p: Project) {
  rememberFolder(p);
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      tx.objectStore('projects').put(JSON.stringify(p), 'current');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function restore(): Promise<string | undefined> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const req = db
        .transaction('projects')
        .objectStore('projects')
        .get('current');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}
