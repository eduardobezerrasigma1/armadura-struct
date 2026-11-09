import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { emptyProject, decodeProject } from '../../src/domain/model';
import type { Project } from '../../src/domain/types';
import {
  installDirectoryMock,
  type DirectoryMock,
} from '../fixtures/projectDirectory';
const dialog = (p: Page) =>
  p.getByRole('dialog', { name: 'Novo projeto', exact: true });
const file = 'save-v1/projeto.armstruct.json';
const mock = (p: Page) =>
  p.evaluate(() => {
    const f = (window as unknown as { folderMock: DirectoryMock }).folderMock;
    return {
      filesA: [...f.roots.A.files],
      filesB: [...f.roots.B.files],
      dirsA: [...f.roots.A.dirs],
      writes: f.writes,
    };
  });
async function raw(p: Page, folder = 'A') {
  const m = await mock(p);
  return (folder === 'A' ? m.filesA : m.filesB).find(([n]) => n === file)?.[1];
}
async function open(p: Page, name: string) {
  const notice = p.getByRole('button', { name: 'Fechar aviso', exact: true });
  if (await notice.isVisible()) await notice.click();
  await p
    .locator('.quick-tools')
    .getByRole('button', { name: 'Novo projeto', exact: true })
    .click();
  await expect(dialog(p)).toBeVisible();
  await dialog(p).getByLabel('Nome do projeto', { exact: true }).fill(name);
  const ack = dialog(p).getByRole('checkbox', {
    name: 'Confirmar substituição do projeto atual',
    exact: true,
  });
  if (await ack.isVisible()) await ack.check();
}
async function choose(p: Page, key: 'A' | 'B' = 'A') {
  await p.evaluate((k) => {
    (window as unknown as { folderMock: DirectoryMock }).folderMock.selected =
      k;
  }, key);
  await dialog(p)
    .getByRole('button', { name: 'Escolher pasta', exact: true })
    .click();
  await expect(
    dialog(p).getByLabel('Pasta do projeto', { exact: true }),
  ).toHaveValue(key);
}
async function create(p: Page, name: string, key: 'A' | 'B') {
  await open(p, name);
  await choose(p, key);
  await dialog(p)
    .getByRole('button', { name: 'Criar projeto', exact: true })
    .click();
  await expect(dialog(p)).toHaveCount(0);
  await expect(p.locator('.save-status')).toHaveText(
    'Salvo na pasta do projeto',
  );
}
async function files(p: Page) {
  const menu = p.locator('.folder-menu');
  if (!(await menu.locator('.folder-actions').isVisible()))
    await menu.locator('summary').click();
}
async function copy(p: Page): Promise<Project> {
  const notice = p.getByRole('button', { name: 'Fechar aviso', exact: true });
  if (await notice.isVisible()) await notice.click();
  await files(p);
  const event = p.waitForEvent('download');
  await p
    .getByRole('button', { name: 'Salvar cópia independente', exact: true })
    .click();
  return JSON.parse(readFileSync((await (await event).path())!, 'utf8'));
}
async function command(p: Page, s: string) {
  const box = p.getByRole('textbox', { name: 'Comando CAD' });
  await box.fill(s);
  await box.press('Enter');
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(installDirectoryMock);
  await page.goto('/');
  await expect(page.locator('.busy-overlay')).toHaveCount(0);
});
test('escolha é rascunho, cancelar mantém arquivos/projeto e criar salva no local mostrado', async ({
  page,
}) => {
  const before = await copy(page);
  await open(page, 'Obra CON/ç.');
  await choose(page);
  expect((await mock(page)).dirsA).toEqual([]);
  await page.evaluate(() => {
    (window as unknown as { folderMock: DirectoryMock }).folderMock.cancel =
      true;
  });
  await dialog(page)
    .getByRole('button', { name: 'Escolher pasta', exact: true })
    .click();
  await expect(
    dialog(page).getByLabel('Pasta do projeto', { exact: true }),
  ).toHaveValue('A');
  await expect(
    dialog(page).getByText('Arquivo principal:', { exact: false }),
  ).toContainText('A/' + file);
  await page.screenshot({
    path: 'docs/project-folder-draft.png',
    fullPage: true,
  });
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
  expect(await copy(page)).toEqual(before);
  expect((await mock(page)).writes).toHaveLength(0);
  await page.evaluate(() => {
    (window as unknown as { folderMock: DirectoryMock }).folderMock.cancel =
      false;
  });
  await create(page, 'Obra A', 'A');
  const disk = decodeProject((await raw(page))!);
  expect(disk.name).toBe('Obra A');
  expect(disk.bars).toEqual([]);
  expect(await copy(page)).toEqual(disk);
  expect((await mock(page)).dirsA).toEqual(['save-v1']);
  await files(page);
  await page.screenshot({
    path: 'docs/project-folder-saved.png',
    fullPage: true,
  });
});
test('A/B, edição, histórico, cópia importada e reautorização após recarregar não cruzam destinos', async ({
  page,
}) => {
  await create(page, 'A', 'A');
  await command(page, 'B');
  await command(page, '0,0');
  await command(page, '1000,0');
  // Keyboard activation of the file disclosure is a query, never a CAD Enter.
  const summary = page.locator('.folder-menu > summary');
  await summary.focus();
  await summary.press('Enter');
  await expect(page.locator('.folder-actions')).toBeVisible();
  await summary.press('Escape');
  expect((await copy(page)).bars).toHaveLength(0);
  await command(page, '');
  await page.keyboard.press('Escape');
  await expect
    .poll(async () => decodeProject((await raw(page))!).bars.length)
    .toBe(1);
  const a = decodeProject((await raw(page))!);
  await create(page, 'B', 'B');
  const b = await raw(page, 'B');
  await page
    .locator('.quick-tools')
    .getByRole('button', { name: 'Desfazer', exact: true })
    .click();
  await expect(page.getByRole('banner').locator('.window-project')).toHaveText(
    'A',
  );
  await expect(page.locator('.save-status')).toHaveText(
    'Salvo na pasta do projeto',
  );
  expect(decodeProject((await raw(page))!)).toEqual(a);
  expect(await raw(page, 'B')).toBe(b);
  await page.getByTestId('project-input').setInputFiles({
    name: 'copia.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(a)),
  });
  await files(page);
  await expect(
    page.getByText('Sem pasta autorizada nesta sessão', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('.save-status')).toHaveText(
    'Apenas recuperável localmente',
  );
  await page.reload();
  await expect(page.locator('.busy-overlay')).toHaveCount(0);
  await expect(page.locator('.save-status')).toHaveText(
    'Apenas recuperável localmente',
  );
  expect((await mock(page)).writes).toHaveLength(0);
  await page.evaluate(
    ({ value, file }) => {
      const f = (window as unknown as { folderMock: DirectoryMock }).folderMock;
      f.roots.A.dirs.add('save-v1');
      f.roots.A.files.set(file, value);
    },
    { file, value: JSON.stringify(a, null, 2) },
  );
  await files(page);
  await page
    .getByRole('button', { name: 'Localizar/associar pasta', exact: true })
    .click();
  await expect(page.locator('.save-status')).toHaveText(
    'Salvo na pasta do projeto',
  );
  expect(await copy(page)).toEqual(a);
  expect((await mock(page)).writes).toHaveLength(0);
});
test('falha inicial mantém rascunho/projeto, bloqueia cancelamento durante commit e permite outra pasta', async ({
  page,
}) => {
  const before = await copy(page);
  await open(page, 'Rascunho preservado');
  await choose(page);
  await page.evaluate(() => {
    const f = (window as unknown as { folderMock: DirectoryMock }).folderMock;
    f.pause = true;
  });
  await dialog(page)
    .getByRole('button', { name: 'Criar projeto', exact: true })
    .click();
  await expect(dialog(page).locator('form')).toHaveAttribute(
    'aria-busy',
    'true',
  );
  await page.keyboard.press('Escape');
  await dialog(page)
    .getByRole('button', { name: 'Fechar Novo projeto', exact: true })
    .click();
  await expect(dialog(page)).toBeVisible();
  await expect(
    dialog(page).getByRole('button', { name: 'Criar projeto', exact: true }),
  ).toBeDisabled();
  await page.evaluate(() => {
    const f = (window as unknown as { folderMock: DirectoryMock }).folderMock;
    f.error = 'QuotaExceededError';
    f.resume();
  });
  await expect(dialog(page).getByRole('alert')).toContainText(
    'QuotaExceededError',
  );
  await expect(page.getByRole('banner').locator('.window-project')).toHaveText(
    before.name,
  );
  await expect(
    dialog(page).getByLabel('Nome do projeto', { exact: true }),
  ).toHaveValue('Rascunho preservado');
  expect((await mock(page)).writes).toHaveLength(0);
  await page.screenshot({
    path: 'docs/project-folder-failure.png',
    fullPage: true,
  });
  await page.evaluate(() => {
    (window as unknown as { folderMock: DirectoryMock }).folderMock.error = '';
  });
  await choose(page, 'B');
  await dialog(page)
    .getByRole('button', { name: 'Criar projeto', exact: true })
    .dblclick();
  await expect(dialog(page)).toHaveCount(0);
  expect(
    (await mock(page)).writes.filter((w) => w.folder === 'B'),
  ).toHaveLength(1);
  expect(decodeProject((await raw(page, 'B'))!).name).toBe(
    'Rascunho preservado',
  );
});
test('pasta ocupada oferece abrir existente sem sobrescrever; falha posterior conserva arquivo e recuperação', async ({
  page,
}) => {
  const p = emptyProject();
  p.name = 'Existente';
  await page.evaluate(
    ({ s, file }) => {
      const f = (window as unknown as { folderMock: DirectoryMock }).folderMock;
      f.roots.A.dirs.add('save-v1');
      f.roots.A.files.set(file, s);
      f.roots.A.files.set('arquivo-alheio.txt', 'preservar');
    },
    { file, s: JSON.stringify(p) },
  );
  await open(page, 'Outro');
  await choose(page);
  await dialog(page)
    .getByRole('button', { name: 'Criar projeto', exact: true })
    .click();
  await expect(dialog(page).getByRole('alert')).toContainText('já possui');
  await dialog(page)
    .getByRole('button', {
      name: 'Abrir projeto existente nesta pasta',
      exact: true,
    })
    .click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByRole('banner').locator('.window-project')).toHaveText(
    'Existente',
  );
  const old = await raw(page);
  await page.evaluate(() => {
    (window as unknown as { folderMock: DirectoryMock }).folderMock.denied =
      true;
    window.dispatchEvent(new Event('focus'));
  });
  await expect(page.locator('.save-status')).toContainText(
    'Acesso perdido/falha',
  );
  expect(await raw(page)).toBe(old);
  expect(
    (await mock(page)).filesA.find(([n]) => n === 'arquivo-alheio.txt')?.[1],
  ).toBe('preservar');
  const copySaved = await copy(page);
  expect(copySaved.id).toBe(p.id);
});
test('janela baixa mantém rodapé utilizável e modo sem API permite criar com recuperação e download', async ({
  page,
}) => {
  await page.setViewportSize({ width: 600, height: 480 });
  await open(page, 'Compacto');
  await choose(page);
  await expect(
    dialog(page).getByRole('button', { name: 'Criar projeto', exact: true }),
  ).toBeInViewport();
  await page.screenshot({
    path: 'docs/project-folder-compact.png',
    fullPage: true,
  });
  await page.keyboard.press('Escape');
  await page.addInitScript(() =>
    Object.defineProperty(window, 'showDirectoryPicker', {
      value: undefined,
      configurable: true,
    }),
  );
  await page.reload();
  await expect(page.locator('.busy-overlay')).toHaveCount(0);
  await open(page, 'Compatível');
  await expect(
    dialog(page).getByText('Este navegador não oferece escrita de diretório.', {
      exact: false,
    }),
  ).toBeVisible();
  await dialog(page)
    .getByRole('button', { name: 'Criar projeto', exact: true })
    .click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.locator('.save-status')).toHaveText(
    'Apenas recuperável localmente',
  );
  expect((await copy(page)).name).toBe('Compatível');
  expect((await mock(page)).writes).toHaveLength(0);
});

test('erro textual do adaptador nativo permanece legível no campo sem trocar o documento', async ({
  page,
}) => {
  const before = await copy(page);
  await open(page, 'Sem permissão');
  await choose(page);
  await page.evaluate(() => {
    (window as unknown as { folderMock: DirectoryMock }).folderMock.error =
      'native-string';
  });
  await dialog(page)
    .getByRole('button', { name: 'Criar projeto', exact: true })
    .click();
  await expect(dialog(page).getByRole('alert')).toContainText(
    'Pasta somente leitura',
  );
  await expect(
    dialog(page).getByLabel('Pasta do projeto', { exact: true }),
  ).toBeFocused();
  await expect(page.getByRole('banner').locator('.window-project')).toHaveText(
    before.name,
  );
  await expect(
    dialog(page).getByLabel('Nome do projeto', { exact: true }),
  ).toHaveValue('Sem permissão');
  expect((await mock(page)).writes).toHaveLength(0);
});
