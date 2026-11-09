import { test, type Page } from '@playwright/test';
export async function confirmProjectReplacement(page: Page) {
  const box = page
    .getByRole('dialog', { name: 'Novo projeto', exact: true })
    .getByRole('checkbox', {
      name: 'Confirmar substituição do projeto atual',
      exact: true,
    });
  if (await box.isVisible()) await box.check();
}

export function useCompatibleProjectFolders() {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() =>
      Object.defineProperty(window, 'showDirectoryPicker', {
        value: undefined,
        configurable: true,
      }),
    );
  });
}
