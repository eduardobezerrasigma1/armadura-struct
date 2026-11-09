import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { maskManipFixture } from '../fixtures/maskManipulation';
import { nativePrimitive } from '../../src/domain/nativeMasks';
import { emptyProject } from '../../src/domain/model';
import { setLayerState } from '../../src/domain/layerProfiles';
import type { Project, Point } from '../../src/domain/types';
const panel = (p: Page) =>
  p.getByRole('region', { name: 'Medir e cotar', exact: true });
const fixture = () => {
  const p = maskManipFixture();
  p.masks[0].primitives[0] = nativePrimitive(
    {
      kind: 'line',
      points: [
        { x: 0, y: 0 },
        { x: 3000, y: 4000 },
      ],
      closed: false,
    },
    'line',
  );
  return p;
};
async function open(p: Page, seed = fixture()) {
  await p.goto('/');
  await expect(p.locator('.busy-overlay')).toHaveCount(0);
  await p.getByTestId('project-input').setInputFiles({
    name: 'dimensions.json',
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
async function command(p: Page, s: string) {
  const c = p.getByRole('textbox', { name: 'Comando CAD' });
  await c.fill(s);
  await c.press('Enter');
}
async function exported(p: Page, button: string) {
  await p.getByRole('tab', { name: 'Arquivo', exact: true }).click();
  const d = p.waitForEvent('download');
  await p.getByRole('button', { name: button, exact: true }).click();
  const text = readFileSync((await (await d).path())!, 'utf8');
  await p.getByRole('tab', { name: 'Máscaras', exact: true }).click();
  return text;
}
async function position(p: Page, q: Point) {
  return p.getByTestId('cad-canvas').evaluate(async (s, q) => {
    await new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r())),
    );
    const a = new DOMPoint(q.x, q.y).matrixTransform(
      (s.querySelector('g[transform]') as SVGGElement).getScreenCTM()!,
    );
    return { x: a.x, y: a.y };
  }, q);
}
async function aligned(p: Page) {
  await p.getByRole('button', { name: 'Cota alinhada', exact: true }).click();
  await panel(p)
    .getByLabel('Precisão da medida', { exact: true })
    .selectOption('0');
  await command(p, '0,0');
  await command(p, '3000,4000');
}
test('Medir consulta 3-4-5, prévia, ΔX/ΔY, unidades, repetição e zoom sem objetos/histórico/salvamento', async ({
  page,
}) => {
  await open(page);
  const original = await save(page);
  await page.getByRole('button', { name: 'Linha', exact: true }).click();
  await command(page, '5000,0');
  await command(page, '6000,0');
  await page.keyboard.press('Escape');
  const before = await save(page),
    csv = await exported(page, 'Quadro CSV');
  await expect(page.locator('.save-status')).toHaveText(
    'Salvo neste computador',
  );
  await page
    .getByRole('button', { name: 'Medir distância', exact: true })
    .click();
  await command(page, '0,0');
  const at = await position(page, { x: 1500, y: 2000 });
  await page.mouse.move(at.x, at.y);
  await expect(panel(page).getByRole('status')).toContainText('2500');
  await command(page, '3000,4000');
  await expect(panel(page).getByRole('status')).toContainText('5000,00 mm');
  await expect(panel(page).getByRole('status')).toContainText('ΔX: 3000,00 mm');
  await expect(panel(page).getByRole('status')).toContainText('ΔY: 4000,00 mm');
  await panel(page)
    .getByLabel('Unidade da medida', { exact: true })
    .selectOption('m');
  await panel(page)
    .getByLabel('Precisão da medida', { exact: true })
    .selectOption('3');
  await expect(panel(page).getByRole('status')).toContainText('5,000 m');
  expect(await save(page)).toEqual(before);
  await expect(page.locator('.save-status')).toHaveText(
    'Salvo neste computador',
  );
  await page.screenshot({ path: 'docs/mask-dimensions-measure.png' });
  await command(page, '0,0');
  await page.getByTestId('cad-canvas').hover();
  await page.mouse.wheel(0, -400);
  await command(page, '1000,0');
  await expect(panel(page).getByRole('status')).toContainText('1,000 m');
  await page.keyboard.press('Escape');
  expect(await save(page)).toEqual(before);
  expect(await exported(page, 'Quadro CSV')).toBe(csv);
  await command(page, 'U');
  expect((await save(page)).masks).toEqual(original.masks);
});
test('Cotas alinhada/horizontal/vertical usam terceira posição; prévia pura, unidades, histórico, recuperação e CSV', async ({
  page,
}) => {
  await open(page);
  const before = await save(page),
    csv = await exported(page, 'Quadro CSV');
  await aligned(page);
  expect((await save(page)).annotations).toEqual(before.annotations);
  const at = await position(page, { x: 1500, y: 3000 });
  await page.mouse.move(at.x, at.y);
  await page.screenshot({ path: 'docs/mask-dimensions-position.png' });
  await command(page, '1500,3000');
  await expect(panel(page)).toHaveCount(0);
  await expect(
    page.getByTestId('cad-annotation').getByText('5000 mm', { exact: true }),
  ).toBeVisible();
  await command(page, 'DIM');
  await command(page, '0,0');
  await command(page, '3000,4000');
  await command(page, '1500,6000');
  await command(page, 'COTA');
  await command(page, '0,0');
  await command(page, '3000,4000');
  await command(page, '6000,2000');
  const after = await save(page);
  expect(after.annotations).toHaveLength(before.annotations.length + 3);
  expect(
    after.annotations.slice(-3).every((a) => a.maskReferences?.length === 2),
  ).toBe(true);
  expect(after.bars).toEqual(before.bars);
  expect(after.masks).toEqual(before.masks);
  expect(after.scheduleLock).toEqual(before.scheduleLock);
  await command(page, '');
  expect((await save(page)).annotations).toEqual(after.annotations);
  await command(page, 'U');
  expect((await save(page)).annotations).toHaveLength(
    after.annotations.length - 1,
  );
  await command(page, 'REDO');
  expect((await save(page)).annotations).toEqual(after.annotations);
  expect(await exported(page, 'Quadro CSV')).toBe(csv);
  const dxf = await exported(page, 'Desenho DXF');
  for (const text of ['5000 mm', '3000 mm', '4000 mm'])
    expect(dxf).toContain(text);
  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.locator('.busy-overlay')).toHaveCount(0);
  expect((await save(page)).annotations).toEqual(after.annotations);
});
test('referência apagada mantém cota estática com aviso no canvas, arquivo e DXF; Undo restaura verificação', async ({
  page,
}) => {
  await open(page);
  await aligned(page);
  await command(page, '1500,3000');
  const before = await save(page);
  await page
    .getByRole('button', { name: 'Apagar entidades da máscara', exact: true })
    .click();
  const erase = page.getByRole('region', {
    name: 'Apagar entidades da máscara',
    exact: true,
  });
  await erase.getByRole('checkbox').nth(0).check();
  await command(page, '');
  await expect(page.locator('.mask-dimension-warning')).toContainText(
    'referência',
  );
  const after = await save(page);
  expect(after.annotations).toEqual(before.annotations);
  expect(after.bars).toEqual(before.bars);
  await page.screenshot({ path: 'docs/mask-dimensions-warning.png' });
  expect(await exported(page, 'Desenho DXF')).toContain(
    '[REFERÊNCIA ALTERADA]',
  );
  await command(page, 'U');
  await expect(page.locator('.mask-dimension-warning')).toHaveCount(0);
  expect((await save(page)).masks).toEqual(before.masks);
});
test('Esc antes da posição, layer protegido e troca de contexto/projeto não criam cota parcial', async ({
  page,
}) => {
  await open(page);
  const before = await save(page);
  await aligned(page);
  await page.keyboard.press('Escape');
  expect((await save(page)).annotations).toEqual(before.annotations);
  await aligned(page);
  const dest = page.getByRole('region', {
    name: 'Destino do desenho de máscaras',
    exact: true,
  });
  await dest
    .getByLabel('Escolher máscara', { exact: true })
    .selectOption('external-mask');
  await dest
    .getByRole('button', { name: 'Ativar máscara para desenhar', exact: true })
    .click();
  await expect(panel(page)).toHaveCount(0);
  expect((await save(page)).annotations).toEqual(before.annotations);
  await command(page, 'MEDIR');
  await command(page, '0,0');
  await page.getByTestId('project-input').setInputFiles({
    name: 'new.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(emptyProject())),
  });
  await expect(panel(page)).toHaveCount(0);
  expect((await save(page)).annotations).toHaveLength(0);
  let p = fixture();
  p = setLayerState(p, 'model', p.layers.find((l) => l.name === 'COTAS')!.id, {
    editable: false,
  });
  await open(page, p);
  const locked = await save(page);
  await aligned(page);
  await command(page, '1500,3000');
  expect((await save(page)).annotations).toEqual(locked.annotations);
  await page.keyboard.press('Escape');
});
test('Mesmo comando em Desenho e acesso compacto em Foco; máscara transformada mede mm físicos', async ({
  page,
}) => {
  const seed = fixture();
  Object.assign(seed.masks[0], {
    scale: 2,
    rotation: 30,
    origin: { x: 100, y: 200 },
    format: 'DXF',
    sourceUnit: 'cm',
  });
  await open(page, seed);
  await page.getByRole('tab', { name: 'Desenho', exact: true }).click();
  await page
    .getByRole('button', { name: 'Cota alinhada', exact: true })
    .click();
  await expect(panel(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Máscaras', exact: true }).click();
  await page.getByRole('button', { name: 'Foco no CAD', exact: true }).click();
  await expect(page.locator('.app-shell')).toHaveClass(/focus-mode/);
  await page.setViewportSize({ width: 900, height: 650 });
  await page
    .getByLabel('Ferramentas CAD da máscara ativa', { exact: true })
    .selectOption('measure');
  await command(page, '100,200');
  const x = 100 + 6000 * Math.cos(Math.PI / 6) - 8000 * Math.sin(Math.PI / 6),
    y = 200 + 6000 * Math.sin(Math.PI / 6) + 8000 * Math.cos(Math.PI / 6);
  await command(page, `${x},${y}`);
  await expect(panel(page).getByRole('status')).toContainText('10000,00 mm');
  await save(page);
  await page.screenshot({ path: 'docs/mask-dimensions-compact.png' });
  await page.keyboard.press('Escape');
  expect((await save(page)).annotations).toHaveLength(seed.annotations.length);
});
