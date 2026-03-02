import { expect, test, type Page } from '@playwright/test';
import { launchTestApp } from './utils';

test.setTimeout(90_000);

const dragBy = async (page: Page, start: { x: number; y: number }, delta: { x: number; y: number }) => {
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + delta.x, start.y + delta.y, { steps: 6 });
  await page.mouse.up();
};

test('panel lifecycle and basic interactions', async () => {
  const { page, cleanup } = await launchTestApp({ startInWorkspace: true });
  page.setDefaultTimeout(10_000);

  try {
    await expect(page.getByTestId('workspace-canvas')).toBeVisible();

    await test.step('terminal panel opens, moves, and closes', async () => {
      await page.getByTestId('action-create-terminal').click();
      const terminal = page.getByTestId('entity-terminal').first();
      await expect(terminal).toBeVisible();

      const header = terminal.locator('.panel-titlebar');
      const headerBox = await header.boundingBox();
      if (!headerBox) throw new Error('Missing terminal header');
      const start = { x: headerBox.x + headerBox.width / 2, y: headerBox.y + headerBox.height / 2 };
      await dragBy(page, start, { x: 24, y: 24 });

      await terminal.locator('.close-btn').first().click();
      await expect(page.getByTestId('entity-terminal')).toHaveCount(0);
    });

    await test.step('browser panel opens, moves, and closes', async () => {
      await page.getByTestId('action-create-browser').click();
      const browser = page.getByTestId('entity-browser').first();
      await expect(browser).toBeVisible();

      const headerBox = await browser.boundingBox();
      if (!headerBox) throw new Error('Missing browser bounds');
      const start = { x: headerBox.x + headerBox.width / 2, y: headerBox.y + 16 };
      await dragBy(page, start, { x: 24, y: 24 });

      await browser.locator('button[title="Close"]').first().click();
      await expect(page.getByTestId('entity-browser')).toHaveCount(0);
    });
  } finally {
    await cleanup();
  }
});
