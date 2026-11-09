import { confirmMaskImport } from './maskBatch.helpers';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  createDetailPackage,
  type DetailPackage,
} from '../../src/domain/detailPackage';
import { emptyProject, newBar, schedule } from '../../src/domain/model';
import {
  completeOwnership,
  createHierarchyNode,
} from '../../src/domain/hierarchy';
import type { Project } from '../../src/domain/types';

async function load(page: Page, p: Project) {
  await page.goto('/');
  await expect(page.locator('.busy-overlay')).toHaveCount(0);
  await page.getByTestId('project-input').setInputFiles({
    name: 'project.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(p)),
  });
}
async function closeToast(page: Page) {
  const close = page.getByRole('button', { name: 'Fechar aviso', exact: true });
  if (await close.isVisible()) await close.click();
}
async function save(page: Page): Promise<Project> {
  await closeToast(page);
  const event = page.waitForEvent('download');
  await page
    .locator('.quick-tools')
    .getByRole('button', { name: 'Salvar projeto', exact: true })
    .click();
  return JSON.parse(readFileSync((await (await event).path())!, 'utf8'));
}
async function openPackage(page: Page, pack: DetailPackage) {
  await closeToast(page);
  await page.getByRole('tab', { name: 'Elementos', exact: true }).click();
  const event = page.waitForEvent('filechooser');
  await page
    .getByRole('button', { name: 'Inserir detalhamento', exact: true })
    .click();
  await (
    await event
  ).setFiles({
    name: 'detail.osdetail.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(pack)),
  });
  const dialog = page.getByRole('dialog', {
    name: 'Comparar detalhamentos',
    exact: true,
  });
  await expect(dialog).toBeVisible();
  return dialog;
}
const producer = { app: 'ConsoloStruct · exemplo', version: '1.0.0' };

test('native export/import preserves geometry and links, remaps collisions and proposes updating the same package origin', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let source = completeOwnership({
    ...emptyProject(),
    bars: [{ ...newBar('N1'), id: 'native-bar', quantity: 4, diameter: 10 }],
    details: [
      { id: 'native-rep', barId: 'native-bar', origin: { x: 0, y: -300 } },
    ],
    annotations: [
      {
        id: 'native-call',
        kind: 'leader',
        barId: 'native-bar',
        points: [
          { x: 500, y: 0 },
          { x: 600, y: 200 },
          { x: 800, y: 200 },
        ],
        label: '',
        textHeight: 40,
        color: '#777777',
      },
    ],
  });
  await load(page, source);
  await closeToast(page);
  await page.getByRole('tab', { name: 'Elementos', exact: true }).click();
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Pacote de detalhamento', exact: true })
    .click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.osdetail\.json$/);
  const pack = JSON.parse(
    readFileSync((await file.path())!, 'utf8'),
  ) as DetailPackage;
  expect(pack.schema).toBe('openstruct.detail/15');
  expect(pack.objects.bars).toEqual(source.bars);
  const target = completeOwnership({
    ...emptyProject(),
    bars: [{ ...newBar('N1'), id: 'native-bar', quantity: 1 }],
  });
  await load(page, target);
  let dialog = await openPackage(page, pack);
  await expect(dialog.getByLabel('Operação do detalhamento')).toHaveValue(
    'insert',
  );
  await dialog
    .getByRole('button', { name: 'Aplicar detalhamento', exact: true })
    .click();
  let saved = await save(page);
  const imported = saved.bars.find((b) => b.quantity === 4)!;
  expect(imported.id).not.toBe('native-bar');
  expect(imported.mark).not.toBe('N1');
  expect(saved.details[0].barId).toBe(imported.id);
  expect(saved.annotations[0].barId).toBe(imported.id);
  expect(
    schedule(saved).find((r) => r.bar.id === imported.id)?.unitLength,
  ).toBe(1);
  const inserted = saved.hierarchy.details.find(
    (d) => d.source?.origin.projectId === source.id,
  )!;
  source.bars[0].quantity = 9;
  const revision = createDetailPackage(source, source.hierarchy.details[0].id, {
    unit: 'cm',
    producer,
  });
  dialog = await openPackage(page, revision);
  await expect(dialog.getByLabel('Operação do detalhamento')).toHaveValue(
    'replace',
  );
  await expect(dialog.getByLabel('Detalhamento de destino')).toHaveValue(
    inserted.id,
  );
  await expect(dialog).toContainText('atualização proposta');
  await dialog
    .getByRole('button', { name: 'Aplicar detalhamento', exact: true })
    .click();
  saved = await save(page);
  expect(saved.bars).toHaveLength(2);
  expect(saved.bars.find((b) => b.id === imported.id)?.quantity).toBe(9);
  await page
    .locator('.quick-tools')
    .getByRole('button', { name: 'Desfazer', exact: true })
    .click();
  expect(
    (await save(page)).bars.find((b) => b.id === imported.id)?.quantity,
  ).toBe(4);
  await page
    .locator('.quick-tools')
    .getByRole('button', { name: 'Refazer', exact: true })
    .click();
  await load(page, await save(page));
  expect(
    (await save(page)).bars.find((b) => b.id === imported.id)?.quantity,
  ).toBe(9);
  expect(errors).toEqual([]);
});

test('ordinary DXF creates no steel; assisted selection requires explicit properties, preserves references and supports cancel/undo/reopen', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await load(page, emptyProject());
  await page
    .getByTestId('mask-input')
    .setInputFiles('tests/fixtures/openstruct-assisted.dxf');
  await confirmMaskImport(page);
  await expect(page.locator('.mask-heading')).toContainText(
    'openstruct-assisted.dxf',
  );
  const baseline = await save(page);
  expect(baseline.bars).toEqual([]);
  expect(baseline.masks[0].primitives).toHaveLength(3);
  await page.getByRole('tab', { name: 'Armaduras', exact: true }).click();
  await page
    .getByRole('button', { name: 'Interpretar CAD em armadura', exact: true })
    .click();
  let dialog = page.getByRole('dialog', {
    name: 'Interpretar referência CAD',
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Criar posição física', exact: true }),
  ).toBeDisabled();
  await dialog.getByLabel('Contorno CAD', { exact: true }).selectOption('0');
  await dialog
    .getByLabel('Texto CAD para chamada', { exact: true })
    .selectOption('2');
  await dialog.getByLabel('Bitola CAD', { exact: true }).fill('10');
  await dialog.getByLabel('Quantidade CAD', { exact: true }).fill('4');
  await dialog
    .getByLabel('Categoria de aço CAD', { exact: true })
    .selectOption('CA-50');
  await dialog.getByLabel('Diâmetro de dobra CAD', { exact: true }).fill('50');
  await expect(
    dialog.getByRole('button', { name: 'Criar posição física', exact: true }),
  ).toBeDisabled();
  await dialog.getByLabel('Confirmar interpretação física CAD').check();
  await expect(
    dialog.getByRole('button', { name: 'Criar posição física', exact: true }),
  ).toBeEnabled();
  await dialog.screenshot({ path: 'docs/cad-assisted.png' });
  await page.keyboard.press('Escape');
  expect(await save(page)).toEqual(baseline);
  await closeToast(page);
  await page
    .getByRole('button', { name: 'Interpretar CAD em armadura', exact: true })
    .click();
  dialog = page.getByRole('dialog', {
    name: 'Interpretar referência CAD',
    exact: true,
  });
  await dialog.getByLabel('Contorno CAD', { exact: true }).selectOption('0');
  await dialog
    .getByLabel('Texto CAD para chamada', { exact: true })
    .selectOption('2');
  await dialog.getByLabel('Bitola CAD', { exact: true }).fill('10');
  await dialog.getByLabel('Quantidade CAD', { exact: true }).fill('4');
  await dialog
    .getByLabel('Categoria de aço CAD', { exact: true })
    .selectOption('CA-50');
  await dialog.getByLabel('Diâmetro de dobra CAD', { exact: true }).fill('50');
  await dialog.getByLabel('Confirmar interpretação física CAD').check();
  await dialog
    .getByRole('button', { name: 'Criar posição física', exact: true })
    .click();
  let p = await save(page);
  expect(p.bars).toHaveLength(1);
  expect(p.bars[0].quantity).toBe(4);
  expect(schedule(p)[0].unitLength).toBe(1);
  expect(p.masks).toEqual(baseline.masks);
  expect(p.annotations[0].barId).toBe(p.bars[0].id);
  expect(p.annotations[0].label).toBe('4 N1 Ø10');
  await page
    .locator('.quick-tools')
    .getByRole('button', { name: 'Desfazer', exact: true })
    .click();
  expect(await save(page)).toEqual(baseline);
  await page
    .locator('.quick-tools')
    .getByRole('button', { name: 'Refazer', exact: true })
    .click();
  p = await save(page);
  await load(page, p);
  expect(await save(page)).toEqual(p);
  expect(errors).toEqual([]);
});

test('package containing only calls to an external position asks for dependency resolution and imports steel once', async ({
  page,
}) => {
  let p = completeOwnership({
    ...emptyProject(),
    bars: [{ ...newBar('N1'), id: 'external', quantity: 5 }],
    details: [{ id: 'rep', barId: 'external', origin: { x: 0, y: -300 } }],
    annotations: [
      {
        id: 'call',
        kind: 'leader',
        barId: 'external',
        points: [
          { x: 0, y: 0 },
          { x: 0, y: 200 },
          { x: 100, y: 200 },
        ],
        label: '',
        textHeight: 40,
        color: '#777777',
      },
    ],
  });
  const main = p.hierarchy.details[0].id;
  p = createHierarchyNode(
    p,
    'detail',
    'Posição externa',
    p.hierarchy.elements[0].id,
  ).project;
  p.hierarchy.objectDetails.external = p.hierarchy.details[1].id;
  const pack = createDetailPackage(p, main, { producer });
  await load(page, emptyProject());
  const before = await save(page);
  const dialog = await openPackage(page, pack);
  await expect(
    dialog.getByLabel('Detalhamento de origem').locator('option'),
  ).toHaveCount(1);
  await expect(
    dialog.getByRole('button', { name: 'Aplicar detalhamento', exact: true }),
  ).toBeDisabled();
  await dialog
    .getByLabel('Resolver vínculo incoming:call', { exact: true })
    .selectOption('import:external');
  await expect(
    dialog.getByRole('button', { name: 'Aplicar detalhamento', exact: true }),
  ).toBeEnabled();
  await dialog
    .getByRole('button', { name: 'Aplicar detalhamento', exact: true })
    .click();
  const after = await save(page);
  expect(after.bars).toHaveLength(1);
  expect(after.bars[0].quantity).toBe(5);
  expect(after.details[0].barId).toBe(after.bars[0].id);
  expect(after.annotations[0].barId).toBe(after.bars[0].id);
  expect(after.hierarchy.details).toHaveLength(
    before.hierarchy.details.length + 1,
  );
});
