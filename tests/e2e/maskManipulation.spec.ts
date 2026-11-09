import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { maskManipFixture } from '../fixtures/maskManipulation';
import { emptyProject, schedule } from '../../src/domain/model';
import { nativePrimitive } from '../../src/domain/nativeMasks';
import { layerId } from '../../src/domain/layers';
import { setLayerState } from '../../src/domain/layerProfiles';
import { maskPoint } from '../../src/cad/import';
import type { Point, Project } from '../../src/domain/types';
const panel = (p: Page, mode = 'Apagar') =>
  p.getByRole('region', { name: `${mode} entidades da máscara`, exact: true });
async function open(p: Page, value = maskManipFixture()) {
  await p.goto('/');
  await expect(p.locator('.busy-overlay')).toHaveCount(0);
  await p.getByTestId('project-input').setInputFiles({
    name: 'manip.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(value)),
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
async function position(p: Page, q: Point) {
  return p.getByTestId('cad-canvas').evaluate(async (svg, q) => {
    await new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r())),
    );
    const s = new DOMPoint(q.x, q.y).matrixTransform(
      (svg.querySelector('g[transform]') as SVGGElement).getScreenCTM()!,
    );
    return { x: s.x, y: s.y };
  }, q);
}
async function click(p: Page, x: number, y: number) {
  const q = await position(p, { x, y });
  await p.mouse.click(q.x, q.y);
}
async function start(p: Page, mode = 'Apagar') {
  await p
    .getByRole('button', { name: `${mode} entidades da máscara`, exact: true })
    .click();
  await expect(panel(p, mode)).toBeVisible();
}
test('Apagar acumula/retira por clique, confirma duas entidades numa operação e mantém aço e outras máscaras', async ({
  page,
}) => {
  await open(page);
  const before = await save(page);
  await start(page);
  await click(page, 500, 0);
  await click(page, 100, 500);
  await click(page, 100, 500);
  await expect(panel(page)).toContainText('1 entidade(s)');
  await click(page, 100, 500);
  expect((await save(page)).masks).toEqual(before.masks);
  await page.screenshot({ path: 'docs/mask-erase-selection.png' });
  await page.keyboard.press('Enter');
  await expect(panel(page)).toHaveCount(0);
  const result = await save(page);
  expect(result.masks[0].primitives).toEqual([before.masks[0].primitives[2]]);
  expect(result.bars).toEqual(before.bars);
  expect(result.masks[1]).toEqual(before.masks[1]);
  expect(result.scheduleLock).toEqual(before.scheduleLock);
  expect(schedule(result)).toEqual(schedule(before));
  await page.keyboard.press('Enter');
  expect((await save(page)).masks).toEqual(result.masks);
  await command(page, 'U');
  expect((await save(page)).masks).toEqual(before.masks);
  await command(page, 'REDO');
  expect((await save(page)).masks).toEqual(result.masks);
  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.locator('.busy-overlay')).toHaveCount(0);
  expect((await save(page)).masks).toEqual(result.masks);
});
test('Apagar última entidade deixa máscara vazia editável; seleção vazia/Esc são neutros', async ({
  page,
}) => {
  await open(page);
  const before = await save(page);
  await start(page);
  await page.keyboard.press('Enter');
  await expect(panel(page).getByRole('alert')).toContainText('Selecione');
  await panel(page).getByRole('checkbox').nth(0).check();
  await page.keyboard.press('Escape');
  expect((await save(page)).masks).toEqual(before.masks);
  await start(page);
  for (const checkbox of await panel(page).getByRole('checkbox').all())
    await checkbox.check();
  await page.keyboard.press('Enter');
  expect((await save(page)).masks[0].primitives).toHaveLength(0);
  await command(page, 'U');
  expect((await save(page)).masks[0].primitives).toEqual(
    before.masks[0].primitives,
  );
  await command(page, 'REDO');
  expect((await save(page)).masks[0].primitives).toHaveLength(0);
  await page.getByRole('button', { name: 'Linha', exact: true }).click();
  await command(page, '0,0');
  await command(page, '1000,0');
  expect((await save(page)).masks[0].primitives[0].points).toEqual([
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
  ]);
});
test('Copiar linha/círculo conserva a mesma base e originais em dois destinos, prévia, histórico e exportação DXF', async ({
  page,
}) => {
  await open(page);
  const before = await save(page);
  await start(page, 'Copiar');
  await click(page, 500, 0);
  await click(page, 100, 500);
  await page.keyboard.press('Enter');
  await command(page, '0,0');
  const at = await position(page, { x: 1000, y: 0 });
  await page.mouse.move(at.x, at.y);
  await expect(
    page.getByTestId('transform-preview').locator('path'),
  ).not.toHaveCount(0);
  await page.screenshot({ path: 'docs/mask-copy-preview.png' });
  expect((await save(page)).masks).toEqual(before.masks);
  await command(page, '@1000,0');
  const first = await save(page);
  expect(first.masks[0].primitives).toHaveLength(5);
  await command(page, '@0,1000');
  const second = await save(page);
  expect(second.masks[0].primitives).toHaveLength(7);
  expect(second.masks[0].primitives.slice(0, 3)).toEqual(
    before.masks[0].primitives,
  );
  expect(second.masks[0].primitives[5].points[0]).toEqual({ x: 0, y: 1000 });
  expect(new Set(second.masks[0].primitives.map((q) => q.id)).size).toBe(7);
  expect(second.bars).toEqual(before.bars);
  expect(second.scheduleLock).toEqual(before.scheduleLock);
  await page.keyboard.press('Enter');
  await expect(panel(page, 'Copiar')).toHaveCount(0);
  await command(page, 'U');
  expect((await save(page)).masks).toEqual(first.masks);
  await command(page, 'REDO');
  expect((await save(page)).masks).toEqual(second.masks);
  await page.getByRole('tab', { name: 'Arquivo', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Desenho DXF', exact: true }).click();
  expect(readFileSync((await (await download).path())!, 'utf8')).toContain(
    'LWPOLYLINE',
  );
});
test('Copiar em referência DXF transformada mantém vetor físico e ignora duplo clique', async ({
  page,
}) => {
  const p = maskManipFixture();
  Object.assign(p.masks[0], {
    format: 'DXF',
    sourceUnit: 'cm',
    scale: 2,
    rotation: 30,
    origin: { x: 100, y: 100 },
  });
  await open(page, p);
  const before = await save(page);
  await start(page, 'Copiar');
  await panel(page, 'Copiar').getByRole('checkbox').nth(0).check();
  await page.keyboard.press('Enter');
  await command(page, '100,100');
  const dest = { x: 600, y: 100 },
    at = await position(page, dest);
  await page.mouse.dblclick(at.x, at.y);
  const q = await save(page);
  expect(q.masks[0].primitives).toHaveLength(4);
  const old = maskPoint(q.masks[0].primitives[0].points[0], q.masks[0]),
    added = maskPoint(q.masks[0].primitives[3].points[0], q.masks[0]);
  // Pointer coordinates pass through the browser's screen matrix; domain tests use 1e-9 mm.
  expect(Math.abs(added.x - old.x - 500)).toBeLessThan(0.001);
  expect(Math.abs(added.y - old.y)).toBeLessThan(0.001);
  await page.keyboard.press('Escape');
  expect((await save(page)).masks).toEqual(q.masks);
  expect(q.bars).toEqual(before.bars);
});
test('layer protegido não apaga; troca de projeto cancela conjunto e destino', async ({
  page,
}) => {
  let p = maskManipFixture();
  p.masks[0].primitives[0].layerId = layerId('DESENHO');
  // The second target must use an unlocked layer; implicit DESENHO is protected too.
  p.masks[0].primitives[1].layerId = layerId('COTAS');
  p = setLayerState(p, 'model', layerId('DESENHO'), { editable: false });
  await open(page, p);
  const before = await save(page);
  await start(page);
  await panel(page).getByRole('checkbox').nth(0).click();
  await expect(panel(page).getByRole('alert')).toContainText('bloqueada');
  await page.keyboard.press('Escape');
  expect((await save(page)).masks).toEqual(before.masks);
  await start(page, 'Copiar');
  await panel(page, 'Copiar').getByRole('checkbox').nth(1).check();
  await page.keyboard.press('Enter');
  await command(page, '0,0');
  const next = emptyProject();
  await page.getByTestId('project-input').setInputFiles({
    name: 'next.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(next)),
  });
  await expect(panel(page, 'Copiar')).toHaveCount(0);
  await page.keyboard.press('Enter');
  expect((await save(page)).masks).toHaveLength(0);
});
test('Controle reutiliza pré-seleção; Foco, teclado e janela estreita continuam acessíveis', async ({
  page,
}) => {
  await open(page);
  await click(page, 500, 0);
  const dialog = page.getByRole('dialog', {
    name: 'Controle de máscaras',
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole('button', {
      name: 'Usar esta máscara e Copiar entidades',
      exact: true,
    })
    .click();
  await expect(panel(page, 'Copiar')).toContainText('1 entidade(s)');
  await page.keyboard.press('Enter');
  await command(page, '0,0');
  await page.keyboard.press('Escape');
  expect((await save(page)).masks[0].primitives).toHaveLength(3);
  await page.keyboard.press('Control+0');
  await page.setViewportSize({ width: 900, height: 650 });
  await page
    .getByLabel('Ferramentas CAD da máscara ativa')
    .selectOption('erase');
  await expect(panel(page)).toBeVisible();
  await panel(page).getByRole('checkbox').nth(0).check();
  await page.screenshot({ path: 'docs/mask-manip-compact.png' });
  await page.keyboard.press('Escape');
  expect((await save(page)).masks[0].primitives).toHaveLength(3);
});

test('Apagar com pré-seleção informa alcance, preserva cota e Undo restaura ID; barra residual e outra máscara não participam', async ({
  page,
}) => {
  await open(page);
  const before = await save(page);
  await click(page, 500, 0);
  const dialog = page.getByRole('dialog', {
    name: 'Controle de máscaras',
    exact: true,
  });
  await expect(dialog).toContainText('Cotas têm pontos estáticos');
  await dialog
    .getByRole('button', {
      name: 'Usar esta máscara e Apagar entidades',
      exact: true,
    })
    .click();
  await expect(dialog).toHaveCount(0);
  const after = await save(page);
  expect(after.masks[0].primitives).toEqual(
    before.masks[0].primitives.slice(1),
  );
  expect(after.annotations).toEqual(before.annotations);
  expect(after.bars).toEqual(before.bars);
  await command(page, 'U');
  expect((await save(page)).masks).toEqual(before.masks);
  await click(page, 500, -1000);
  await start(page);
  await expect(panel(page)).toContainText('0 entidade(s)');
  await click(page, 1500, 500);
  await expect(panel(page).getByRole('alert')).toContainText('máscara ativa');
  await page.keyboard.press('Enter');
  expect((await save(page)).masks).toEqual(before.masks);
  await page.keyboard.press('Escape');
});

test('Copiar abandona prévia com Enter/Esc em cada etapa e troca de máscara cancela; Enter no checkbox confirma', async ({
  page,
}) => {
  await open(page);
  const before = await save(page);
  await start(page, 'Copiar');
  await panel(page, 'Copiar').getByRole('checkbox').nth(0).check();
  await panel(page, 'Copiar').getByRole('checkbox').nth(0).press('Enter');
  await expect(panel(page, 'Copiar')).toContainText('Ponto base');
  await page.keyboard.press('Escape');
  expect((await save(page)).masks).toEqual(before.masks);
  await command(page, 'MCOPY');
  await panel(page, 'Copiar').getByRole('checkbox').nth(0).check();
  await page.keyboard.press('Enter');
  await command(page, '0,0');
  await command(page, '@1000<0');
  const first = await save(page);
  expect(first.masks[0].primitives).toHaveLength(4);
  const dest = await position(page, { x: 0, y: 1000 });
  await page.mouse.move(dest.x, dest.y);
  await page.screenshot({ path: 'docs/mask-copy-result.png' });
  await page.keyboard.press('Enter');
  expect((await save(page)).masks).toEqual(first.masks);
  await start(page, 'Copiar');
  await panel(page, 'Copiar').getByRole('checkbox').nth(0).check();
  await page.keyboard.press('Enter');
  await command(page, '0,0');
  await page
    .getByRole('region', {
      name: 'Destino do desenho de máscaras',
      exact: true,
    })
    .getByLabel('Escolher máscara', { exact: true })
    .selectOption('external-mask');
  await page
    .getByRole('button', { name: 'Ativar máscara para desenhar', exact: true })
    .click();
  await expect(panel(page, 'Copiar')).toHaveCount(0);
  expect((await save(page)).masks).toEqual(first.masks);
});

test('Delete durante Copiar cancela a prévia e após Apagar não trata máscara ativa como seleção integral', async ({
  page,
}) => {
  await open(page);
  const before = await save(page);
  await start(page, 'Copiar');
  await panel(page, 'Copiar').getByRole('checkbox').nth(0).check();
  await page.keyboard.press('Enter');
  await command(page, '0,0');
  await save(page);
  await page.keyboard.press('Delete');
  await expect(panel(page, 'Copiar')).toHaveCount(0);
  expect((await save(page)).masks).toEqual(before.masks);
  await start(page);
  await panel(page).getByRole('checkbox').nth(0).check();
  await save(page);
  await page.keyboard.press('Delete');
  const erased = await save(page);
  expect(erased.masks[0].primitives).toHaveLength(2);
  await save(page);
  await page.keyboard.press('Delete');
  expect((await save(page)).masks).toEqual(erased.masks);
});
