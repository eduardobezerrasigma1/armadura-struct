import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { emptyProject, newBar, schedule } from '../../src/domain/model';
import { completeOwnership } from '../../src/domain/hierarchy';
import type { Project } from '../../src/domain/types';
import {
  confirmProjectReplacement,
  useCompatibleProjectFolders,
} from './projectSetup.helpers';
const dialog = (p: Page) =>
  p.getByRole('dialog', { name: 'Novo projeto', exact: true });
async function load(page: Page, p: Project) {
  await page.goto('/');
  await expect(page.locator('.busy-overlay')).toHaveCount(0);
  await page.getByTestId('project-input').setInputFiles({
    name: 'setup-base.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await expect(page.getByRole('banner').locator('.window-project')).toHaveText(
    p.name,
  );
}
async function save(page: Page): Promise<Project> {
  const close = page.getByRole('button', { name: 'Fechar aviso', exact: true });
  if (await close.isVisible()) await close.click();
  const event = page.waitForEvent('download');
  await page
    .locator('.quick-tools')
    .getByRole('button', { name: 'Salvar projeto', exact: true })
    .click();
  return JSON.parse(readFileSync((await (await event).path())!, 'utf8'));
}
async function open(page: Page) {
  await page
    .locator('.quick-tools')
    .getByRole('button', { name: 'Novo projeto', exact: true })
    .click();
  await expect(dialog(page)).toBeVisible();
  await expect(
    dialog(page).getByLabel('Nome do projeto', { exact: true }),
  ).toBeFocused();
}
async function organize(page: Page) {
  await dialog(page)
    .getByText('Organizar pavimentos, grupos e detalhamentos', {
      exact: true,
    })
    .click();
}
async function recovery(page: Page) {
  return page.evaluate(
    () =>
      new Promise<string | undefined>((resolve, reject) => {
        const r = indexedDB.open('armadurastruct', 1);
        r.onsuccess = () => {
          const db = r.result,
            q = db
              .transaction('projects')
              .objectStore('projects')
              .get('current');
          q.onsuccess = () => {
            db.close();
            resolve(q.result);
          };
          q.onerror = () => {
            db.close();
            reject(q.error);
          };
        };
        r.onerror = () => reject(r.error);
      }),
  );
}
async function command(page: Page, s: string) {
  const box = page.getByRole('textbox', { name: 'Comando CAD' });
  await box.fill(s);
  await box.press('Enter');
}
const seed = () =>
  completeOwnership({
    ...emptyProject(),
    name: 'Obra atual',
    bars: [{ ...newBar('N1'), id: 'old-bar', quantity: 8 }],
  });

test('estrutura personalizada tem os mesmos IDs da prévia, pais corretos, destino ativo, persistência e criação reversível', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const base = seed();
  await load(page, base);
  await open(page);
  await dialog(page)
    .getByLabel('Nome do projeto', { exact: true })
    .fill('Estrutura inicial');
  await organize(page);
  const floor0 = dialog(page).getByTestId('setup-floor').nth(0);
  await floor0.getByLabel('Nome do pavimento', { exact: true }).fill('Térreo');
  const el0 = dialog(page).getByTestId('setup-element').nth(0);
  await el0.getByLabel('Nome do grupo', { exact: true }).fill('V01');
  await el0
    .getByLabel('Nome do detalhamento', { exact: true })
    .fill('Armação V01');
  await floor0
    .getByRole('button', { name: 'Adicionar grupo', exact: true })
    .click();
  await dialog(page)
    .getByTestId('setup-element')
    .nth(1)
    .getByLabel('Nome do grupo', { exact: true })
    .fill('P01');
  await dialog(page)
    .getByRole('button', { name: 'Adicionar pavimento', exact: true })
    .click();
  const floor1 = dialog(page).getByTestId('setup-floor').nth(1);
  await floor1
    .getByLabel('Nome do pavimento', { exact: true })
    .fill('Cobertura');
  await floor1
    .getByRole('button', { name: 'Adicionar grupo', exact: true })
    .click();
  const el2 = dialog(page).getByTestId('setup-element').nth(2);
  await el2.getByLabel('Nome do grupo', { exact: true }).fill('V02');
  await el2
    .getByLabel('Nome do detalhamento', { exact: true })
    .fill('Armação V02');
  const preview = await dialog(page)
    .locator('[data-node-id]')
    .evaluateAll((es) => es.map((e) => e.getAttribute('data-node-id')));
  const active = (await el2
    .getByTestId('setup-detail')
    .getAttribute('data-node-id'))!;
  await dialog(page)
    .getByLabel('Detalhamento inicial ativo', { exact: true })
    .selectOption(active);
  await confirmProjectReplacement(page);
  await dialog(page)
    .locator('.setup-body')
    .evaluate((el) => (el.scrollTop = 0));
  await page.screenshot({ path: 'test-results/project-setup-legacy.png' });
  await dialog(page)
    .getByRole('button', { name: 'Criar projeto', exact: true })
    .click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(
    page.getByRole('tab', { name: 'Projeto', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await expect(
    page.getByLabel('Detalhamento ativo', { exact: true }),
  ).toHaveValue(active);
  const p = await save(page);
  expect(
    [...p.hierarchy.floors, ...p.hierarchy.elements, ...p.hierarchy.details]
      .map((n) => n.id)
      .sort(),
  ).toEqual(preview.sort());
  expect(p.hierarchy.elements).toHaveLength(3);
  expect(p.bars).toEqual([]);
  expect(p.hierarchy.placements).toEqual([]);
  for (const [name, elements] of [
    ['Térreo', ['V01', 'P01']],
    ['Cobertura', ['V02']],
  ] as const) {
    const f = p.hierarchy.floors.find((f) => f.name === name)!;
    expect(
      p.hierarchy.elements.filter((e) => e.floorId === f.id).map((e) => e.name),
    ).toEqual(elements);
  }
  for (const s of ['B', '0,0', '1000,0', '']) await command(page, s);
  await page.keyboard.press('Escape');
  const q = await save(page);
  expect(q.hierarchy.objectDetails[q.bars[0].id]).toBe(active);
  expect(schedule(q)[0].quantity).toBe(1);
  await command(page, 'U');
  expect(await save(page)).toEqual(p);
  await command(page, 'U');
  expect(await save(page)).toEqual(base);
  await command(page, 'REDO');
  expect(await save(page)).toEqual(p);
  await command(page, 'REDO');
  expect(await save(page)).toEqual(q);
  await load(page, q);
  expect(await save(page)).toEqual(q);
  await page.getByRole('tab', { name: 'Projeto', exact: true }).click();
  await page
    .getByRole('button', { name: 'Editar grupo V02', exact: true })
    .click();
  await page.getByLabel('Nome do grupo', { exact: true }).fill('V03');
  await page
    .getByRole('button', { name: 'Salvar alterações', exact: true })
    .click();
  const renamed = await save(page);
  expect(renamed.hierarchy.objectDetails[q.bars[0].id]).toBe(active);
  expect(renamed.hierarchy.elements.find((e) => e.name === 'V03')?.id).toBe(
    p.hierarchy.elements.find((e) => e.name === 'V02')!.id,
  );
  expect(errors).toEqual([]);
});

test('cancelar, Esc, fechar e fundo descartam só o rascunho, conservando recuperação, histórico e comando pendente', async ({
  page,
}) => {
  const base = seed();
  await load(page, base);
  await expect
    .poll(async () => JSON.parse((await recovery(page)) ?? 'null')?.id)
    .toBe(base.id);
  const prior = await recovery(page);
  for (const method of ['cancel', 'escape', 'close', 'backdrop']) {
    await open(page);
    await dialog(page)
      .getByLabel('Nome do projeto', { exact: true })
      .fill('Descartar rascunho');
    await organize(page);
    await dialog(page)
      .getByRole('button', { name: 'Adicionar pavimento', exact: true })
      .click();
    if (method === 'cancel')
      await dialog(page)
        .getByRole('button', { name: 'Cancelar', exact: true })
        .click();
    else if (method === 'escape') await page.keyboard.press('Escape');
    else if (method === 'close')
      await dialog(page)
        .getByRole('button', { name: 'Fechar Novo projeto', exact: true })
        .click();
    else await page.mouse.click(3, 3);
    await expect(dialog(page)).toHaveCount(0);
    expect(await save(page)).toEqual(base);
    expect(await recovery(page)).toBe(prior);
  }
  await command(page, 'B');
  await command(page, '0,0');
  await command(page, '1000,0');
  await open(page);
  await expect(dialog(page)).toContainText('comando em andamento');
  await page.keyboard.press('Escape');
  await command(page, '');
  await page.keyboard.press('Escape');
  const withBar = await save(page);
  expect(withBar.bars).toHaveLength(2);
  await command(page, 'U');
  expect(await save(page)).toEqual(base);
});

test('remoções explicam os filhos, mínimo e nomes inválidos são tratados; reabrir não conserva resíduos', async ({
  page,
}) => {
  const base = seed();
  await load(page, base);
  await open(page);
  await organize(page);
  await dialog(page)
    .getByTestId('setup-floor')
    .first()
    .getByRole('button', { name: 'Remover pavimento', exact: true })
    .click();
  await expect(dialog(page).getByRole('alert')).toContainText(
    'Mantenha ao menos',
  );
  await dialog(page)
    .getByRole('button', { name: 'Adicionar pavimento', exact: true })
    .click();
  const f = dialog(page).getByTestId('setup-floor').nth(1);
  await f.getByLabel('Nome do pavimento', { exact: true }).fill('Cobertura');
  await f.getByRole('button', { name: 'Adicionar grupo', exact: true }).click();
  await f.getByLabel('Nome do grupo', { exact: true }).fill('V02');
  await f
    .getByRole('button', { name: 'Remover pavimento', exact: true })
    .click();
  const confirm = dialog(page).getByRole('group', {
    name: 'Confirmar remoção do rascunho',
  });
  await expect(confirm).toContainText('V02');
  await expect(confirm).not.toContainText('Desenho principal');
  await confirm
    .getByRole('button', { name: 'Manter itens', exact: true })
    .click();
  await expect(f).toBeVisible();
  await f
    .getByRole('button', { name: 'Remover pavimento', exact: true })
    .click();
  await confirm
    .getByRole('button', { name: 'Remover conjunto do rascunho', exact: true })
    .click();
  await expect(dialog(page).getByTestId('setup-floor')).toHaveCount(1);
  await expect(dialog(page).getByTestId('setup-element')).toHaveCount(1);
  await expect(dialog(page).getByTestId('setup-detail')).toHaveCount(1);
  const name = dialog(page).getByLabel('Nome do projeto', { exact: true });
  await name.fill(' ');
  await name.press('Tab');
  await expect(
    dialog(page).getByText(
      'Informe um nome de projeto de 1 a 150 caracteres.',
      { exact: true },
    ),
  ).toBeVisible();
  await confirmProjectReplacement(page);
  await dialog(page)
    .getByRole('button', { name: 'Criar projeto', exact: true })
    .click();
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await save(page)).toEqual(base);
  await open(page);
  await expect(
    dialog(page).getByLabel('Nome do projeto', { exact: true }),
  ).toHaveValue('Novo projeto');
  await organize(page);
  await expect(dialog(page).getByTestId('setup-floor')).toHaveCount(1);
  await expect(
    dialog(page).getByLabel('Nome do pavimento', { exact: true }),
  ).toHaveValue('Térreo');
});

test('nome apenas é rápido, confirmação e salvar cópia protegem substituição, clique duplo cria uma operação', async ({
  page,
}) => {
  const base = emptyProject();
  await load(page, base);
  await page.getByRole('tab', { name: 'Arquivo', exact: true }).click();
  await page
    .locator('.ribbon-content')
    .getByRole('button', { name: 'Novo projeto', exact: true })
    .click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByRole('checkbox')).toHaveCount(0);
  await dialog(page)
    .getByLabel('Nome do projeto', { exact: true })
    .fill('Somente nome');
  await dialog(page)
    .getByLabel('Nome do projeto', { exact: true })
    .press('Enter');
  await expect(dialog(page)).toHaveCount(0);
  const p = await save(page);
  expect(p.name).toBe('Somente nome');
  expect(p.bars).toEqual([]);
  expect(p.hierarchy.elements).toHaveLength(1);
  await open(page);
  await expect(
    dialog(page).getByRole('button', { name: 'Criar projeto', exact: true }),
  ).toBeDisabled();
  const event = page.waitForEvent('download');
  await dialog(page)
    .getByRole('button', { name: 'Salvar cópia do projeto atual', exact: true })
    .click();
  const backup = JSON.parse(
    readFileSync((await (await event).path())!, 'utf8'),
  );
  expect(backup).toEqual(p);
  await expect(
    dialog(page).getByRole('checkbox', {
      name: 'Confirmar substituição do projeto atual',
      exact: true,
    }),
  ).toBeChecked();
  await dialog(page)
    .getByLabel('Nome do projeto', { exact: true })
    .fill('Duplo clique');
  await dialog(page)
    .getByRole('button', { name: 'Criar projeto', exact: true })
    .dblclick();
  await expect(dialog(page)).toHaveCount(0);
  const q = await save(page);
  expect(q.name).toBe('Duplo clique');
  await command(page, 'U');
  expect(await save(page)).toEqual(p);
  await command(page, 'REDO');
  expect(await save(page)).toEqual(q);
});

test('reparentear no rascunho, teclado/foco e rolagem funcionam em janela menor e em ambos os fundos', async ({
  page,
}) => {
  await page.setViewportSize({ width: 600, height: 600 });
  const base = seed();
  await load(page, base);
  for (const light of [false, true]) {
    if (light)
      await page
        .getByRole('button', { name: 'Alternar fundo do desenho', exact: true })
        .click();
    await open(page);
    await organize(page);
    await dialog(page)
      .getByRole('button', { name: 'Adicionar pavimento', exact: true })
      .click();
    const newFloor = dialog(page).getByTestId('setup-floor').nth(1);
    await newFloor
      .getByLabel('Nome do pavimento', { exact: true })
      .fill('Cobertura');
    const id = (await newFloor.getAttribute('data-node-id'))!;
    const element = dialog(page).getByTestId('setup-element').first();
    await element.getByText('Alterar pavimento', { exact: true }).click();
    await element
      .getByLabel('Pavimento do grupo', { exact: true })
      .selectOption(id);
    await expect(newFloor.getByTestId('setup-element')).toHaveCount(1);
    await confirmProjectReplacement(page);
    const create = dialog(page).getByRole('button', {
      name: 'Criar projeto',
      exact: true,
    });
    await expect(create).toBeVisible();
    if (light)
      await page.screenshot({ path: 'test-results/new-project-small.png' });
    await create.focus();
    await page.keyboard.press('Tab');
    expect(
      await page.evaluate(() => !!document.activeElement?.closest('dialog')),
    ).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    expect(await save(page)).toEqual(base);
  }
});

test('uma troca concorrente de projeto invalida a confirmação sem aplicar o rascunho sobre outro arquivo', async ({
  page,
}) => {
  const base = seed();
  await load(page, base);
  await open(page);
  await dialog(page)
    .getByLabel('Nome do projeto', { exact: true })
    .fill('Não aplicar');
  await confirmProjectReplacement(page);
  const other = { ...emptyProject(), name: 'Outro arquivo' };
  await page.getByTestId('project-input').setInputFiles({
    name: 'other.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(other)),
  });
  await expect(dialog(page).getByRole('alert')).toContainText(
    'projeto aberto mudou',
  );
  await expect(
    dialog(page).getByRole('button', { name: 'Criar projeto', exact: true }),
  ).toBeDisabled();
  await page.keyboard.press('Escape');
  expect(await save(page)).toEqual(other);
});

useCompatibleProjectFolders();
