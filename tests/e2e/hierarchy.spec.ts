import {
  confirmProjectReplacement,
  useCompatibleProjectFolders,
} from './projectSetup.helpers';
import { seedLegacyDemo } from './seedLegacyDemo';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

async function command(page: Page, text: string) {
  const input = page.getByRole('textbox', { name: 'Comando CAD' });
  await input.fill(text);
  await input.press('Enter');
}
async function save(page: Page) {
  const event = page.waitForEvent('download');
  await page
    .locator('.quick-tools')
    .getByRole('button', { name: 'Salvar projeto', exact: true })
    .click();
  return JSON.parse(readFileSync((await (await event).path())!, 'utf8'));
}
async function projectTab(page: Page) {
  await page.getByRole('tab', { name: 'Projeto', exact: true }).click();
}
async function create(page: Page, kind: string, name: string) {
  await projectTab(page);
  await page
    .getByRole('button', { name: `Adicionar ${kind}`, exact: true })
    .click();
  await page.getByLabel(`Nome do ${kind}`, { exact: true }).fill(name);
  await page
    .getByRole('button', { name: `Criar ${kind}`, exact: true })
    .click();
}
test('hierarchy CRUD, same-named elements, ownership, reparenting and persistent navigation', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.busy-overlay')).toHaveCount(0);
  await page
    .locator('.quick-tools')
    .getByRole('button', { name: 'Novo projeto', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByLabel('Nome do projeto', { exact: true })
    .fill('Hierarquia de teste');
  await confirmProjectReplacement(page);
  await page
    .getByRole('button', { name: 'Criar projeto', exact: true })
    .click();
  await create(page, 'grupo', 'V1');
  await create(page, 'detalhamento', 'V1 térreo');
  await create(page, 'pavimento', 'Superior');
  await create(page, 'grupo', 'V1');
  await create(page, 'detalhamento', 'V1 superior');
  for (const value of ['B', '0,0', '1500,0', '']) await command(page, value);
  await page.keyboard.press('Escape');
  for (const value of ['R', '0,-600']) await command(page, value);
  for (const value of ['CHAMADA', '100,0', '100,300', '600,300'])
    await command(page, value);
  await page.keyboard.press('Escape');
  const before = await save(page),
    detailId = before.hierarchy.details.find(
      (d: any) => d.name === 'V1 superior',
    ).id;
  expect(before.schema).toBe('armadurastruct/24');
  expect(
    before.hierarchy.elements.filter((e: any) => e.name === 'V1'),
  ).toHaveLength(2);
  expect(before.hierarchy.objectDetails[before.bars[0].id]).toBe(detailId);
  expect(before.hierarchy.objectDetails[before.details[0].id]).toBe(detailId);
  expect(before.hierarchy.objectDetails[before.annotations[0].id]).toBe(
    detailId,
  );

  await projectTab(page);
  const floor = page.locator('.hierarchy-floor').filter({
    has: page.getByRole('button', {
      name: 'Editar pavimento Superior',
      exact: true,
    }),
  });
  await floor
    .getByRole('button', { name: 'Editar grupo V1', exact: true })
    .click();
  await page.getByLabel('Nome do grupo', { exact: true }).fill('V2');
  await page
    .getByLabel('Pavimento do grupo', { exact: true })
    .selectOption(before.hierarchy.floors[0].id);
  await page
    .getByRole('button', { name: 'Salvar alterações', exact: true })
    .click();
  const moved = await save(page);
  expect(moved.bars).toEqual(before.bars);
  expect(moved.details).toEqual(before.details);
  expect(moved.hierarchy.objectDetails).toEqual(before.hierarchy.objectDetails);
  expect(moved.hierarchy.elements.find((e: any) => e.name === 'V2').id).toBe(
    before.hierarchy.details.find((d: any) => d.id === detailId).elementId,
  );
  await command(page, 'U');
  expect(await save(page)).toEqual(before);
  await command(page, 'REDO');
  expect(await save(page)).toEqual(moved);

  await projectTab(page);
  await page.getByLabel('Pesquisar no projeto', { exact: true }).fill('n1');
  await expect(
    page.getByRole('button', {
      name: 'Editar detalhamento V1 superior',
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator('.bar-row')).toHaveCount(1);
  await page.getByLabel('Pesquisar no projeto', { exact: true }).fill('');
  await page
    .getByRole('button', { name: 'Recolher grupo V2', exact: true })
    .click();
  await page.getByRole('tab', { name: 'Propriedades', exact: true }).click();
  await projectTab(page);
  await expect(
    page.getByRole('button', { name: 'Expandir grupo V2', exact: true }),
  ).toBeVisible();

  await page.getByTestId('project-input').setInputFiles({
    name: 'hierarquia.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(moved)),
  });
  expect(await save(page)).toEqual(moved);
  await page.waitForTimeout(800);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Expandir grupo V2', exact: true }),
  ).toBeVisible();
  expect(await save(page)).toEqual(moved);
  await expect(
    page.getByLabel('Detalhamento ativo', { exact: true }),
  ).toHaveValue(detailId);
  expect(errors).toEqual([]);
});

test('moving selected content preserves geometry and protected deletion leaves the project intact', async ({
  page,
}) => {
  await page.goto('/');
  await seedLegacyDemo(page);
  await expect(page.locator('.bar-row')).toHaveCount(3);
  const before = await save(page);
  await create(page, 'detalhamento', 'Montagem');
  const withDetail = await save(page),
    target = withDetail.hierarchy.details.find(
      (d: any) => d.name === 'Montagem',
    ).id;
  await expect(page.locator('.hierarchy-editor')).toHaveCount(0);
  await page
    .getByLabel('Detalhamento ativo', { exact: true })
    .selectOption(before.hierarchy.details[0].id);
  const closeToast = page.getByRole('button', {
    name: 'Fechar aviso',
    exact: true,
  });
  if (await closeToast.isVisible()) await closeToast.click();
  await page.screenshot({ path: 'docs/hierarchy.png' });
  await page
    .getByLabel('Detalhamento ativo', { exact: true })
    .selectOption(before.hierarchy.details[0].id);
  await page
    .locator('.bar-row')
    .filter({ has: page.getByText('N1', { exact: true }) })
    .click();
  await projectTab(page);
  await page
    .getByLabel('Detalhamento de destino', { exact: true })
    .selectOption(target);
  await page
    .getByRole('button', { name: 'Mover seleção', exact: true })
    .click();
  let moved = await save(page);
  expect(moved.bars).toEqual(before.bars);
  expect(moved.hierarchy.objectDetails[before.bars[0].id]).toBe(target);
  expect(moved.hierarchy.objectDetails[before.details[0].id]).toBe(target);
  await page
    .getByRole('button', { name: 'Editar detalhamento Montagem', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Excluir detalhamento', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('Mova os objetos');
  expect(await save(page)).toEqual(moved);
  await page
    .getByLabel('Detalhamento de destino', { exact: true })
    .selectOption(before.hierarchy.details[0].id);
  await page
    .getByRole('button', { name: 'Mover seleção', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Editar detalhamento Montagem', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Excluir detalhamento', exact: true })
    .click();
  moved = await save(page);
  expect(moved.hierarchy).toEqual(before.hierarchy);
  expect(moved.bars).toEqual(before.bars);
});

useCompatibleProjectFolders();
