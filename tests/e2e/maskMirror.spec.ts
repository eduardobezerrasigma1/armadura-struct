import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { maskManipFixture } from '../fixtures/maskManipulation';
import { nativePrimitive } from '../../src/domain/nativeMasks';
import { maskPoint } from '../../src/cad/import';
import { transformPoint } from '../../src/domain/transforms';
import { emptyProject } from '../../src/domain/model';
import type { Project } from '../../src/domain/types';
const panel = (p: Page) =>
  p.getByRole('region', { name: 'Espelhar entidades da máscara', exact: true });
async function open(p: Page, seed = maskManipFixture()) {
  await p.goto('/');
  await expect(p.locator('.busy-overlay')).toHaveCount(0);
  await p.getByTestId('project-input').setInputFiles({
    name: 'mirror.json',
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
async function save(p: Page): Promise<Project> {
  const close = p.getByRole('button', { name: 'Fechar aviso', exact: true });
  if (await close.isVisible()) await close.click();
  const d = p.waitForEvent('download');
  await p
    .locator('.quick-tools')
    .getByRole('button', { name: 'Salvar projeto', exact: true })
    .click();
  return JSON.parse(readFileSync((await (await d).path())!, 'utf8'));
}
async function csv(p: Page) {
  await p.getByRole('tab', { name: 'Arquivo', exact: true }).click();
  const d = p.waitForEvent('download');
  await p.getByRole('button', { name: 'Quadro CSV', exact: true }).click();
  const text = readFileSync((await (await d).path())!, 'utf8');
  await p.getByRole('tab', { name: 'Máscaras', exact: true }).click();
  return text;
}
async function command(p: Page, s: string) {
  const c = p.getByRole('textbox', { name: 'Comando CAD' });
  await c.fill(s);
  await c.press('Enter');
}
async function start(p: Page) {
  await p
    .getByRole('button', { name: 'Espelhar entidades da máscara', exact: true })
    .click();
}
async function select(p: Page) {
  await panel(p).getByRole('checkbox').nth(0).check();
  await panel(p).getByRole('checkbox').nth(1).check();
  await panel(p).getByRole('checkbox').nth(1).uncheck();
  await command(p, '');
}
for (const remove of [false, true])
  test(`Espelhar apagar origem=${remove}: prévia pura, um lote, IDs, repetição, histórico e recuperação`, async ({
    page,
  }) => {
    const seed = maskManipFixture();
    seed.masks[0].primitives[0] = nativePrimitive(
      {
        kind: 'line',
        points: [
          { x: 100, y: 0 },
          { x: 200, y: 50 },
        ],
        closed: false,
      },
      'line',
    );
    await open(page, seed);
    const before = await save(page),
      beforeCsv = await csv(page);
    await start(page);
    await select(page);
    await command(page, '0,0');
    await command(page, '0,1000');
    await expect(page.getByTestId('mirror-axis')).toBeVisible();
    await expect(
      panel(page).getByLabel('Apagar objetos de origem?', { exact: true }),
    ).toHaveValue('no');
    if (remove)
      await panel(page)
        .getByLabel('Apagar objetos de origem?', { exact: true })
        .selectOption('yes');
    expect((await save(page)).masks).toEqual(before.masks);
    if (!remove)
      await page.screenshot({ path: 'docs/mask-mirror-confirm.png' });
    await panel(page)
      .getByRole('button', {
        name: 'Confirmar espelhamento · Enter',
        exact: true,
      })
      .click();
    await expect(panel(page)).toHaveCount(0);
    const after = await save(page),
      v = after.masks[0].primitives[remove ? 0 : 3];
    expect(v.points[0].x).toBeCloseTo(-100, 8);
    expect(v.points[1].x).toBeCloseTo(-200, 8);
    expect(v.points[1].y).toBeCloseTo(50, 8);
    expect(v.id === 'line').toBe(remove);
    expect(after.masks[0].primitives).toHaveLength(remove ? 3 : 4);
    expect(after.bars).toEqual(before.bars);
    expect(after.annotations).toEqual(before.annotations);
    expect(after.masks[1]).toEqual(before.masks[1]);
    expect(after.scheduleLock).toEqual(before.scheduleLock);
    expect(await csv(page)).toBe(beforeCsv);
    await command(page, '');
    expect((await save(page)).masks).toEqual(after.masks);
    await command(page, 'U');
    expect((await save(page)).masks).toEqual(before.masks);
    await command(page, 'REDO');
    expect((await save(page)).masks).toEqual(after.masks);
    await page.waitForTimeout(800);
    await page.reload();
    await expect(page.locator('.busy-overlay')).toHaveCount(0);
    expect((await save(page)).masks).toEqual(after.masks);
  });
test('Esc em seleção/eixo/pergunta; eixo degenerado e mudança de projeto não aplicam', async ({
  page,
}) => {
  await open(page);
  const before = await save(page);
  for (const stage of ['selection', 'base', 'target', 'confirm']) {
    await start(page);
    if (stage !== 'selection') {
      await select(page);
      if (stage !== 'base') {
        await command(page, '0,0');
        if (stage === 'confirm') await command(page, '0,1000');
      }
    }
    await page.keyboard.press('Escape');
    expect((await save(page)).masks).toEqual(before.masks);
  }
  await start(page);
  await select(page);
  await command(page, '0,0');
  await command(page, '0,0');
  await expect(panel(page).getByRole('alert')).toContainText(
    'pontos distintos',
  );
  expect((await save(page)).masks).toEqual(before.masks);
  await command(page, '0,1000');
  await page.getByTestId('project-input').setInputFiles({
    name: 'new.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(emptyProject())),
  });
  await expect(panel(page)).toHaveCount(0);
  await command(page, '');
  expect((await save(page)).masks).toHaveLength(0);
});
test('pré-seleção, eixo por snap/clique, Foco e referência transformada com texto', async ({
  page,
}) => {
  await open(page);
  const svg = page.getByTestId('cad-canvas');
  const position = (q: { x: number; y: number }) =>
    svg.evaluate((s, q) => {
      const a = new DOMPoint(q.x, q.y).matrixTransform(
        (s.querySelector('g[transform]') as SVGGElement).getScreenCTM()!,
      );
      return { x: a.x, y: a.y };
    }, q);
  let at = await position({ x: 500, y: 0 });
  await page.mouse.click(at.x, at.y);
  await page
    .getByRole('dialog', { name: 'Controle de máscaras', exact: true })
    .getByRole('button', {
      name: 'Usar esta máscara e Espelhar entidades',
      exact: true,
    })
    .click();
  await expect(panel(page)).toContainText('1 entidade(s)');
  await command(page, '');
  await command(page, '0,0');
  // Endpoint of the external line is a reusable CAD snap, not an edit target.
  at = await position({ x: 1500, y: 1000 });
  await page.mouse.move(at.x, at.y);
  await expect(page.getByTestId('mirror-axis')).toBeVisible();
  await page.screenshot({ path: 'docs/mask-mirror-axis.png' });
  await page.mouse.click(at.x, at.y);
  await expect(
    panel(page).getByLabel('Apagar objetos de origem?', { exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  const seed = maskManipFixture();
  Object.assign(seed.masks[0], {
    format: 'DXF',
    scale: 2,
    rotation: 30,
    origin: { x: 100, y: 200 },
  });
  seed.masks[0].primitives.push({
    id: 'text',
    layer: 'DESENHO',
    points: [{ x: 100, y: 200 }],
    text: 'Cota 100',
    textHeight: 25,
    textRotation: 20,
  });
  await open(page, seed);
  const before = await save(page);
  await command(page, 'MIRROR');
  await panel(page).getByRole('checkbox').nth(3).check();
  await command(page, '');
  await command(page, '0,0');
  await command(page, '1000,1000');
  await panel(page)
    .getByLabel('Apagar objetos de origem?', { exact: true })
    .selectOption('yes');
  await page.keyboard.press('Control+0');
  await page.setViewportSize({ width: 900, height: 650 });
  await save(page);
  await page.screenshot({ path: 'docs/mask-mirror-compact.png' });
  await panel(page)
    .getByRole('button', {
      name: 'Confirmar espelhamento · Enter',
      exact: true,
    })
    .click();
  const after = await save(page);
  const expected = transformPoint(
      maskPoint(before.masks[0].primitives[3].points[0], before.masks[0]),
      { kind: 'mirror', base: { x: 0, y: 0 }, axisEnd: { x: 1000, y: 1000 } },
    ),
    actual = maskPoint(after.masks[0].primitives[3].points[0], after.masks[0]);
  expect(actual.x).toBeCloseTo(expected.x, 7);
  expect(actual.y).toBeCloseTo(expected.y, 7);
  expect(after.masks[0].primitives[3].text).toBe('Cota 100');
  expect(after.bars).toEqual(before.bars);
});
