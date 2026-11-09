import { expect, type Page } from '@playwright/test';
export async function configureStirrupSection(
  page: Page,
  width = 300,
  height = 500,
) {
  const cmd = page.getByRole('textbox', { name: 'Comando CAD' });
  await cmd.fill('E');
  await cmd.press('Enter');
  const dialog = page.getByRole('dialog', {
    name: 'Critérios do estribo',
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await dialog
    .getByLabel('Base da seção (mm)', { exact: true })
    .fill(String(width));
  await dialog
    .getByLabel('Altura da seção (mm)', { exact: true })
    .fill(String(height));
  await dialog
    .getByRole('button', { name: 'Distribuição', exact: true })
    .click();
  await dialog
    .getByLabel('Modo de lançamento do estribo')
    .selectOption('section');
  await dialog.getByRole('button', { name: 'Usar critérios e lançar' }).click();
}
