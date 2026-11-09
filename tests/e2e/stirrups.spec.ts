import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  confirmProjectReplacement,
  useCompatibleProjectFolders,
} from './projectSetup.helpers';
async function command(page: Page, value: string) {
  const box = page.getByRole('textbox', { name: 'Comando CAD' });
  await box.fill(value);
  await box.press('Enter');
}
async function save(page: Page) {
  const ev = page.waitForEvent('download');
  await page
    .locator('.quick-tools')
    .getByRole('button', { name: 'Salvar projeto', exact: true })
    .click();
  return JSON.parse(readFileSync((await (await ev).path())!, 'utf8'));
}
async function fresh(page: Page) {
  await page.goto('/');
  await expect(page.locator('.busy-overlay')).toHaveCount(0);
  await page
    .locator('.quick-tools')
    .getByRole('button', { name: 'Novo projeto', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByLabel('Nome do projeto', { exact: true })
    .fill('Lançamento de estribos');
  await confirmProjectReplacement(page);
  await page
    .getByRole('button', { name: 'Criar projeto', exact: true })
    .click();
}
async function start(page: Page) {
  await command(page, 'E');
  const dialog = page.getByRole('dialog', {
    name: 'Critérios do estribo',
    exact: true,
  });
  if (await dialog.isVisible())
    await dialog
      .getByRole('button', { name: 'Usar critérios e lançar' })
      .click();
}
const panel = (page: Page) =>
  page.getByRole('region', { name: 'Lançamento de estribo' });

test('critérios, seção, faixa e identificação formam uma posição atômica, com histórico e recuperação', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await fresh(page);
  const before = await save(page);
  await command(page, 'E');
  const d = page.getByRole('dialog', {
    name: 'Critérios do estribo',
    exact: true,
  });
  await expect(d).toBeVisible();
  await d.getByLabel('Referência das medidas').selectOption('concrete');
  await d.getByLabel('Base da seção (mm)', { exact: true }).fill('300');
  await d.getByLabel('Altura da seção (mm)', { exact: true }).fill('500');
  await d.getByLabel('Cobrimento até face do aço (mm)').fill('30');
  await d.getByLabel('Bitola do estribo (mm)').fill('10');
  await d.getByLabel('Mandril interno (mm)').fill('50');
  await d.screenshot({ path: 'docs/stirrup-criteria.png' });
  await d.getByRole('button', { name: 'Distribuição', exact: true }).click();
  await d.getByLabel('Espaçamento solicitado (mm)').fill('200');
  await d.getByLabel('Afastamento da primeira face (mm)').fill('50');
  await d.getByLabel('Afastamento da segunda face (mm)').fill('75');
  await d.getByRole('button', { name: 'Usar critérios e lançar' }).click();
  await command(page, '1500,-1000');
  await expect(panel(page)).toContainText('primeira face');
  await expect(page.locator('.canvas-empty')).toHaveCount(0);
  await command(page, 'F');
  await page.screenshot({ path: 'docs/stirrup-section.png' });
  for (const value of ['0,0', '1100,0', '0,-300']) await command(page, value);
  await expect(panel(page)).toContainText('6 peça(s)');
  await expect(panel(page)).toContainText('195,00 mm');
  const draft = await save(page);
  expect(draft).toEqual(before);
  await command(page, 'F');
  await page.screenshot({ path: 'docs/stirrup-preview.png' });
  await panel(page)
    .getByRole('button', { name: 'Confirmar lançamento' })
    .click();
  await command(page, '');
  await command(page, '');
  const done = await save(page);
  expect(done.bars).toHaveLength(1);
  expect(done.bars[0]).toMatchObject({
    kind: 'stirrup',
    width: 300,
    height: 500,
    quantity: 6,
    origin: { x: 1500, y: -1000 },
    distribution: {
      start: { x: 50, y: 0 },
      end: { x: 1025, y: 0 },
      annotationOffset: -300,
    },
    stirrupProfile: { reference: 'concrete', cover: 30 },
  });
  expect(done.details).toHaveLength(0);
  expect(done.stirrupDefaults.spacing).toBe(200);
  await command(page, 'F');
  await page.screenshot({ path: 'docs/stirrup-confirmed.png' });
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  expect((await save(page)).bars).toHaveLength(0);
  await page.getByRole('button', { name: 'Refazer', exact: true }).click();
  expect((await save(page)).bars).toEqual(done.bars);
  await page.getByTestId('project-input').setInputFiles({
    name: 'estribo.armstruct.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(done)),
  });
  expect((await save(page)).bars).toEqual(done.bars);
  await page.waitForTimeout(750);
  await page.reload();
  await expect(page.locator('.busy-overlay')).toHaveCount(0);
  expect((await save(page)).bars).toEqual(done.bars);
  expect(errors).toEqual([]);
});

test('Esc em cada etapa, repetição, faixa inválida e troca de contexto não deixam aço parcial', async ({
  page,
}) => {
  await fresh(page);
  const before = await save(page);
  for (const points of [
    [],
    ['0,0'],
    ['0,0', '0,1000'],
    ['0,0', '0,1000', '2000,1000'],
    ['0,0', '0,1000', '2000,1000', '0,1500'],
  ]) {
    await start(page);
    for (const value of points) await command(page, value);
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);
    expect(await save(page)).toEqual(before);
  }
  await start(page);
  for (const value of ['0,0', '0,0', '0,0']) await command(page, value);
  await expect(panel(page).getByRole('alert')).toContainText('faixa');
  expect(await save(page)).toEqual(before);
  await page
    .locator('.quick-tools')
    .getByRole('button', { name: 'Novo projeto', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Cancelar', exact: true })
    .click();
  await expect(panel(page)).toHaveCount(0);
  expect(await save(page)).toEqual(before);
});

test('circular analítico, edição explícita e forma livre com teclado em janela baixa', async ({
  page,
}) => {
  await fresh(page);
  await page.setViewportSize({ width: 1000, height: 650 });
  await command(page, 'E');
  let d = page.getByRole('dialog', {
    name: 'Critérios do estribo',
    exact: true,
  });
  await d.getByLabel('Formato do estribo').selectOption('circle');
  await d.getByLabel('Diâmetro da seção (mm)').fill('1000');
  await d.getByLabel('Rotação da seção (graus)').fill('90');
  await expect(
    d.getByRole('img', { name: 'Forma do estribo' }).locator('path'),
  ).toHaveAttribute('transform', 'rotate(90)');
  for (const i of [1, 2])
    await d.getByLabel(`Ângulo do gancho ${i}`).selectOption('0');
  await d.getByRole('button', { name: 'Distribuição', exact: true }).click();
  await d.getByLabel('Modo de lançamento do estribo').selectOption('section');
  await d.getByLabel('Quantidade da seção').fill('4');
  await d.getByRole('button', { name: 'Usar critérios e lançar' }).click();
  for (const v of ['0,0', '']) await command(page, v);
  let p = await save(page);
  expect(p.bars).toHaveLength(1);
  expect(p.bars[0].quantity).toBe(4);
  expect(p.bars[0].stirrupProfile.shape).toBe('circle');
  await page
    .getByRole('button', { name: 'Editar critérios desta posição' })
    .click();
  d = page.getByRole('dialog', { name: /Editar critérios de/ });
  await d.getByLabel('Diâmetro da seção (mm)').fill('1200');
  await d.getByRole('button', { name: 'Aplicar nesta posição' }).click();
  const edited = await save(page);
  expect(edited.bars[0].width).toBe(1200);
  expect(edited.bars[0].id).toBe(p.bars[0].id);
  expect(edited.bars[0].quantity).toBe(4);
  await page
    .getByRole('button', { name: 'Critérios do estribo', exact: true })
    .click();
  d = page.getByRole('dialog', { name: 'Critérios do estribo', exact: true });
  await d.getByLabel('Formato do estribo').selectOption('free');
  await d.getByRole('button', { name: 'Desenhar forma livre no CAD' }).click();
  for (const v of ['0,0', '400,0', '600,400', '100,400', ''])
    await command(page, v);
  d = page.getByRole('dialog', { name: 'Critérios do estribo', exact: true });
  await expect(d).toContainText('4 vértices');
  await d.screenshot({ path: 'docs/stirrup-free-low-window.png' });
  await d.getByRole('button', { name: 'Usar critérios e lançar' }).click();
  for (const v of ['2000,0', '']) await command(page, v);
  p = await save(page);
  expect(p.bars).toHaveLength(2);
  expect(p.bars[0]).toEqual(edited.bars[0]);
  expect(p.bars[1].stirrupProfile.shape).toBe('free');
  expect(p.bars[1].stirrupProfile.points).toHaveLength(4);
  expect(p.bars[1].rotation).toBe(90);
  expect(p.bars[1].stirrupProfile.points[1].x).toBeCloseTo(0);
  expect(p.bars[1].stirrupProfile.points[1].y).toBeCloseTo(-400);
});
useCompatibleProjectFolders();
