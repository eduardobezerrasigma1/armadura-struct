import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { performanceScene } from '../performanceScene';
import type { Project } from '../../src/domain/types';

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

test('navegação não regenera descrições; edição, histórico e troca de projeto invalidam os caches', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const counters = { formats: 0, moves: 0, writes: 0, roleScans: 0 };
    Object.assign(window, { cadWork: counters });
    const some = Array.prototype.some;
    Array.prototype.some = function (...args) {
      if (this.length === 400 && this[0]?.id === 'performance:bar:0')
        counters.roleScans++;
      return some.apply(this, args);
    };
    const locale = Number.prototype.toLocaleString;
    Number.prototype.toLocaleString = function (...args) {
      counters.formats++;
      return locale.apply(this, args);
    };
    const getter = Object.getOwnPropertyDescriptor(
      Intl.NumberFormat.prototype,
      'format',
    )!.get!;
    Object.defineProperty(Intl.NumberFormat.prototype, 'format', {
      configurable: true,
      get() {
        const bound = getter.call(this);
        return (...args: unknown[]) => {
          counters.formats++;
          return bound(...args);
        };
      },
    });
    window.addEventListener(
      'pointermove',
      (e) => {
        if ((e.target as Element)?.closest('[data-testid="cad-canvas"]'))
          counters.moves++;
      },
      true,
    );
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      counters.writes++;
      return put.apply(this, args);
    };
  });
  await page.goto('/');
  await expect(page.locator('.busy-overlay')).toHaveCount(0);
  await page.getByTestId('project-input').setInputFiles({
    name: 'performance.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(performanceScene())),
  });
  await expect(page.locator('[data-bar-id]')).toHaveCount(400);
  await expect(page.locator('[data-representation-id]')).toHaveCount(400);
  await expect(page.locator('.save-status')).toHaveText(
    'Apenas recuperável localmente',
  );
  const before = await save(page);
  const undo = page
    .locator('.quick-tools')
    .getByRole('button', { name: 'Desfazer', exact: true });
  const wasDisabled = await undo.isDisabled();
  const canvas = page.getByTestId('cad-canvas'),
    box = (await canvas.boundingBox())!;
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  const reset = () =>
    page.evaluate(() =>
      Object.assign((window as unknown as { cadWork: object }).cadWork, {
        formats: 0,
        moves: 0,
        writes: 0,
        roleScans: 0,
      }),
    );
  const work = () =>
    page.evaluate(
      () =>
        (
          window as unknown as {
            cadWork: {
              formats: number;
              moves: number;
              writes: number;
              roleScans: number;
            };
          }
        ).cadWork,
    );
  await reset();
  for (let i = 0; i < 20; i++) await page.mouse.move(x + i * 4, y + i * 3);
  let counts = await work();
  expect(counts.moves).toBeGreaterThan(10);
  // Two coordinates and the grid-step readout, not 800 object captions.
  expect(counts.formats).toBeLessThanOrEqual(counts.moves * 3 + 12);
  expect(counts.writes).toBe(0);
  await reset();
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(x - 100, y + 40, { steps: 12 });
  await page.mouse.up({ button: 'middle' });
  for (let i = 0; i < 8; i++) await page.mouse.wheel(0, i % 2 ? 50 : -50);
  counts = await work();
  expect(counts.formats).toBeLessThanOrEqual(counts.moves * 3 + 12);
  expect(counts.writes).toBe(0);
  expect(await undo.isDisabled()).toBe(wasDisabled);
  expect(await save(page)).toEqual(before);
  await page.getByRole('tab', { name: 'Projeto', exact: true }).click();
  await page
    .locator('.bar-row')
    .filter({ has: page.getByText('N2', { exact: true }) })
    .click();
  await reset();
  await page.getByLabel('Quantidade', { exact: true }).fill('5');
  await page.getByLabel('Quantidade', { exact: true }).press('Tab');
  await expect(
    page.locator('[data-bar-id="performance:bar:1"] text').first(),
  ).toContainText('5 x');
  await expect(
    page
      .locator('[data-representation-id="performance:representation:1"] text')
      .first(),
  ).toContainText('5 x');
  // Resolve one mask permission, rather than 20,000 complete object scans.
  expect((await work()).roleScans).toBeLessThan(10000);
  const edited = await save(page);
  expect(edited.bars[1].quantity).toBe(5);
  await undo.click();
  await expect(
    page
      .locator('[data-representation-id="performance:representation:1"] text')
      .first(),
  ).toContainText('4 x');
  expect(await save(page)).toEqual(before);
  await page
    .locator('.quick-tools')
    .getByRole('button', { name: 'Refazer', exact: true })
    .click();
  expect(await save(page)).toEqual(edited);
  await page.getByTestId('project-input').setInputFiles({
    name: 'other.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        ...before,
        id: 'performance:other',
        bars: before.bars.map((b, i) => (i === 1 ? { ...b, quantity: 7 } : b)),
      }),
    ),
  });
  await expect(
    page.locator('[data-bar-id="performance:bar:1"] text').first(),
  ).toContainText('7 x');
  await expect(
    page
      .locator('[data-representation-id="performance:representation:1"] text')
      .first(),
  ).toContainText('7 x');
  expect(errors).toEqual([]);
});
