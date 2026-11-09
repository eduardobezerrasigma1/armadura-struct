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
  if (value === 'F') {
    // Coordinates are read only after React and the browser paint the fitted view.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
  }
}
async function save(page: Page) {
  const event = page.waitForEvent('download');
  await page
    .locator('.quick-tools')
    .getByRole('button', { name: 'Salvar projeto', exact: true })
    .click();
  return JSON.parse(readFileSync((await (await event).path())!, 'utf8'));
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
    .getByRole('textbox')
    .fill('Detalhamento de teste');
  await confirmProjectReplacement(page);
  await page.getByRole('button', { name: 'Criar projeto' }).click();
}
async function point(page: Page, x: number, y: number, shift = false) {
  const xy = await page.getByTestId('cad-canvas').evaluate(
    (svg, p) => {
      const g = svg.querySelector('g[transform]') as SVGGElement;
      const at = new DOMPoint(p.x, p.y).matrixTransform(g.getScreenCTM()!);
      return { x: at.x, y: at.y };
    },
    { x, y },
  );
  const viewport = page.viewportSize()!;
  expect(xy.x).toBeGreaterThan(0);
  expect(xy.x).toBeLessThan(viewport.width);
  expect(xy.y).toBeGreaterThan(0);
  expect(xy.y).toBeLessThan(viewport.height);
  if (shift) await page.keyboard.down('Shift');
  await page.mouse.click(xy.x, xy.y);
  if (shift) await page.keyboard.up('Shift');
}
async function selectBar(page: Page, mark: string) {
  await page.getByRole('tab', { name: 'Projeto', exact: true }).click();
  await page
    .locator('.bar-row')
    .filter({ has: page.getByText(mark, { exact: true }) })
    .click();
}

test('workspace compacto mantém CAD amplo e recupera painéis recolhidos', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');
  await seedLegacyDemo(page);
  await page.locator('.bar-row').first().waitFor();
  const rect = (await page.getByTestId('cad-canvas').boundingBox())!;
  expect(rect.width).toBeGreaterThan(1366 * 0.8);
  expect(rect.height).toBeGreaterThan(768 * 0.7);
  expect(
    await page
      .locator('.ribbon-content')
      .evaluate((e) => e.scrollWidth <= e.clientWidth),
  ).toBe(true);
  const overflow = await page
    .locator('.ribbon-tool>span')
    .evaluateAll((items) =>
      items.some((e) => e.scrollWidth > e.clientWidth + 2),
    );
  expect(overflow).toBe(false);
  await page
    .getByRole('button', { name: 'Alternar painel lateral', exact: true })
    .click();
  await expect(page.locator('.sidebar-dock')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Recolher faixa de comandos', exact: true })
    .click();
  await expect(page.locator('.ribbon-content')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.busy-overlay')).toHaveCount(0);
  await expect(page.locator('.sidebar-dock')).toHaveCount(0);
  await expect(page.locator('.ribbon-content')).toHaveCount(0);
  const expanded = (await page.getByTestId('cad-canvas').boundingBox())!;
  expect(expanded.width).toBe(1366);
  expect(expanded.height).toBeGreaterThan(rect.height);
  await page
    .getByRole('button', { name: 'Alternar painel lateral', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Expandir faixa de comandos', exact: true })
    .click();
  await expect(
    page.getByRole('tab', { name: 'Projeto', exact: true }),
  ).toBeVisible();
  await page.locator('.bar-row').first().click();
  await expect(
    page.getByRole('tab', { name: 'Propriedades', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
});

test('polilinha convertida, cotas, chamadas e arco sobrevivem a desfazer, mover e reabrir', async ({
  page,
}) => {
  await fresh(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const value of ['PL', '0,0', '1200,0', '1200,600', ''])
    await command(page, value);
  await page.keyboard.press('Escape');
  expect((await save(page)).polylines).toHaveLength(1);
  await command(page, 'F');
  await command(page, 'CONVERTER');
  await point(page, 600, 0);
  await page.keyboard.press('Escape');
  let p = await save(page);
  expect(p.bars).toHaveLength(1);
  expect(p.polylines).toHaveLength(0);
  await command(page, 'U');
  p = await save(page);
  expect(p.bars).toHaveLength(0);
  expect(p.polylines).toHaveLength(1);
  await command(page, 'REDO');
  await selectBar(page, 'N1');
  for (const value of ['COTA', '0,0', '1200,0', '600,-250'])
    await command(page, value);
  await expect(page.getByTestId('cad-annotation')).toHaveCount(1);
  await selectBar(page, 'N1');
  for (const value of ['CHAMADA', '600,0', '1500,600', '1900,600'])
    await command(page, value);
  await page
    .getByLabel('Texto da anotação', { exact: true })
    .fill('Armadura inferior');
  await page.getByLabel('Texto da anotação', { exact: true }).press('Tab');
  for (const value of ['M', '0,0', '100,200']) await command(page, value);
  p = await save(page);
  expect(p.annotations[1].points[0]).toEqual({ x: 700, y: 200 });
  expect(p.annotations[1].label).toBe('Armadura inferior');
  expect(p.annotations[1].barId).toBe(p.bars[0].id);
  for (const value of ['ARCO', '0,600', '600,1000', '1200,600'])
    await command(page, value);
  p = await save(page);
  expect(p.annotations.map((a: any) => a.kind)).toEqual([
    'dimension-orthogonal',
    'leader',
    'section-arc',
  ]);
  await page.getByTestId('project-input').setInputFiles({
    name: 'desenho.armstruct.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(p)),
  });
  expect(await save(page)).toEqual(p);
  await expect(page.getByTestId('cad-annotation')).toHaveCount(3);
  await page.getByRole('tab', { name: 'Arquivo', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Desenho DXF', exact: true }).click();
  const dxf = readFileSync((await (await download).path())!, 'utf8');
  expect(dxf).toContain('CHAMADAS');
  expect(dxf).toContain('Armadura inferior');
  expect(dxf).toContain('CORTES');
  expect(errors).toEqual([]);
});

test('divisão com traspasse, união por seleção múltipla e relação de aço bloqueada', async ({
  page,
}) => {
  await fresh(page);
  await page.getByLabel('Quantidade de criação', { exact: true }).fill('4');
  await page.getByLabel('Quantidade de criação', { exact: true }).press('Tab');
  for (const value of ['B', '0,0', '3000,0', '']) await command(page, value);
  await page.keyboard.press('Escape');
  await page
    .getByRole('button', { name: 'Dividir barra', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Comprimento até o corte', { exact: true })
    .fill('150');
  await dialog.getByLabel('Traspasse informado', { exact: true }).fill('40');
  await dialog.getByRole('button', { name: 'Aplicar divisão' }).click();
  let p = await save(page);
  expect(p.bars).toHaveLength(2);
  expect(p.bars.map((b: any) => b.quantity)).toEqual([4, 4]);
  expect(p.bars[0].points.at(-1).x).toBe(1700);
  expect(p.bars[1].origin.x).toBe(1300);
  await command(page, 'U');
  await command(page, 'DIVIDIR');
  await page
    .getByRole('dialog')
    .getByLabel('Traspasse informado', { exact: true })
    .fill('0');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Aplicar divisão' })
    .click();
  await command(page, 'F');
  await point(page, 500, 0);
  await point(page, 2500, 0, true);
  await page
    .getByRole('button', { name: 'Emendar poligonais', exact: true })
    .click();
  p = await save(page);
  expect(p.bars).toHaveLength(1);
  expect(p.bars[0].points.at(-1).x).toBe(3000);
  await page.getByRole('button', { name: 'Bloquear RA', exact: true }).click();
  await page.getByLabel('Quantidade', { exact: true }).fill('7');
  await page.getByLabel('Quantidade', { exact: true }).press('Tab');
  p = await save(page);
  expect(p.scheduleLock.bars[0].quantity).toBe(4);
  expect(p.bars[0].quantity).toBe(7);
  await page.getByRole('tab', { name: 'Arquivo', exact: true }).click();
  await page.getByRole('button', { name: 'Quadro CSV', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('desatualizada');
  await page.getByRole('tab', { name: 'Armaduras', exact: true }).click();
  await page.getByRole('button', { name: 'Atualizar RA', exact: true }).click();
  expect((await save(page)).scheduleLock.bars[0].quantity).toBe(7);
  await page
    .getByRole('button', { name: 'Desbloquear RA', exact: true })
    .click();
  expect((await save(page)).scheduleLock).toBeUndefined();
});

test('repetição de estribos e faixa calculam quantidade pelo espaçamento máximo', async ({
  page,
}) => {
  await fresh(page);
  for (const value of ['E', '0,0', '300,500']) await command(page, value);
  await page.keyboard.press('Escape');
  await page.getByLabel('Espaçamento de criação', { exact: true }).fill('150');
  await page.getByLabel('Espaçamento de criação', { exact: true }).press('Tab');
  for (const value of ['REPETIR', '1000,0']) await command(page, value);
  let p = await save(page);
  expect(p.bars).toHaveLength(1);
  expect(p.bars[0].quantity).toBe(8);
  expect(p.bars[0].distribution.render).toBe('bars');
  for (const value of ['FAIXA', '0,-400', '2000,-420'])
    await command(page, value);
  p = await save(page);
  expect(p.bars[0].quantity).toBe(15);
  expect(p.bars[0].distribution).toEqual({
    start: { x: 0, y: -400 },
    end: { x: 2000, y: -400 },
    render: 'ticks',
  });
  await expect(page.getByTestId('cad-distribution')).toHaveCount(1);
  await page
    .getByRole('button', { name: 'Quadro de aço', exact: true })
    .click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
});

useCompatibleProjectFolders();
