import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { maskOffsetFixture } from '../fixtures/maskOffset';
import { emptyProject, schedule } from '../../src/domain/model';
import { setLayerState } from '../../src/domain/layerProfiles';
import { layerId } from '../../src/domain/layers';
import { maskPoint } from '../../src/cad/import';
import { nativePrimitive } from '../../src/domain/nativeMasks';
import type { Point, Project } from '../../src/domain/types';
const panel = (p: Page) =>
  p.getByRole('region', { name: 'Offset de máscaras', exact: true });
async function open(p: Page, seed = maskOffsetFixture()) {
  await p.goto('/');
  await expect(p.locator('.busy-overlay')).toHaveCount(0);
  await p.getByTestId('project-input').setInputFiles({
    name: 'offset.json',
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
  const download = p.waitForEvent('download');
  await p
    .locator('.quick-tools')
    .getByRole('button', { name: 'Salvar projeto', exact: true })
    .click();
  return JSON.parse(readFileSync((await (await download).path())!, 'utf8'));
}
async function command(p: Page, value: string) {
  const c = p.getByRole('textbox', { name: 'Comando CAD' });
  await c.fill(value);
  await c.press('Enter');
}
async function position(p: Page, at: Point) {
  return p.getByTestId('cad-canvas').evaluate(async (svg, at) => {
    await new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r())),
    );
    const q = new DOMPoint(at.x, at.y).matrixTransform(
      (svg.querySelector('g[transform]') as SVGGElement).getScreenCTM()!,
    );
    return { x: q.x, y: q.y };
  }, at);
}
async function point(p: Page, at: Point, move = false) {
  const q = await position(p, at);
  if (move) await p.mouse.move(q.x, q.y);
  else await p.mouse.click(q.x, q.y);
}
async function start(p: Page, d = '100 mm') {
  await p
    .getByRole('button', { name: 'Offset — Paralelas de máscara', exact: true })
    .click();
  await expect(panel(p)).toBeVisible();
  await panel(p).getByLabel('Distância do Offset').fill(d);
  await panel(p)
    .getByRole('button', { name: 'Confirmar distância', exact: true })
    .click();
}
async function choose(p: Page) {
  const select = panel(p).getByLabel('Entidade para Offset', { exact: true });
  const value = await select.locator('option').nth(1).getAttribute('value');
  await select.selectOption(value!);
}

test('Offset no canvas: distância, seleção, prévia, repetição, histórico e recuperação sem alterar aço', async ({
  page,
}) => {
  await open(page);
  const before = await save(page);
  await page
    .getByRole('button', { name: 'Offset — Paralelas de máscara', exact: true })
    .click();
  await panel(page).getByLabel('Distância do Offset').fill('10 cm');
  await page.screenshot({ path: 'docs/mask-offset-distance.png' });
  await panel(page)
    .getByRole('button', { name: 'Confirmar distância', exact: true })
    .click();
  await point(page, { x: 500, y: 0 });
  await point(page, { x: 400, y: 300 }, true);
  await expect(panel(page).getByTestId('offset-result')).toContainText(
    '1 nova(s)',
  );
  expect((await save(page)).masks).toEqual(before.masks);
  await page.screenshot({ path: 'docs/mask-offset-preview.png' });
  const at = await position(page, { x: 400, y: 300 });
  await page.mouse.dblclick(at.x, at.y);
  const first = await save(page);
  expect(first.masks[0].primitives).toHaveLength(2);
  expect(first.masks[0].primitives[1].points).toEqual([
    { x: 0, y: 100 },
    { x: 1000, y: 100 },
  ]);
  await point(page, { x: 500, y: 0 });
  await command(page, '400,-300');
  const second = await save(page);
  expect(second.masks[0].primitives).toHaveLength(3);
  expect(second.masks[0].primitives[2].points).toEqual([
    { x: 0, y: -100 },
    { x: 1000, y: -100 },
  ]);
  expect(second.masks[0].primitives[0]).toEqual(before.masks[0].primitives[0]);
  expect(second.bars).toEqual(before.bars);
  expect(second.annotations).toEqual(before.annotations);
  expect(second.scheduleLock).toEqual(before.scheduleLock);
  expect(schedule(second)).toEqual(schedule(before));
  expect(second.masks[1]).toEqual(before.masks[1]);
  expect(new Set(second.masks[0].primitives.map((p) => p.id)).size).toBe(3);
  await page.keyboard.press('Enter');
  await expect(panel(page)).toHaveCount(0);
  await page.keyboard.press('Enter');
  expect((await save(page)).masks).toEqual(second.masks);
  await command(page, 'U');
  expect((await save(page)).masks).toEqual(first.masks);
  await command(page, 'REDO');
  expect((await save(page)).masks).toEqual(second.masks);
  await page.screenshot({ path: 'docs/mask-offset-result.png' });
  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.locator('.busy-overlay')).toHaveCount(0);
  expect((await save(page)).masks).toEqual(second.masks);
});

test('Offset de círculo: R600/R400 analíticos e interno inviável não cria cópia', async ({
  page,
}) => {
  await open(page, maskOffsetFixture('circle'));
  await start(page);
  await choose(page);
  await command(page, '500,1200');
  expect((await save(page)).masks[0].primitives[1].native).toMatchObject({
    kind: 'circle',
    radius: 600,
    center: { x: 500, y: 500 },
  });
  await choose(page);
  await command(page, '500,500');
  const two = await save(page);
  expect(two.masks[0].primitives[2].native).toMatchObject({ radius: 400 });
  await panel(page)
    .getByRole('button', { name: 'Alterar distância', exact: true })
    .click();
  await panel(page).getByLabel('Distância do Offset').fill('500 mm');
  await panel(page)
    .getByRole('button', { name: 'Confirmar distância', exact: true })
    .click();
  await choose(page);
  await command(page, '500,500');
  await expect(panel(page).getByRole('alert')).toContainText('Raio interno');
  expect((await save(page)).masks).toEqual(two.masks);
  await page.keyboard.press('Escape');
});

test('Offset de retângulo: zoom e pontos invertidos mantêm 800×300/1200×700', async ({
  page,
}) => {
  const p = maskOffsetFixture('rectangle');
  if (p.masks[0].primitives[0].native?.kind === 'rectangle')
    p.masks[0].primitives[0] = nativePrimitive(
      {
        ...p.masks[0].primitives[0].native,
        points: [...p.masks[0].primitives[0].native.points].reverse(),
      },
      'offset-source',
    );
  await open(page, p);
  await start(page);
  await choose(page);
  await command(page, '500,250');
  let q = await save(page);
  expect(q.masks[0].primitives[1].native).toEqual({
    kind: 'rectangle',
    points: [
      { x: 100, y: 100 },
      { x: 900, y: 400 },
    ],
    closed: true,
  });
  await page.getByTestId('cad-canvas').hover();
  await page.mouse.wheel(0, -400);
  await choose(page);
  await command(page, '-300,250');
  q = await save(page);
  expect(q.masks[0].primitives[2].native).toEqual({
    kind: 'rectangle',
    points: [
      { x: -100, y: -100 },
      { x: 1100, y: 600 },
    ],
    closed: true,
  });
  await page.keyboard.press('Escape');
});

test('Distância por dois pontos usa coordenadas relativas e Enter/Esc descartam prévias em todas as etapas', async ({
  page,
}) => {
  await open(page);
  const before = await save(page);
  await page
    .getByRole('button', { name: 'Offset — Paralelas de máscara', exact: true })
    .click();
  await page.keyboard.press('Escape');
  expect((await save(page)).masks).toEqual(before.masks);
  await page
    .getByRole('button', { name: 'Offset — Paralelas de máscara', exact: true })
    .click();
  await panel(page)
    .getByRole('button', { name: 'Distância por dois pontos', exact: true })
    .click();
  await command(page, '0,0');
  await command(page, '@100,0');
  await expect(panel(page).getByTestId('offset-distance')).toContainText('100');
  await panel(page).getByLabel('Pesquisar entidades Offset').press('Enter');
  await expect(panel(page)).toHaveCount(0);
  expect((await save(page)).masks).toEqual(before.masks);
  await start(page);
  await choose(page);
  await point(page, { x: 400, y: 300 }, true);
  await page.keyboard.press('Enter');
  expect((await save(page)).masks).toEqual(before.masks);
  await command(page, 'OFFSET');
  await panel(page)
    .getByRole('button', { name: 'Distância por dois pontos', exact: true })
    .click();
  await command(page, '0,0');
  await page.keyboard.press('Escape');
  expect((await save(page)).masks).toEqual(before.masks);
});

test('Contorno com gargalo mostra dois remanescentes, confirma todos atomicamente e Undo restaura original', async ({
  page,
}) => {
  await open(page, maskOffsetFixture('split'));
  const before = await save(page);
  await start(page, '150 mm');
  await choose(page);
  await command(page, '500,500');
  const result = await save(page);
  expect(result.masks[0].primitives).toHaveLength(3);
  await choose(page);
  await point(page, { x: 500, y: 500 }, true);
  await expect(panel(page).getByTestId('offset-result')).toContainText(
    '2 remanescentes',
  );
  await page.screenshot({ path: 'docs/mask-offset-split.png' });
  await page.keyboard.press('Escape');
  await command(page, 'U');
  expect((await save(page)).masks).toEqual(before.masks);
  expect(result.bars).toEqual(before.bars);
});

test('Seleção protegida/estrangeira, distância inválida e clique sobre linha não alteram dados', async ({
  page,
}) => {
  let p = maskOffsetFixture();
  p.masks[0].primitives[0].layerId = layerId('DESENHO');
  p = setLayerState(p, 'model', layerId('DESENHO'), { editable: false });
  await open(page, p);
  const before = await save(page);
  await start(page, '0 mm');
  await expect(panel(page).getByRole('alert')).toBeVisible();
  await panel(page).getByLabel('Distância do Offset').fill('100');
  await panel(page)
    .getByRole('button', { name: 'Confirmar distância', exact: true })
    .click();
  await expect(panel(page).getByRole('alert')).toContainText('unidade');
  await panel(page).getByLabel('Distância do Offset').fill('100 mm');
  await panel(page)
    .getByRole('button', { name: 'Confirmar distância', exact: true })
    .click();
  await choose(page);
  await expect(panel(page).getByRole('alert')).toContainText('bloqueada');
  await page.keyboard.press('Escape');
  expect((await save(page)).masks).toEqual(before.masks);
  await open(page);
  await start(page);
  await command(page, '1500,500');
  await expect(panel(page).getByRole('alert')).toContainText('máscara ativa');
  await choose(page);
  await command(page, '500,0');
  await expect(panel(page).getByRole('alert')).toContainText('sobre');
  expect((await save(page)).masks[0].primitives).toHaveLength(1);
});

test('DXF transformado mantém afastamento físico, fonte/estilo e exportação; Esc após aplicação conserva a cópia', async ({
  page,
}) => {
  const p = maskOffsetFixture();
  Object.assign(p.masks[0], {
    format: 'DXF',
    sourceUnit: 'cm',
    scale: 2,
    rotation: 30,
    origin: { x: 100, y: 200 },
  });
  p.masks[0].primitives[0].style = { color: '#ab1234', lineWidth: 0.5 };
  await open(page, p);
  const before = await save(page);
  await start(page, '0.1 m');
  await choose(page);
  const at = maskPoint({ x: 500, y: 100 }, p.masks[0]);
  await command(page, `${at.x},${at.y}`);
  await page.keyboard.press('Escape');
  const q = await save(page),
    m = q.masks[0];
  const a = maskPoint(m.primitives[0].points[0], m),
    b = maskPoint(m.primitives[0].points[1], m),
    c = maskPoint(m.primitives[1].points[0], m);
  expect(
    Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) /
      Math.hypot(b.x - a.x, b.y - a.y),
  ).toBeCloseTo(100, 8);
  expect(m.primitives[1].style).toEqual(before.masks[0].primitives[0].style);
  expect(m.sourceUnit).toBe('cm');
  await page.getByRole('tab', { name: 'Arquivo', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Desenho DXF', exact: true }).click();
  expect(readFileSync((await (await download).path())!, 'utf8')).toContain(
    'LWPOLYLINE',
  );
});

test('Troca de máscara/projeto cancela preparação; seleção residual de aço é descartada', async ({
  page,
}) => {
  await open(page);
  await point(page, { x: 500, y: -1000 });
  await start(page);
  await expect(panel(page)).toContainText('somente entidades');
  await choose(page);
  const stable = await save(page);
  await page.getByRole('tab', { name: 'Pranchas', exact: true }).click();
  await page
    .getByRole('button', { name: 'Abrir Folha 1', exact: true })
    .click();
  await expect(panel(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Desenho', exact: true }).click();
  await save(page);
  await page.keyboard.press('Delete');
  expect((await save(page)).masks).toEqual(stable.masks);
  await start(page);
  await choose(page);
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
  await expect(panel(page)).toHaveCount(0);
  expect((await save(page)).masks[0].primitives).toHaveLength(1);
  await d
    .getByLabel('Escolher máscara', { exact: true })
    .selectOption('target-mask');
  await d
    .getByRole('button', { name: 'Ativar máscara para desenhar', exact: true })
    .click();
  await start(page);
  await choose(page);
  await page.getByTestId('project-input').setInputFiles({
    name: 'new.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(emptyProject())),
  });
  await expect(panel(page)).toHaveCount(0);
  await page.keyboard.press('Enter');
  expect((await save(page)).masks).toHaveLength(0);
});

test('Offset pelo Controle e em Foco/janela estreita; Delete descarta preparação sem excluir máscara', async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole('button', { name: 'Controle de máscaras', exact: true })
    .click();
  const dialog = page.getByRole('dialog', {
    name: 'Controle de máscaras',
    exact: true,
  });
  await dialog
    .getByRole('button', { name: 'Usar esta máscara e Offset', exact: true })
    .click();
  await expect(panel(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+0');
  await page.setViewportSize({ width: 900, height: 650 });
  await page
    .getByLabel('Ferramentas CAD da máscara ativa')
    .selectOption('offset');
  await panel(page).getByLabel('Distância do Offset').fill('100 mm');
  await panel(page)
    .getByRole('button', { name: 'Confirmar distância', exact: true })
    .click();
  await choose(page);
  await page.screenshot({ path: 'docs/mask-offset-compact.png' });
  await save(page);
  await page.keyboard.press('Delete');
  await expect(panel(page)).toHaveCount(0);
  expect((await save(page)).masks[0].primitives).toHaveLength(1);
});
