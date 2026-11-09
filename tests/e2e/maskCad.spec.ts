import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { maskCadFixture } from '../fixtures/maskCad';
import { emptyProject, schedule } from '../../src/domain/model';
import { maskCurve } from '../../src/domain/maskCadEditing';
import { setLayerState } from '../../src/domain/layerProfiles';
import { defaultLayers } from '../../src/domain/layers';
import { nativePrimitive } from '../../src/domain/nativeMasks';
import { confirmMaskImport } from './maskBatch.helpers';
import type { Point, Project } from '../../src/domain/types';
const panel = (page: Page, mode: 'trim' | 'extend' = 'trim') =>
  page.getByRole('region', {
    name: mode === 'trim' ? 'Ajustar — Aparar / Trim' : 'Estender — Extend',
    exact: true,
  });
async function load(page: Page, p: Project) {
  await page.goto('/');
  await expect(page.locator('.busy-overlay')).toHaveCount(0);
  await page.getByTestId('project-input').setInputFiles({
    name: 'mask-cad.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await page.getByRole('tab', { name: 'Máscaras', exact: true }).click();
}
async function save(page: Page): Promise<Project> {
  const close = page.getByRole('button', { name: 'Fechar aviso', exact: true });
  if (await close.isVisible()) await close.click();
  const event = page.waitForEvent('download');
  await page
    .locator('.quick-tools')
    .getByRole('button', { name: 'Salvar projeto', exact: true })
    .click();
  return JSON.parse(readFileSync((await (await event).path())!, 'utf8'));
}
async function activate(page: Page, id = 'target-mask') {
  const d = page.getByRole('region', {
    name: 'Destino do desenho de máscaras',
    exact: true,
  });
  await d.getByLabel('Escolher máscara', { exact: true }).selectOption(id);
  await d
    .getByRole('button', { name: 'Ativar máscara para desenhar', exact: true })
    .click();
}
async function command(page: Page, text: string) {
  const c = page.getByRole('textbox', { name: 'Comando CAD' });
  await c.fill(text);
  await c.press('Enter');
}
async function screen(page: Page, p: Point) {
  return page.getByTestId('cad-canvas').evaluate(async (svg, p) => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    const s = new DOMPoint(p.x, p.y).matrixTransform(
      (svg.querySelector('g[transform]') as SVGGElement).getScreenCTM()!,
    );
    return { x: s.x, y: s.y };
  }, p);
}
async function click(page: Page, x: number, y: number) {
  const at = await screen(page, { x, y });
  await page.mouse.click(at.x, at.y);
}
async function hover(page: Page, x: number, y: number) {
  const at = await screen(page, { x, y });
  await page.mouse.move(at.x, at.y);
}
async function start(page: Page, mode: 'trim' | 'extend' = 'trim') {
  await page
    .getByRole('button', {
      name:
        mode === 'trim'
          ? 'Ajustar — Aparar / Trim de máscara'
          : 'Estender — Extend de máscara',
      exact: true,
    })
    .click();
  await expect(panel(page, mode)).toBeVisible();
}

test('Ajustar: dois limites, prévia, dois cortes sucessivos e um Undo por corte preservam o aço', async ({
  page,
}) => {
  const p = maskCadFixture();
  await load(page, p);
  await activate(page);
  const before = await save(page);
  await start(page);
  await click(page, 300, 200);
  await click(page, 700, 200);
  await expect(panel(page)).toContainText('Limites escolhidos: 2');
  await page.screenshot({ path: 'docs/mask-trim-limits.png' });
  await page.keyboard.press('Enter');
  await expect(panel(page)).toContainText('2/2');
  await hover(page, 500, 0);
  await expect(panel(page).getByTestId('mask-cad-result')).toContainText('400');
  await expect(
    page.getByTestId('mask-cad-preview').locator('path'),
  ).toHaveCount(1);
  await page.screenshot({ path: 'docs/mask-trim-preview.png' });
  await click(page, 500, 0);
  const first = await save(page);
  expect(first.masks[0].primitives).toHaveLength(5);
  expect(
    first.masks[0].primitives
      .filter((p) => p.sourceEntityId === 'target')
      .map((q) => maskCurve(first.masks[0], q).total),
  ).toEqual([300, 300]);
  await click(page, 500, 100);
  const second = await save(page);
  expect(second.masks[0].primitives).toHaveLength(6);
  expect(second.bars).toEqual(before.bars);
  expect(second.scheduleLock).toEqual(before.scheduleLock);
  expect(schedule(second)).toEqual(schedule(before));
  expect(second.masks[1]).toEqual(before.masks[1]);
  await page.screenshot({ path: 'docs/mask-trim-result.png' });
  await page.keyboard.press('Escape');
  await command(page, 'U');
  expect((await save(page)).masks).toEqual(first.masks);
  await command(page, 'REDO');
  expect((await save(page)).masks).toEqual(second.masks);
  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.locator('.busy-overlay')).toHaveCount(0);
  expect((await save(page)).masks).toEqual(second.masks);
});

test('Extend: ponta errada é neutra, primeiro limite vence e Enter/Esc não repetem a operação', async ({
  page,
}) => {
  const p = maskCadFixture('extend');
  await load(page, p);
  await activate(page);
  await start(page, 'extend');
  await click(page, 700, 200);
  await click(page, 1000, 200);
  await page.keyboard.press('Enter');
  await click(page, 10, 0);
  await expect(panel(page, 'extend').getByRole('alert')).toContainText(
    'adiante',
  );
  expect((await save(page)).masks[0].primitives[0].points.at(-1)?.x).toBe(400);
  await hover(page, 390, 0);
  await expect(
    panel(page, 'extend').getByTestId('mask-cad-result'),
  ).toContainText('300');
  await page.screenshot({ path: 'docs/mask-extend-preview.png' });
  const at = await screen(page, { x: 390, y: 0 });
  await page.mouse.dblclick(at.x, at.y);
  const after = await save(page);
  expect(after.masks[0].primitives[0].points).toEqual([
    { x: 0, y: 0 },
    { x: 700, y: 0 },
  ]);
  expect(after.masks[0].primitives[0].id).toBe('target');
  expect(after.bars).toEqual(p.bars);
  await click(page, 690, 0);
  await expect(panel(page, 'extend').getByRole('alert')).toContainText(
    'já está',
  );
  expect((await save(page)).masks).toEqual(after.masks);
  await page.keyboard.press('Enter');
  await expect(panel(page, 'extend')).toHaveCount(0);
  await page.keyboard.press('Enter');
  expect((await save(page)).masks).toEqual(after.masks);
  await command(page, 'U');
  expect((await save(page)).masks[0].primitives[0].points.at(-1)?.x).toBe(400);
  await command(page, 'REDO');
  expect((await save(page)).masks).toEqual(after.masks);
});

test('círculo aparado vira arco analítico, que pode ser estendido mantendo o raio', async ({
  page,
}) => {
  const p = maskCadFixture('circle');
  await load(page, p);
  await activate(page);
  await start(page);
  await click(page, 500, 260);
  await page.keyboard.press('Enter');
  // Pick the circular interval away from the overlapping horizontal limit.
  await hover(page, 673.2050807569, 100);
  await expect(panel(page).getByTestId('mask-cad-result')).toBeVisible();
  await click(page, 673.2050807569, 100);
  await page.keyboard.press('Enter');
  let q = await save(page);
  expect(q.masks[0].primitives[0].native).toMatchObject({
    kind: 'arc',
    radius: 200,
    startAngle: 90,
  });
  const trimmed = q.masks[0].primitives[0].native!;
  if (trimmed.kind !== 'arc') throw Error('arc');
  expect(trimmed.sweepAngle).toBeCloseTo(180, 8);
  expect(q.schema).toBe('armadurastruct/24');
  await start(page, 'extend');
  await click(page, 700, 0);
  await page.keyboard.press('Enter');
  await hover(page, 465.2703644666, 196.9615506024);
  await expect(
    panel(page, 'extend').getByTestId('mask-cad-result'),
  ).toBeVisible();
  await click(page, 465.2703644666, 196.9615506024);
  await page.keyboard.press('Escape');
  q = await save(page);
  expect(q.masks[0].primitives[0].native?.kind).toBe('arc');
  const arc = q.masks[0].primitives[0].native!;
  if (arc.kind === 'arc') {
    expect(arc.radius).toBe(200);
    expect(arc.sweepAngle).toBeCloseTo(270, 8);
  }
  expect(q.bars).toEqual(p.bars);
  await page.screenshot({ path: 'docs/mask-cad-arc.png' });
  await page
    .getByRole('button', { name: 'Controle de máscaras', exact: true })
    .click();
  const control = page.getByRole('dialog', {
    name: 'Controle de máscaras',
    exact: true,
  });
  await control
    .getByLabel('Entidade da máscara', { exact: true })
    .selectOption('circle');
  await expect(
    control.getByLabel('Abertura do arco', { exact: true }),
  ).toHaveValue('270');
  await page.keyboard.press('Escape');
});

test('Enter sem seleção usa limites elegíveis e Esc descarta apenas prévia; texto e aço não são apagados', async ({
  page,
}) => {
  const p = maskCadFixture();
  await load(page, p);
  await activate(page);
  const before = await save(page);
  await start(page);
  await expect(panel(page)).toContainText('Limites escolhidos: 0');
  await page.keyboard.press('Enter');
  await expect(panel(page)).toContainText('todas as referências');
  await hover(page, 500, 0);
  await expect(panel(page).getByTestId('mask-cad-result')).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await save(page)).toEqual(before);
  await start(page);
  await page.keyboard.press('Enter');
  await click(page, 500, 0);
  await page.keyboard.press('Escape');
  const after = await save(page);
  expect(after.masks[0].primitives).toHaveLength(5);
  expect(after.bars).toEqual(before.bars);
});

test('referência importada em cm é editada localmente com IDs estáveis, sem alterar origem nem criar aço', async ({
  page,
}) => {
  await load(page, emptyProject());
  const dxf =
    '0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n5\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n0\nLINE\n8\nFORMA\n10\n0\n20\n0\n11\n100\n21\n0\n0\nLINE\n8\nFORMA\n10\n40\n20\n-30\n11\n40\n21\n30\n0\nTEXT\n8\nFORMA\n10\n20\n20\n50\n40\n2.5\n1\nFORMA\n0\nENDSEC\n0\nEOF\n';
  await page.getByTestId('mask-input').setInputFiles({
    name: 'forma-cm.dxf',
    mimeType: 'application/dxf',
    buffer: Buffer.from(dxf),
  });
  await confirmMaskImport(page);
  const before = await save(page);
  await page.getByRole('tab', { name: 'Máscaras', exact: true }).click();
  await activate(page, before.masks[0].id);
  await start(page);
  await page.keyboard.press('Enter');
  await click(page, 800, 0);
  await page.keyboard.press('Escape');
  const after = await save(page),
    m = after.masks[0];
  expect(m.id).toBe(before.masks[0].id);
  expect(m.scale).toBe(10);
  expect(m.sourceUnit).toBe('cm');
  expect(m.format).toBe('DXF');
  expect(maskCurve(m, m.primitives[0]).total).toBeCloseTo(400, 8);
  expect(m.primitives[0].id).toBeTruthy();
  expect(m.primitives[0].sourceEntityId).toBeTruthy();
  expect(m.primitives.find((p) => p.text)).toEqual(
    before.masks[0].primitives.find((p) => p.text),
  );
  expect(after.bars).toEqual([]);
});

test('limite de outra máscara bloqueada permanece intacto; contexto e troca de projeto cancelam o comando', async ({
  page,
}) => {
  let p = maskCadFixture();
  p.masks[0].primitives = p.masks[0].primitives.slice(0, 1);
  const layer = {
    ...defaultLayers()[0],
    id: 'locked-reference',
    name: 'Referência bloqueada',
  };
  p = {
    ...p,
    layers: [...p.layers, layer],
    masks: [
      p.masks[0],
      {
        ...p.masks[1],
        layerId: layer.id,
        primitives: [
          {
            ...nativePrimitive(
              {
                kind: 'line',
                points: [
                  { x: 400, y: -300 },
                  { x: 400, y: 300 },
                ],
                closed: false,
              },
              'external-limit',
              'DESENHO',
            ),
            layerId: layer.id,
          },
        ],
      },
    ],
  };
  p = setLayerState(p, 'model', layer.id, { editable: false });
  await load(page, p);
  await activate(page);
  const before = await save(page);
  await start(page);
  await click(page, 400, 200);
  await page.keyboard.press('Enter');
  await click(page, 800, 0);
  await page.keyboard.press('Escape');
  const q = await save(page);
  expect(q.masks[1]).toEqual(before.masks[1]);
  expect(q.masks[0].primitives[0].points.at(-1)?.x).toBe(400);
  expect(q.bars).toEqual(before.bars);
  await start(page, 'extend');
  const other = emptyProject();
  await page.getByTestId('project-input').setInputFiles({
    name: 'novo.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(other)),
  });
  await expect(panel(page, 'extend')).toHaveCount(0);
  expect((await save(page)).id).toBe(other.id);
});

test('foco, janela estreita, escolha por ID e prévia sem commit conservam geometria', async ({
  page,
}) => {
  const p = maskCadFixture();
  await load(page, p);
  await activate(page);
  const before = await save(page);
  await page.setViewportSize({ width: 900, height: 650 });
  await page.getByRole('button', { name: 'Foco no CAD', exact: true }).click();
  await page
    .getByLabel('Ferramentas CAD da máscara ativa', { exact: true })
    .selectOption('trim');
  const d = panel(page);
  await d
    .getByLabel('Entidade limitadora', { exact: true })
    .selectOption(JSON.stringify(['target-mask', 'limit-a']));
  await d
    .getByRole('button', { name: 'Adicionar / retirar limite', exact: true })
    .click();
  await d
    .getByRole('button', { name: 'Confirmar limites · Enter', exact: true })
    .click();
  await d
    .getByRole('button', { name: 'Concluir Ajustar/Estender', exact: true })
    .scrollIntoViewIfNeeded();
  await d.evaluate((node) => {
    node.scrollTop = 0;
  });
  await page.screenshot({ path: 'docs/mask-cad-compact.png' });
  await page.keyboard.press('Escape');
  expect(await save(page)).toEqual(before);
});
