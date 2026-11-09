import {
  confirmProjectReplacement,
  useCompatibleProjectFolders,
} from './projectSetup.helpers';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { emptyProject, newBar } from '../../src/domain/model';
import { completeOwnership } from '../../src/domain/hierarchy';
async function save(page: Page) {
  const event = page.waitForEvent('download');
  await page
    .locator('.quick-tools')
    .getByRole('button', { name: 'Salvar projeto', exact: true })
    .click();
  return JSON.parse(readFileSync((await (await event).path())!, 'utf8'));
}
test('first open shows both native example sheets, comparison, edit, undo, PDF and recovery', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.busy-overlay')).toHaveCount(0);
  await expect(page.getByTestId('sheet-canvas')).toHaveAttribute(
    'aria-label',
    'Prévia da folha 01 · Vigas',
  );
  const before = await save(page);
  expect(before.name).toBe('Exemplo ArmaduraStruct');
  expect(before.bars).toHaveLength(108);
  await page
    .locator('.document-tabs')
    .getByRole('button', { name: 'Aba folha 02 · Pilares', exact: true })
    .click();
  await expect(page.getByTestId('sheet-canvas')).toHaveAttribute(
    'aria-label',
    'Prévia da folha 02 · Pilares',
  );
  await page
    .getByRole('button', { name: 'Conferir exemplo', exact: true })
    .click();
  const dialog = page.getByRole('dialog', {
    name: 'Conferência · Exemplo ArmaduraStruct',
  });
  await expect(dialog).toContainText('64/64 posições');
  await expect(dialog).toContainText('30/64');
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Baixar conferência CSV' }).click();
  expect(readFileSync((await (await download).path())!, 'utf8')).toContain(
    'vigas',
  );
  await page.screenshot({ path: 'docs/examples/initial/conferencia.png' });
  await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.screenshot({ path: 'docs/examples/initial/pilares.png' });
  await page
    .locator('.document-tabs')
    .getByRole('button', { name: 'Aba folha 01 · Vigas', exact: true })
    .click();
  await page.screenshot({ path: 'docs/examples/initial/vigas.png' });
  await page.getByRole('tab', { name: 'Arquivo', exact: true }).click();
  const pdfEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Prancha PDF', exact: true }).click();
  const pdf = readFileSync((await (await pdfEvent).path())!);
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  // Open the composed drawing, then navigate from an insertion to its physical definition.
  await page
    .getByRole('button', {
      name: 'Abrir desenho Prancha de vigas',
      exact: true,
    })
    .click();
  const bar = before.bars.find((b: any) => b.mark === 'V-N39');
  const rep = before.details.find((d: any) => d.barId === bar.id);
  const at = await page
    .locator(`[data-representation-id="${rep.id}"] path`)
    .first()
    .evaluate((path) => {
      const p = (path as SVGPathElement).getPointAtLength(
        (path as SVGPathElement).getTotalLength() * 0.55,
      );
      const screen = new DOMPoint(p.x, p.y).matrixTransform(
        (path as SVGPathElement).getScreenCTM()!,
      );
      return { x: screen.x, y: screen.y };
    });
  await page.mouse.click(at.x, at.y);
  await page
    .getByRole('button', { name: 'Editar armadura física', exact: true })
    .click();
  await page.getByLabel('Quantidade', { exact: true }).fill('3');
  await page.getByLabel('Quantidade', { exact: true }).press('Tab');
  let current = await save(page);
  expect(current.bars.find((b: any) => b.id === bar.id).quantity).toBe(3);
  await page
    .getByRole('button', { name: 'Conferir exemplo', exact: true })
    .click();
  await expect(page.locator('[data-review="vigas:N39"]')).toContainText(
    'Quantidade alterada',
  );
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Fechar', exact: true })
    .click();
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  expect((await save(page)).bars).toEqual(before.bars);
  await page.waitForTimeout(900);
  await page.reload();
  await expect(page.locator('.busy-overlay')).toHaveCount(0);
  expect((await save(page)).bars).toEqual(before.bars);
  // Reopen the full native file, independent of the bundled loader.
  await page.getByTestId('project-input').setInputFiles({
    name: 'reopen.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(before)),
  });
  expect((await save(page)).bars).toEqual(before.bars);
  expect(errors).toEqual([]);
});

test('existing project recovery takes precedence over the initial example; New remains empty', async ({
  page,
}) => {
  const p = completeOwnership({
    ...emptyProject(),
    name: 'Projeto do usuário',
    bars: [{ ...newBar('N1'), quantity: 7 }],
  });
  await page.goto('/');
  await expect(page.locator('.busy-overlay')).toHaveCount(0);
  await page.getByTestId('project-input').setInputFiles({
    name: 'user.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await page.waitForTimeout(900);
  await page.reload();
  await expect(page.locator('.busy-overlay')).toHaveCount(0);
  expect(await save(page)).toEqual(p);
  await expect(
    page.getByRole('button', { name: 'Conferir exemplo', exact: true }),
  ).toHaveCount(0);
  await page
    .locator('.quick-tools')
    .getByRole('button', { name: 'Novo projeto', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByLabel('Nome do projeto', { exact: true })
    .fill('Vazio');
  await confirmProjectReplacement(page);
  await page
    .getByRole('button', { name: 'Criar projeto', exact: true })
    .click();
  expect((await save(page)).bars).toEqual([]);
  // Explicit example load is one undoable operation.
  await page.getByRole('tab', { name: 'Projeto', exact: true }).click();
  await page
    .getByRole('button', { name: 'Carregar projeto de exemplo' })
    .click();
  await expect(page.locator('.busy-overlay')).toHaveCount(0);
  expect((await save(page)).bars).toHaveLength(108);
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  expect((await save(page)).name).toBe('Vazio');
  expect((await save(page)).bars).toEqual([]);
});

test('a damaged recovery is kept intact instead of being overwritten by autosave or the example', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.busy-overlay')).toHaveCount(0);
  await page.waitForTimeout(900);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('armadurastruct', 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      tx.objectStore('projects').put('{damaged-example', 'current');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await expect(page.locator('.busy-overlay')).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText(
    'Não foi possível recuperar',
  );
  await page.waitForTimeout(900);
  const raw = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open('armadurastruct', 1);
      r.onsuccess = () => resolve(r.result);
    });
    const value = await new Promise((resolve) => {
      const r = db
        .transaction('projects')
        .objectStore('projects')
        .get('current');
      r.onsuccess = () => resolve(r.result);
    });
    db.close();
    return value;
  });
  expect(raw).toBe('{damaged-example');
  await expect(
    page.getByRole('button', { name: 'Conferir exemplo', exact: true }),
  ).toHaveCount(0);
});

useCompatibleProjectFolders();
