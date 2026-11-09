import { configureStirrupSection } from './stirrup.helpers';
import { confirmMaskImport } from './maskBatch.helpers';
import {
  confirmProjectReplacement,
  useCompatibleProjectFolders,
} from './projectSetup.helpers';
import { seedLegacyDemo } from './seedLegacyDemo';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
async function command(page: Page, value: string) {
  const input = page.getByRole('textbox', { name: 'Comando CAD' });
  await input.fill(value);
  await input.press('Enter');
}
async function saveProject(page: Page) {
  const event = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Salvar projeto', exact: true })
    .click();
  const download = await event;
  return JSON.parse(readFileSync((await download.path())!, 'utf8'));
}
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.busy-overlay')).toHaveCount(0);
  await seedLegacyDemo(page);
});
test('CAD completo: desenhar, quantificar, rebater, distribuir, desfazer e reabrir', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.getByRole('button', { name: 'Novo projeto', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByLabel('Nome do projeto', { exact: true })
    .fill('Teste da viga');
  await confirmProjectReplacement(page);
  await page.getByRole('button', { name: 'Criar projeto' }).click();
  await command(page, 'B');
  await command(page, '0,0');
  await command(page, '1000,0');
  await command(page, '@0,500');
  await command(page, '');
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Posição', { exact: true })).toHaveValue('N1');
  await page.getByLabel('Quantidade', { exact: true }).fill('4');
  await page.getByLabel('Quantidade', { exact: true }).press('Tab');
  await command(page, 'R');
  await command(page, '0,-700');
  await command(page, 'D');
  await command(page, '1000,0');
  await page.keyboard.press('Escape');
  let saved = await saveProject(page);
  expect(saved.bars).toHaveLength(1);
  expect(saved.bars[0].quantity).toBe(4);
  expect(saved.details).toHaveLength(1);
  expect(saved.bars[0].distribution.end.x).toBe(1000);
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  saved = await saveProject(page);
  expect(saved.bars[0].distribution).toBeUndefined();
  await page.getByRole('button', { name: 'Refazer', exact: true }).click();
  await configureStirrupSection(page);
  await command(page, '1500,0');
  await command(page, '');
  await page.keyboard.press('Escape');
  expect((await saveProject(page)).bars[1].width).toBe(300);
  const before = await saveProject(page);
  expect(before.bars).toHaveLength(2);
  await page.getByTestId('project-input').setInputFiles({
    name: 'reaberto.armstruct.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(before)),
  });
  expect(await saveProject(page)).toEqual(before);
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.locator('.busy-overlay')).toHaveCount(0);
  expect((await saveProject(page)).bars).toHaveLength(2);
  await page
    .locator('.document-tabs')
    .getByRole('button', { name: /Quadro de aço/ })
    .click();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(
    page.getByRole('table').getByText('N2', { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test('DWG real carrega localmente e mantém máscara no projeto', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page
    .getByTestId('mask-input')
    .setInputFiles('tests/fixtures/entities-2d.dwg');
  await confirmMaskImport(page);
  await expect(page.locator('.mask-heading')).toContainText('entities-2d.dwg', {
    timeout: 65000,
  });
  const project = await saveProject(page);
  const m = project.masks.at(-1);
  expect(m.format).toBe('DWG');
  expect(m.primitives.length).toBeGreaterThan(5);
  expect(
    m.primitives.every((p: any) =>
      p.points.every((q: any) => Number.isFinite(q.x) && Number.isFinite(q.y)),
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test('DXF real, camadas, escala e arquivo inválido', async ({ page }) => {
  await page
    .getByTestId('mask-input')
    .setInputFiles('tests/fixtures/entities-2d.dxf');
  await confirmMaskImport(page);
  await expect(page.locator('.mask-heading')).toContainText('entities-2d.dxf');
  let project = await saveProject(page);
  expect(project.masks).toHaveLength(2);
  await page.getByTestId('mask-input').setInputFiles({
    name: 'invalido.dwg',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('não é DWG'),
  });
  const batch = page.getByRole('dialog', {
    name: 'Importar máscaras em lote',
    exact: true,
  });
  await batch
    .getByRole('button', { name: 'Ler arquivos', exact: true })
    .click();
  await expect(batch.getByRole('alert')).toContainText('Cabeçalho DWG');
  await batch.getByRole('button', { name: 'Cancelar', exact: true }).click();
  project = await saveProject(page);
  expect(project.masks).toHaveLength(2);
});
test('exports PDF/DXF/CSV e edição do quadro', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.getByRole('tab', { name: 'Arquivo', exact: true }).click();
  for (const label of ['PDF', 'DXF']) {
    const event = page.waitForEvent('download');
    await page
      .getByRole('button', {
        name: label === 'PDF' ? 'Prancha PDF' : 'Desenho DXF',
        exact: true,
      })
      .click();
    const d = await event;
    const bytes = readFileSync((await d.path())!);
    expect(bytes.length).toBeGreaterThan(1000);
    expect(bytes.toString('utf8', 0, 5)).toBe(
      label === 'PDF' ? '%PDF-' : '0\r\nSE',
    );
  }
  await page.getByRole('tab', { name: 'Arquivo', exact: true }).click();
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: /CSV/ }).click();
  expect((await event).suggestedFilename()).toMatch(/\.csv$/);
  expect(errors).toEqual([]);
});
test('seleção por mouse, alteração de seção e enquadramento sem cortes', async ({
  page,
}) => {
  await page.locator('.bar-row').filter({ hasText: 'N3' }).click();
  await page.getByLabel('Largura no eixo').fill('300');
  await page.getByLabel('Largura no eixo').press('Tab');
  expect((await saveProject(page)).bars[2].width).toBe(300);
  await page.getByRole('button', { name: 'Alternar fundo do desenho' }).click();
  await expect(page.locator('.cad-light')).toBeVisible();
  await page.getByRole('button', { name: 'Alternar fundo do desenho' }).click();
  await page.getByRole('button', { name: 'Fechar aviso' }).click();
  await page.screenshot({ path: 'docs/preview.png' });
});

test('seguir fôrma acumula o contorno, escolhe lado e confirma cobrimento com Enter', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Seguir fôrma', exact: true }).click();
  await page.getByLabel('Polilinha inteira', { exact: true }).check();
  const location = await page
    .getByTestId('cad-canvas')
    .evaluate(async (svg) => {
      // The follow toolbar changes the CAD height. Measure after ResizeObserver
      // and React have painted that layout, before converting model coordinates.
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      const g = svg.querySelector('g[transform]') as SVGGElement;
      const p = new DOMPoint(2500, 600).matrixTransform(g.getScreenCTM()!);
      return { x: p.x, y: p.y };
    });
  await page.mouse.click(location.x, location.y);
  expect((await saveProject(page)).bars).toHaveLength(3);
  await page
    .getByRole('button', { name: 'Escolher lado no CAD', exact: true })
    .click();
  const side = await page.getByTestId('cad-canvas').evaluate((svg) => {
    const g = svg.querySelector('g[transform]') as SVGGElement;
    const p = new DOMPoint(2500, 300).matrixTransform(g.getScreenCTM()!);
    return { x: p.x, y: p.y };
  });
  await page.mouse.click(side.x, side.y);
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Posição', { exact: true })).toHaveValue('N4');
  const saved = await saveProject(page),
    bar = saved.bars.at(-1);
  const xs = bar.points.map((p: any) => p.x + bar.origin.x);
  const ys = bar.points.map((p: any) => p.y + bar.origin.y);
  expect(Math.min(...xs)).toBe(34);
  expect(Math.max(...xs) - Math.min(...xs)).toBe(4932);
  expect(Math.max(...ys) - Math.min(...ys)).toBe(532);
});

useCompatibleProjectFolders();
