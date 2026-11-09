import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { emptyProject } from '../../src/domain/model';
import { createHierarchyNode } from '../../src/domain/hierarchy';
test.use({ hasTouch: true, viewport: { width: 1050, height: 700 } });
function seed() {
  let p = emptyProject();
  const f = createHierarchyNode(p, 'floor', 'Cobertura');
  p = f.project;
  const e = createHierarchyNode(p, 'element', 'V01', f.id);
  p = e.project;
  const low = createHierarchyNode(
    p,
    'element',
    'V01',
    p.hierarchy.floors[0].id,
  );
  p = low.project;
  return { p, f: f.id, e: e.id };
}
async function load(page: Page) {
  const s = seed();
  await page.goto('/');
  await expect(page.locator('.busy-overlay')).toHaveCount(0);
  await page.getByTestId('project-input').setInputFiles({
    name: 'tree.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(s.p)),
  });
  await page.getByRole('tab', { name: 'Projeto', exact: true }).click();
  return s;
}
async function save(page: Page) {
  const event = page.waitForEvent('download');
  await page
    .locator('.quick-tools')
    .getByRole('button', { name: 'Salvar projeto', exact: true })
    .click();
  return JSON.parse(readFileSync((await (await event).path())!, 'utf8'));
}
test('pai contextual, ramos recolhidos, filtro explícito, histórico e persistência preservam vínculos', async ({
  page,
}) => {
  const { p, f, e } = await load(page);
  await page
    .getByRole('button', { name: 'Recolher pavimento Cobertura', exact: true })
    .click();
  await page
    .getByRole('button', {
      name: 'Adicionar elemento em Cobertura',
      exact: true,
    })
    .tap();
  const group = page.getByLabel('Nome do grupo', { exact: true });
  await expect(group).toBeFocused();
  await expect(group).toHaveValue('');
  await expect(
    page.getByLabel('Pavimento do grupo', { exact: true }),
  ).toHaveValue(f);
  await group.fill('Pilares');
  await group.press('Enter');
  let a = await save(page);
  expect(
    a.hierarchy.elements.filter(
      (x: any) => x.name === 'Pilares' && x.floorId === f,
    ),
  ).toHaveLength(1);
  expect(a.hierarchy.details).toEqual(p.hierarchy.details);
  expect(a.bars).toEqual(p.bars);
  await page.getByLabel('Pesquisar no projeto', { exact: true }).fill('V01');
  await page
    .getByRole('button', {
      name: 'Adicionar detalhamento em Cobertura / V01',
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel('Grupo do detalhamento', { exact: true }),
  ).toHaveValue(e);
  const name = page.getByLabel('Nome do detalhamento', { exact: true });
  await expect(name).toHaveValue('');
  await name.fill('Armação cobertura');
  await page
    .getByRole('button', { name: 'Criar detalhamento', exact: true })
    .dblclick();
  a = await save(page);
  const ds = a.hierarchy.details.filter(
    (x: any) => x.name === 'Armação cobertura',
  );
  expect(ds).toHaveLength(1);
  expect(ds[0].elementId).toBe(e);
  expect(
    a.hierarchy.drawings.filter((x: any) => x.detailId === ds[0].id),
  ).toHaveLength(1);
  await expect(
    page.getByLabel('Detalhamento ativo', { exact: true }),
  ).toHaveValue(ds[0].id);
  await expect(
    page.getByLabel('Pesquisar no projeto', { exact: true }),
  ).toHaveValue('V01');
  await page
    .getByRole('button', { name: 'Revelar item criado', exact: true })
    .click();
  await expect(
    page.getByLabel('Pesquisar no projeto', { exact: true }),
  ).toHaveValue('');
  await expect(
    page.locator(`#hierarchy-${ds[0].id} .hierarchy-name`),
  ).toBeFocused();
  await page.screenshot({
    path: 'docs/contextual-tree-created.png',
    fullPage: true,
  });
  await page
    .locator('.quick-tools')
    .getByRole('button', { name: 'Desfazer', exact: true })
    .click();
  expect((await save(page)).hierarchy.details).toEqual(p.hierarchy.details);
  await page
    .locator('.quick-tools')
    .getByRole('button', { name: 'Refazer', exact: true })
    .click();
  expect(await save(page)).toEqual(a);
  await page.getByTestId('project-input').setInputFiles({
    name: 'roundtrip.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(a)),
  });
  expect(await save(page)).toEqual(a);
});
test('rascunho, troca de ação, Esc, erro e contexto inválido não criam resíduos', async ({
  page,
}) => {
  const { p } = await load(page);
  await page
    .getByRole('button', {
      name: 'Adicionar elemento em Cobertura',
      exact: true,
    })
    .click();
  await page.getByLabel('Nome do grupo', { exact: true }).fill('Rascunho');
  page.once('dialog', (d) => d.dismiss());
  await page
    .getByRole('button', { name: 'Adicionar pavimento', exact: true })
    .click();
  await expect(page.getByLabel('Nome do grupo', { exact: true })).toHaveValue(
    'Rascunho',
  );
  await page.getByLabel('Nome do grupo', { exact: true }).press('Escape');
  expect(await save(page)).toEqual(p);
  await page
    .getByRole('button', { name: 'Adicionar pavimento', exact: true })
    .click();
  await page
    .getByLabel('Nome do pavimento', { exact: true })
    .fill('Temporário');
  await page
    .getByRole('button', { name: 'Criar pavimento', exact: true })
    .click();
  await page
    .getByRole('button', {
      name: 'Adicionar elemento em Cobertura',
      exact: true,
    })
    .click();
  await page.getByLabel('Nome do grupo', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Criar grupo', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('1 a 100');
  await expect(page.getByLabel('Nome do grupo', { exact: true })).toHaveValue(
    '   ',
  );
  await page.getByLabel('Nome do grupo', { exact: true }).fill('Pendente');
  await page
    .locator('.quick-tools')
    .getByRole('button', { name: 'Desfazer', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Criar grupo', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('alert').filter({ hasText: 'projeto mudou' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Cancelar edição', exact: true })
    .click();
  await page.screenshot({
    path: 'docs/contextual-tree-cancel.png',
    fullPage: true,
  });
});
