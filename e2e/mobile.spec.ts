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

  test('open panel fits the screen above the bottom controls', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Open menu' }).click();
    const panel = await page.locator('.controls-panel').boundingBox();
    const search = await page.getByRole('combobox', { name: 'Search places' }).boundingBox();
    const viewport = page.viewportSize();
    if (!panel || !search || !viewport) throw new Error('no bounding box');

    expect(panel.y).toBeGreaterThanOrEqual(0);
    expect(panel.x + panel.width).toBeLessThan(viewport.width);
    expect(panel.y + panel.height).toBeLessThan(search.y);
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

  test('search floats at the bottom center (VTL-93)', async ({ page }) => {
    await openApp(page);
    const search = page.getByRole('combobox', { name: 'Search places' });
    await expect(search).toBeVisible();

    const box = await search.boundingBox();
    const viewport = page.viewportSize();
    if (!box || !viewport) throw new Error('no bounding box');
    // Centered, except on the narrowest phones (<360px), which trade centering for width
    const offCenter = Math.abs(box.x + box.width / 2 - viewport.width / 2);
    expect(offCenter).toBeLessThan(viewport.width < 360 ? 20 : 2);
    expect(box.y).toBeGreaterThan(viewport.height / 2);
  });

  test('layer chips sit in one row above the search bar (VTL-93)', async ({ page }) => {
    await openApp(page);
    const strip = page.getByRole('toolbar', { name: 'Map layers' });
    await expect(strip).toBeVisible();

    const stripBox = await strip.boundingBox();
    const searchBox = await page.getByRole('combobox', { name: 'Search places' }).boundingBox();
    if (!stripBox || !searchBox) throw new Error('no bounding box');
    expect(stripBox.height).toBeLessThan(48);
    expect(stripBox.y + stripBox.height).toBeLessThanOrEqual(searchBox.y);

    // Scrolls sideways rather than wrapping
    const overflows = await strip.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(overflows).toBe(true);

    // A strip chip toggles the same layer as the panel chip
    const stripChip = strip.locator('button.filter-chip[data-chip-type="cameras"]');
    const panelChip = page.locator('.controls-panel button.filter-chip[data-chip-type="cameras"]');
    const before = await stripChip.getAttribute('aria-pressed');
    await stripChip.click();
    const after = before === 'true' ? 'false' : 'true';
    await expect(stripChip).toHaveAttribute('aria-pressed', after);
    await expect(panelChip).toHaveAttribute('aria-pressed', after);
  });
});
