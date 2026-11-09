import { maskManipFixture } from './fixtures/maskManipulation';
import { toCsv, toDxf } from '../src/lib/exports';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeProject, emptyProject, schedule } from '../src/domain/model';
import {
  managedNameConflict,
  createProjectInFolder,
  saveProjectFolder,
  pickProjectFolder,
  projectFolderLabel,
  inheritProjectFolder,
  detachProject,
  folderAvailable,
  hasPendingFolderWrites,
  rememberFolder,
  folderHint,
  PROJECT_FILE,
  attachProjectFolder,
} from '../src/lib/projectFolder';
import {
  installDirectoryMock,
  type DirectoryMock,
} from './fixtures/projectDirectory';
const project = () => decodeProject(JSON.stringify(emptyProject()));
let fs: DirectoryMock;
beforeEach(() => {
  vi.stubGlobal('window', {});
  vi.stubGlobal('navigator', {
    locks: { request: async (_: string, fn: () => Promise<unknown>) => fn() },
  });
  const memory = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => memory.set(k, v),
    removeItem: (k: string) => memory.delete(k),
  });
  fs = installDirectoryMock();
});
afterEach(() => vi.unstubAllGlobals());
async function folder() {
  return (await pickProjectFolder())!;
}
describe('contrato da pasta e snapshots', () => {
  it.each(['SAVE-V1', 'save-v1.', 'save-v1 ', 'ſave-v1'])(
    'recusa alias portátil de nome administrado %s sem tocar arquivos',
    async (alias) => {
      expect(managedNameConflict(alias, 'save-v1')).toBe(true);
      fs.roots.A.dirs.add(alias);
      await expect((await folder()).read()).rejects.toThrow('caixa');
      expect([...fs.roots.A.dirs]).toEqual([alias]);
      expect(fs.writes).toEqual([]);
    },
  );
  it('round-trip conserva geometria, máscaras, hierarquia, configurações e aço/RA/CSV/DXF', async () => {
    const p = decodeProject(JSON.stringify(maskManipFixture())),
      folderA = await folder();
    const before = JSON.stringify(p),
      csv = toCsv(p),
      dxf = toDxf(p),
      ra = schedule(p);
    await createProjectInFolder(p, folderA);
    await saveProjectFolder(p);
    const restored = decodeProject((await folderA.read())!);
    expect(JSON.stringify(restored)).toBe(before);
    expect(toCsv(restored)).toBe(csv);
    expect(toDxf(restored)).toBe(dxf);
    expect(schedule(restored)).toEqual(ra);
  });
  it.each([
    'CON',
    '../obra/../../escape',
    'Obra ç \u00e9',
    'NUL. ',
    '..',
    'obra.armstruct.json',
  ])('nome exibido %s nunca compõe caminho', async (name) => {
    const p = { ...project(), name };
    const root = await folder();
    expect(fs.roots.A.dirs.size).toBe(0);
    await createProjectInFolder(p, root);
    expect([...fs.roots.A.files.keys()]).toEqual([PROJECT_FILE]);
    expect([...fs.roots.A.dirs]).toEqual(['save-v1']);
    const saved = decodeProject(fs.roots.A.files.get(PROJECT_FILE)!);
    expect(saved).toEqual(p);
    expect(saved.id).toBe(p.id);
    expect(schedule(saved)).toEqual(schedule(p));
    expect(JSON.stringify(saved)).not.toContain('folderMock');
  });
  it('criação exige pasta livre; outro ID, arquivo vazio ou nomes por caixa são conflitos', async () => {
    const p = project(),
      root = await folder();
    await createProjectInFolder(p, root);
    const original = fs.roots.A.files.get(PROJECT_FILE);
    await expect(createProjectInFolder(project(), root)).rejects.toThrow(
      'Já existe',
    );
    expect(fs.roots.A.files.get(PROJECT_FILE)).toBe(original);
    fs.roots.A.files.set(PROJECT_FILE, '');
    await expect(createProjectInFolder(p, root)).rejects.toThrow('Já existe');
    fs.roots.A.files.clear();
    fs.roots.A.dirs.clear();
    fs.roots.A.dirs.add('SAVE-V1');
    await expect(root.read()).rejects.toThrow('caixa');
    fs.roots.A.dirs.clear();
    fs.roots.A.dirs.add('save-v1');
    fs.roots.A.files.set('save-v1/alheio.txt', 'preservar');
    await expect(root.read()).rejects.toThrow('ocupado');
    expect(fs.roots.A.files.get('save-v1/alheio.txt')).toBe('preservar');
  });
  it('serializa versões e mantém A/B/Undo isolados, mesmo com escrita lenta', async () => {
    const a = project(),
      rootA = await folder();
    await createProjectInFolder(a, rootA);
    const a1 = { ...a, name: 'A1' },
      a2 = { ...a, name: 'A2' };
    inheritProjectFolder(a, a1, a1);
    inheritProjectFolder(a1, a2, a2);
    fs.pause = true;
    const first = saveProjectFolder(a1);
    await new Promise((r) => setTimeout(r, 20));
    expect(hasPendingFolderWrites()).toBe(true);
    const second = saveProjectFolder(a2);
    fs.resume();
    fs.selected = 'B';
    const b = project();
    await createProjectInFolder(b, await folder());
    await Promise.all([first, second]);
    expect(decodeProject(fs.roots.A.files.get(PROJECT_FILE)!).name).toBe('A2');
    expect(decodeProject(fs.roots.B.files.get(PROJECT_FILE)!).id).toBe(b.id);
    await saveProjectFolder(a); // Undo uses A's binding, never B's.
    expect(decodeProject(fs.roots.A.files.get(PROJECT_FILE)!).name).toBe(
      a.name,
    );
    expect(decodeProject(fs.roots.B.files.get(PROJECT_FILE)!).id).toBe(b.id);
  });
  it('falha e alteração externa preservam arquivo íntegro e permitem retry sem trocar pasta', async () => {
    const p = project(),
      root = await folder();
    await createProjectInFolder(p, root);
    const old = fs.roots.A.files.get(PROJECT_FILE)!,
      next = { ...p, name: 'alterado' };
    inheritProjectFolder(p, next, next);
    fs.error = 'QuotaExceededError';
    await expect(saveProjectFolder(next)).rejects.toThrow();
    expect(fs.roots.A.files.get(PROJECT_FILE)).toBe(old);
    expect(hasPendingFolderWrites()).toBe(false);
    fs.error = '';
    await saveProjectFolder(next);
    const saved = fs.roots.A.files.get(PROJECT_FILE)!;
    fs.denied = true;
    await expect(saveProjectFolder(next)).rejects.toThrow('perdido');
    fs.denied = false;
    fs.roots.A.files.set(PROJECT_FILE, saved + ' ');
    await expect(saveProjectFolder(next)).rejects.toThrow('externamente');
    expect(fs.roots.A.files.get(PROJECT_FILE)).toBe(saved + ' ');
  });
  it('arquivo importado do mesmo ID não herda autorização; histórico conserva vínculo e hint não autoriza', async () => {
    const p = project();
    await createProjectInFolder(p, await folder());
    rememberFolder(p);
    expect(folderHint(p)).toBe('A');
    const restored = decodeProject(JSON.stringify(p));
    expect(folderHint(restored)).toBe('A');
    expect(await saveProjectFolder(restored)).toBe(false);
    const copy = detachProject(decodeProject(JSON.stringify(p))),
      complete = { ...copy };
    inheritProjectFolder(p, copy, complete);
    expect(projectFolderLabel(complete)).toBeUndefined();
    const edit = { ...p, name: 'novo' },
      wrapped = { ...edit };
    inheritProjectFolder(p, edit, wrapped);
    expect(projectFolderLabel(wrapped)).toBe('A');
    await expect(async () =>
      attachProjectFolder(project(), await folder(), JSON.stringify(p)),
    ).rejects.toThrow('outro projeto');
  });
  it('cancelamento do picker não escreve; ausência da API não concede acesso de diretório', async () => {
    fs.cancel = true;
    expect(await pickProjectFolder()).toBeNull();
    expect(fs.writes).toHaveLength(0);
    Object.defineProperty(window, 'showDirectoryPicker', { value: undefined });
    expect(folderAvailable()).toBe(false);
    await expect(pickProjectFolder()).rejects.toThrow('não grava uma pasta');
  });
});
