import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { maskManipFixture } from '../fixtures/maskManipulation';
const region = (p: Page) =>
  p.getByRole('region', { name: 'Copiar propriedades', exact: true });
const key = (id: string) => JSON.stringify(['target-mask', id]);
async function open(p: Page) {
  const seed = maskManipFixture();
  seed.masks[0].primitives[0].style = {
    color: '#123456',
    lineWidth: 0.5,
    lineScale: 2,
    lineType: { name: 'DASHED', pattern: [100, -50] },
  };
  await p.goto('/');
  await expect(p.locator('.busy-overlay')).toHaveCount(0);
  await p.getByTestId('project-input').setInputFiles({
    name: 'graphics.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(seed)),
  });
  await p.getByRole('tab', { name: 'Máscaras', exact: true }).click();
  const d = p.getByRole('region', {
    name: 'Destino do desenho de máscaras',
    exact: true,
  });
  await d
    .getByLabel('Escolher máscara', { exact: true })
    .selectOption('target-mask');
  await d
    .getByRole('button', { name: 'Ativar máscara para desenhar', exact: true })
    .click();
}
async function save(p: Page) {
  const close = p.getByRole('button', { name: 'Fechar aviso', exact: true });
  if (await close.isVisible()) await close.click();
  const download = p.waitForEvent('download');
  await p
    .locator('.quick-tools')
    .getByRole('button', { name: 'Salvar projeto', exact: true })
    .click();
  return JSON.parse(readFileSync((await (await download).path())!, 'utf8'));
}
async function start(p: Page) {
  await p
    .getByRole('button', { name: 'Copiar propriedades', exact: true })
    .click();
  await region(p)
    .getByLabel('Fonte de propriedades', { exact: true })
    .selectOption(key('line'));
}
async function command(p: Page, s: string) {
  const c = p.getByRole('textbox', { name: 'Comando CAD' });
  await c.fill(s);
  await c.press('Enter');
}
test('fonte → opções → destinos: prévia pura, lote, repetição, histórico e recuperação', async ({
  page,
}) => {
  await open(page);
  const before = await save(page);
  await start(page);
  await page.screenshot({ path: 'docs/match-properties-options.png' });
  await region(page)
    .getByRole('button', { name: 'Escolher destinos', exact: true })
    .click();
  await region(page)
    .getByText(/circle/)
    .locator('input')
    .check();
  expect((await save(page)).masks).toEqual(before.masks);
  await page.screenshot({ path: 'docs/match-properties-preview.png' });
  await region(page)
    .getByRole('button', { name: 'Aplicar propriedades', exact: true })
    .click();
  const after = await save(page);
  expect(after.masks[0].primitives[1].style).toEqual(
    before.masks[0].primitives[0].style,
  );
  expect(after.masks[0].primitives[1].points).toEqual(
    before.masks[0].primitives[1].points,
  );
  expect(after.bars).toEqual(before.bars);
  expect(after.scheduleLock).toEqual(before.scheduleLock);
  await expect(region(page)).toContainText('0 destino(s)');
  await page.keyboard.press('Escape');
  await command(page, 'U');
  expect((await save(page)).masks).toEqual(before.masks);
  await command(page, 'REDO');
  expect((await save(page)).masks).toEqual(after.masks);
  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.locator('.busy-overlay')).toHaveCount(0);
  expect((await save(page)).masks).toEqual(after.masks);
});
test('Esc cancela propriedades e prévia; texto incompatível não permite aplicar; contexto cancela', async ({
  page,
}) => {
  await open(page);
  const before = await save(page);
  await start(page);
  await page.keyboard.press('Escape');
  expect((await save(page)).masks).toEqual(before.masks);
  await start(page);
  await region(page)
    .getByText('Altura de texto', { exact: true })
    .locator('input')
    .check();
  await region(page)
    .getByRole('button', { name: 'Escolher destinos', exact: true })
    .click();
  await region(page)
    .getByText(/circle/)
    .locator('input')
    .check();
  await expect(region(page).getByRole('alert')).toContainText('incompatível');
  await expect(
    region(page).getByRole('button', {
      name: 'Aplicar propriedades',
      exact: true,
    }),
  ).toBeDisabled();
  await page.keyboard.press('Escape');
  expect((await save(page)).masks).toEqual(before.masks);
  await start(page);
  const d = page.getByRole('region', {
    name: 'Destino do desenho de máscaras',
    exact: true,
  });
  await d
    .getByLabel('Escolher máscara', { exact: true })
    .selectOption('external-mask');
  await d
    .getByRole('button', { name: 'Ativar máscara para desenhar', exact: true })
    .click();
  await expect(region(page)).toHaveCount(0);
  expect((await save(page)).masks).toEqual(before.masks);
});
test('ByLayer mantém vínculo e interface em Foco permanece utilizável', async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole('button', { name: 'Copiar propriedades', exact: true })
    .click();
  await region(page)
    .getByLabel('Fonte de propriedades', { exact: true })
    .selectOption(key('circle'));
  await region(page)
    .getByRole('button', { name: 'Escolher destinos', exact: true })
    .click();
  await region(page)
    .getByText(/line ·/)
    .locator('input')
    .check();
  await region(page)
    .getByRole('button', { name: 'Aplicar propriedades', exact: true })
    .click();
  const bound = await save(page);
  expect(bound.masks[0].primitives[0].style.color).toBeUndefined();
  await region(page)
    .getByText(/rectangle/)
    .locator('input')
    .check();
  await save(page);
  await page.keyboard.press('Control+0');
  await page.setViewportSize({ width: 900, height: 650 });
  await page.screenshot({ path: 'docs/match-properties-compact.png' });
  await page.keyboard.press('Escape');
  expect((await save(page)).masks).toEqual(bound.masks);
});
