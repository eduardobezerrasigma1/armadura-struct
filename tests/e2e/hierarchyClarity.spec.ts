import { useCompatibleProjectFolders } from './projectSetup.helpers';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { emptyProject, newBar } from '../../src/domain/model';
import { completeOwnership } from '../../src/domain/hierarchy';
import type { Project } from '../../src/domain/types';

async function load(page: Page, p: Project) {
  await page.goto('/');
  await expect(page.locator('.busy-overlay')).toHaveCount(0);
  await page.getByTestId('project-input').setInputFiles({
    name: 'organização.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await expect(page.locator('.window-project')).toHaveText(p.name);
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
async function command(page: Page, s: string) {
  const input = page.getByRole('textbox', { name: 'Comando CAD' });
  await input.fill(s);
  await input.press('Enter');
}

test('Térreo > Vigas > V1/V2/V3 e Pilares > P1 abrem diretamente; criar aço, renomear, histórico e reabrir mantêm destinos', async ({
  page,
}) => {
  test.slow();
  await load(page, emptyProject());
  await page
    .locator('.quick-tools')
    .getByRole('button', { name: 'Novo projeto', exact: true })
    .click();
  const dialog = page.getByRole('dialog', {
    name: 'Novo projeto',
    exact: true,
  });
  await dialog
    .getByLabel('Nome do projeto', { exact: true })
    .fill('Organização por grupos');
  await dialog
    .getByText('Organizar pavimentos, grupos e detalhamentos', { exact: true })
    .click();
  const beams = dialog.getByTestId('setup-element').first();
  await expect(beams.getByLabel('Nome do grupo', { exact: true })).toHaveValue(
    'Vigas',
  );
  for (let i = 0; i < 2; i++)
    await beams
      .getByRole('button', { name: 'Adicionar detalhamento', exact: true })
      .click();
  expect(
    await beams
      .getByLabel('Nome do detalhamento', { exact: true })
      .evaluateAll((es) => es.map((e) => (e as HTMLInputElement).value)),
  ).toEqual(['V1', 'V2', 'V3']);
  await dialog
    .getByTestId('setup-floor')
    .first()
    .getByRole('button', { name: 'Adicionar grupo', exact: true })
    .click();
  const pillars = dialog.getByTestId('setup-element').nth(1);
  await expect(
    pillars.getByLabel('Nome do grupo', { exact: true }),
  ).toHaveValue('Pilares');
  await expect(
    pillars.getByLabel('Nome do detalhamento', { exact: true }),
  ).toHaveValue('P1');
  await expect(dialog).not.toContainText('Desenho principal');
  await dialog.locator('.setup-body').evaluate((e) => (e.scrollTop = 0));
  await page.screenshot({ path: 'docs/new-project-setup.png' });
  await dialog
    .getByRole('button', { name: 'Criar projeto', exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.hierarchy-drawing')).toHaveCount(0);
  const base = await save(page),
    h = base.hierarchy;
  const v1 = h.details.find((d) => d.name === 'V1')!,
    v2 = h.details.find((d) => d.name === 'V2')!;
  await page
    .getByRole('button', { name: 'Abrir detalhamento V1', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Aba desenho V1', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Adicionar grupo', exact: true }),
  ).toBeDisabled();
  for (const s of ['B', '0,0', '1000,0', '']) await command(page, s);
  await page.keyboard.press('Escape');
  const physical = await save(page);
  expect(physical.bars).toHaveLength(1);
  expect(physical.hierarchy.objectDetails[physical.bars[0].id]).toBe(v1.id);
  await page.getByRole('tab', { name: 'Projeto', exact: true }).click();
  await page
    .getByRole('button', { name: 'Editar detalhamento V1', exact: true })
    .click();
  await page.getByLabel('Nome do detalhamento', { exact: true }).fill('V10');
  await page
    .getByRole('button', { name: 'Salvar alterações', exact: true })
    .click();
  const renamed = await save(page);
  expect(renamed.bars).toEqual(physical.bars);
  expect(renamed.hierarchy.drawings).toEqual(physical.hierarchy.drawings);
  expect(renamed.hierarchy.objectDetails).toEqual(
    physical.hierarchy.objectDetails,
  );
  await expect(
    page.getByRole('button', { name: 'Aba desenho V10', exact: true }),
  ).toBeVisible();
  await command(page, 'U');
  expect(await save(page)).toEqual(physical);
  await command(page, 'REDO');
  expect(await save(page)).toEqual(renamed);
  await page
    .getByRole('button', { name: 'Abrir detalhamento V2', exact: true })
    .click();
  await expect(
    page.getByLabel('Detalhamento ativo', { exact: true }),
  ).toHaveValue(v2.id);
  expect(await save(page)).toEqual(renamed);
  await page
    .getByRole('button', { name: 'Abrir detalhamento V10', exact: true })
    .click();
  await page.screenshot({ path: 'docs/project-groups-tree.png' });
  await page
    .getByRole('button', { name: 'Organizar projeto', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Adicionar grupo', exact: true }),
  ).toBeEnabled();
  expect(await save(page)).toEqual(renamed);
  await page.getByTestId('project-input').setInputFiles({
    name: 'grupos.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(renamed)),
  });
  expect(await save(page)).toEqual(renamed);
  await page
    .getByRole('button', { name: 'Abrir detalhamento V10', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Aba desenho V10', exact: true }),
  ).toBeVisible();
});

test('arquivos anteriores e desenhos adicionais mantêm nomes, IDs e folhas sem adicionar nível obrigatório', async ({
  page,
}) => {
  let p = emptyProject();
  p.name = 'Arquivo anterior';
  p.hierarchy.elements[0].name = 'V1 antigo';
  p.hierarchy.details[0].name = 'Armaduras V1';
  p.hierarchy.drawings.push({
    id: 'other-drawing',
    detailId: p.hierarchy.details[0].id,
    name: 'Corte A',
  });
  p = completeOwnership({
    ...p,
    bars: [{ ...newBar('N1'), id: 'legacy-bar', quantity: 8 }],
  });
  await load(page, p);
  await page.getByRole('tab', { name: 'Projeto', exact: true }).click();
  await page
    .getByRole('button', {
      name: 'Abrir detalhamento Armaduras V1',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('button', { name: 'Aba desenho Armaduras V1', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', {
      name: 'Abrir desenho Armaduras V1 · Corte A',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('button', {
      name: 'Aba desenho Armaduras V1 · Corte A',
      exact: true,
    }),
  ).toBeVisible();
  expect(await save(page)).toEqual(p);
});

test('novo projeto mostra exemplos legíveis em janela compacta e Esc descarta o rascunho', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 740 });
  const p = emptyProject();
  await load(page, p);
  for (const light of [false, true]) {
    if (light)
      await page
        .getByRole('button', { name: 'Alternar fundo do desenho', exact: true })
        .click();
    await page
      .locator('.quick-tools')
      .getByRole('button', { name: 'Novo projeto', exact: true })
      .click();
    const dialog = page.getByRole('dialog', {
      name: 'Novo projeto',
      exact: true,
    });
    await dialog
      .getByText('Organizar pavimentos, grupos e detalhamentos', {
        exact: true,
      })
      .click();
    await expect(dialog.getByLabel('Como organizar o projeto')).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Criar projeto', exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByLabel('Nome do detalhamento', { exact: true }),
    ).toBeInViewport({ ratio: 1 });
    await expect(dialog).not.toContainText('Desenho principal');
    if (light)
      await page.screenshot({ path: 'docs/project-groups-compact.png' });
    await page.keyboard.press('Escape');
    expect(await save(page)).toEqual(p);
  }
});

useCompatibleProjectFolders();
