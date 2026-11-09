import {
  confirmProjectReplacement,
  useCompatibleProjectFolders,
} from './projectSetup.helpers';
import { seedLegacyDemo } from './seedLegacyDemo';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

async function command(page: Page, value: string) {
  const input = page.getByRole('textbox', { name: 'Comando CAD' });
  await input.fill(value);
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
async function settled(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}
async function camera(page: Page) {
  await settled(page);
  return page.getByTestId('cad-canvas').evaluate((svg) => {
    const group = svg.querySelector('g[transform]') as SVGGElement;
    const matrix = group.transform.baseVal.consolidate()!.matrix;
    const box = svg.getBoundingClientRect();
    return {
      x: (box.width / 2 - matrix.e) / matrix.a,
      y: (matrix.f - box.height / 2) / matrix.a,
      scale: matrix.a,
    };
  });
}
async function point(page: Page, x: number, y: number, double = false) {
  await settled(page);
  const at = await page.getByTestId('cad-canvas').evaluate(
    (svg, p) => {
      const g = svg.querySelector('g[transform]') as SVGGElement;
      const v = new DOMPoint(p.x, p.y).matrixTransform(g.getScreenCTM()!);
      return { x: v.x, y: v.y };
    },
    { x, y },
  );
  if (double) await page.mouse.dblclick(at.x, at.y);
  else await page.mouse.click(at.x, at.y);
}
async function tree(page: Page) {
  await page.getByRole('tab', { name: 'Projeto', exact: true }).click();
}
async function selectBar(page: Page, mark: string) {
  await tree(page);
  await page
    .locator('.bar-row')
    .filter({ has: page.getByText(mark, { exact: true }) })
    .click();
}
async function groupSelection(page: Page, name: string) {
  await command(page, 'AGRUPAR');
  const dialog = page.getByRole('dialog', {
    name: 'Agrupar em detalhamento',
    exact: true,
  });
  await dialog
    .getByLabel('Nome do novo detalhamento', { exact: true })
    .fill(name);
  await dialog
    .getByRole('button', { name: 'Agrupar objetos', exact: true })
    .click();
}

test('mixed group opens on CAD double-click, edits one source, updates RA, and ungroups without losing steel', async ({
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
    .fill('Grupos');
  await confirmProjectReplacement(page);
  await page
    .getByRole('button', { name: 'Criar projeto', exact: true })
    .click();
  for (const value of ['B', '0,0', '1500,0', '']) await command(page, value);
  await page.keyboard.press('Escape');
  for (const value of ['R', '0,-400', 'COTA', '0,0', '1500,0', '750,-250'])
    await command(page, value);
  await selectBar(page, 'N1');
  for (const value of ['CHAMADA', '1000,0', '1700,200', '1900,200'])
    await command(page, value);
  for (const value of ['PL', '0,-700', '1200,-700', ''])
    await command(page, value);
  for (const value of ['B', '3500,0', '5000,0', '']) await command(page, value);
  await page.keyboard.press('Escape');
  const before = await save(page);
  await selectBar(page, 'N1');
  for (const text of ['Polilinha', 'Cota ortogonal', 'Chamada']) {
    await tree(page);
    await page
      .locator('.draft-object-list button')
      .filter({ hasText: text })
      .click({ modifiers: ['Shift'] });
  }
  await groupSelection(page, 'Viga principal');
  let p = await save(page);
  const detailId = p.hierarchy.details.find(
    (d: any) => d.name === 'Viga principal',
  ).id;
  for (const field of ['bars', 'details', 'annotations', 'polylines', 'masks'])
    expect(p[field]).toEqual(before[field]);
  expect(p.hierarchy.details.find((d: any) => d.id === detailId).grouped).toBe(
    true,
  );
  expect(p.hierarchy.objectDetails[p.bars[1].id]).not.toBe(detailId);
  await expect(page.getByTestId('cad-detail-group')).toHaveCount(1);
  await command(page, 'F');
  await point(page, 750, 0, true);
  await expect(
    page.getByRole('region', { name: 'Edição isolada' }),
  ).toBeVisible();
  await expect(page.getByTestId('cad-canvas').getByText(/^N2 /)).toHaveCount(0);
  await selectBar(page, 'N1');
  await page.getByLabel('Bitola (mm)', { exact: true }).selectOption('10');
  await page.getByLabel('Quantidade', { exact: true }).fill('4');
  await page.getByLabel('Quantidade', { exact: true }).press('Tab');
  const edited = await save(page);
  expect(edited.bars[0].quantity).toBe(4);
  expect(edited.bars[0].diameter).toBe(10);
  expect(edited.bars[1]).toEqual(before.bars[1]);
  expect(edited.details).toEqual(before.details);
  const closeToast = page.getByRole('button', {
    name: 'Fechar aviso',
    exact: true,
  });
  if (await closeToast.isVisible()) await closeToast.click();
  await page.screenshot({ path: 'docs/detail-editing.png' });
  await command(page, 'Q');
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(2);
  await expect(
    page.getByRole('table').locator('tbody tr').first().locator('td').nth(4),
  ).toHaveText('4');
  await page.getByRole('table').getByText('N2', { exact: true }).click();
  await expect(page.getByRole('status')).toContainText('protegidos');
  expect(await save(page)).toEqual(edited);
  await page
    .locator('.document-tabs')
    .getByRole('button', { name: /Desenho/ })
    .click();
  await command(page, 'BLOQUEARRA');
  await expect(page.getByRole('status')).toContainText('Conclua a edição');
  expect((await save(page)).scheduleLock).toBeUndefined();
  await page
    .getByRole('button', { name: 'Concluir edição', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Edição isolada' }),
  ).toHaveCount(0);
  await command(page, 'U');
  expect((await save(page)).bars[0].quantity).toBe(1);
  await command(page, 'REDO');
  expect(await save(page)).toEqual(edited);
  await command(page, 'DESAGRUPAR');
  p = await save(page);
  expect(p.bars).toEqual(edited.bars);
  expect(p.hierarchy.objectDetails).toEqual(edited.hierarchy.objectDetails);
  expect(p.hierarchy.details.find((d: any) => d.id === detailId).grouped).toBe(
    false,
  );
  await expect(page.getByTestId('cad-detail-group')).toHaveCount(0);
  await page.getByTestId('project-input').setInputFiles({
    name: 'grupo.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(p)),
  });
  expect(await save(page)).toEqual(p);
  expect(errors).toEqual([]);
});

test('tree isolation protects history, file replacement and foreign objects, and remains escapable in CAD focus', async ({
  page,
}) => {
  await page.goto('/');
  await seedLegacyDemo(page);
  await expect(page.locator('.bar-row')).toHaveCount(3);
  await selectBar(page, 'N1');
  await groupSelection(page, 'Montagem');
  const grouped = await save(page),
    id = grouped.hierarchy.details.find((d: any) => d.name === 'Montagem').id;
  await tree(page);
  const overview = await camera(page);
  await page
    .getByRole('button', {
      name: 'Abrir edição isolada de Montagem',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('region', { name: 'Edição isolada' }),
  ).toBeVisible();
  for (const value of ['PL', '200,200', '600,200', ''])
    await command(page, value);
  const inserted = await save(page);
  expect(inserted.hierarchy.objectDetails[inserted.polylines.at(-1).id]).toBe(
    id,
  );
  await command(page, 'U');
  expect(await save(page)).toEqual(grouped);
  await expect(
    page
      .locator('.quick-tools')
      .getByRole('button', { name: 'Desfazer', exact: true }),
  ).toBeDisabled();
  await command(page, 'U');
  expect(await save(page)).toEqual(grouped);
  await page.getByTestId('project-input').setInputFiles({
    name: 'outro.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...grouped, id: 'other-project' })),
  });
  await expect(page.getByRole('status')).toContainText('edição isolada');
  expect(await save(page)).toEqual(grouped);
  await page.keyboard.press('Control+0');
  await expect(
    page.getByRole('button', { name: 'Concluir edição', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Concluir edição', exact: true })
    .click();
  const restored = await camera(page);
  // SVG matrices expose float32 values; compare the restored center in screen pixels.
  expect(Math.abs(restored.x - overview.x) * overview.scale).toBeLessThan(
    0.001,
  );
  expect(Math.abs(restored.y - overview.y) * overview.scale).toBeLessThan(
    0.001,
  );
  expect(restored.scale).toBeCloseTo(overview.scale, 5);
  await command(page, 'U');
  expect(
    (await save(page)).hierarchy.details.some((d: any) => d.id === id),
  ).toBe(false);
});

test('moving a selected group translates every owned geometry and keeps the physical quantities', async ({
  page,
}) => {
  await page.goto('/');
  await seedLegacyDemo(page);
  await expect(page.locator('.bar-row')).toHaveCount(3);
  await selectBar(page, 'N1');
  await groupSelection(page, 'Translação');
  const before = await save(page);
  for (const value of ['M', '0,0', '100,200']) await command(page, value);
  const after = await save(page);
  expect(after.bars[0].origin).toEqual({
    x: before.bars[0].origin.x + 100,
    y: before.bars[0].origin.y + 200,
  });
  expect(after.details[0].origin).toEqual({
    x: before.details[0].origin.x + 100,
    y: before.details[0].origin.y + 200,
  });
  expect(after.bars[0].points).toEqual(before.bars[0].points);
  expect(after.bars[0].quantity).toBe(before.bars[0].quantity);
  expect(after.bars.slice(1)).toEqual(before.bars.slice(1));
  expect(after.hierarchy.objectDetails).toEqual(before.hierarchy.objectDetails);
  await command(page, 'U');
  expect(await save(page)).toEqual(before);
});

useCompatibleProjectFolders();
