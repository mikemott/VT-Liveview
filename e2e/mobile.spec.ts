import { expect, openApp, test } from './fixtures';

test.describe('mobile layout', () => {
  test.skip(({ isMobile }) => !isMobile, 'mobile viewport only');

  test('controls panel is hidden until the menu is opened', async ({ page }) => {
    await openApp(page);
    const panel = page.locator('.controls-panel');
    const toggle = page.getByRole('button', { name: 'Open menu' });

    await expect(panel).toHaveClass(/\bhidden\b/);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await toggle.click();
    await expect(panel).not.toHaveClass(/\bhidden\b/);
    await expect(page.getByRole('button', { name: 'Close menu' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    await page.getByRole('button', { name: 'Close panel' }).click();
    await expect(panel).toHaveClass(/\bhidden\b/);
  });

  test('tapping the backdrop closes the menu', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Open menu' }).click();
    const backdrop = page.locator('.mobile-backdrop');
    await expect(backdrop).toBeVisible();

    // Tap the right edge, outside the panel.
    const box = await backdrop.boundingBox();
    if (!box) throw new Error('backdrop has no bounding box');
    await page.mouse.click(box.x + box.width - 5, box.y + box.height / 2);
    await expect(page.locator('.controls-panel')).toHaveClass(/\bhidden\b/);
  });
});
