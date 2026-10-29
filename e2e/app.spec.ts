import { expect, openApp, test } from './fixtures';

test.describe('app shell', () => {
  test('loads the map, panel and current weather without console errors', async ({
    page,
    consoleErrors,
  }) => {
    await openApp(page);

    await expect(page.locator('.current-weather')).toBeVisible();
    await expect(page.locator('.current-weather.loading')).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Weather Radar' })).toBeAttached();
    await expect(page.locator('.error-boundary')).toHaveCount(0);

    expect(consoleErrors).toEqual([]);
  });

  test('theme toggle switches between light and dark', async ({ page }) => {
    await openApp(page);
    const container = page.locator('.weather-map-container');

    // FIXED_NOW is midday, so the automatic theme is light.
    await expect(container).not.toHaveClass(/\bdark\b/);
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await expect(container).toHaveClass(/\bdark\b/);
    await expect(page.locator('.maplibregl-canvas')).toBeVisible();

    await page.getByRole('button', { name: 'Switch to light mode' }).click();
    await expect(container).not.toHaveClass(/\bdark\b/);
  });
});

test.describe('alerts', () => {
  // The alerts popup sits on the map, on phones too (VTL-85)
  test('lists merged NOAA alerts and supports keyboard activation', async ({ page }) => {
    await openApp(page);

    await expect(page.getByRole('heading', { name: /Active Alerts \(\d+\)/ })).toBeVisible();
    const card = page.getByRole('button', {
      name: /^Show the area of Winter Weather Advisory/,
    });
    await expect(card).toBeVisible();

    await card.focus();
    await expect(card).toBeFocused();
    await page.keyboard.press('Enter');
    // Activating an alert fits the map to it; the app must stay healthy.
    await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  });

  test('shows the rest of the alerts on request', async ({ page }) => {
    await openApp(page);
    const statement = page.getByRole('button', {
      name: /^Show the area of Special Weather Statement/,
    });
    // The most severe alert shows first; the statement is one click away
    await expect(statement).toHaveCount(0);
    await page.getByRole('button', { name: '1 more alert' }).click();
    await statement.click();
    await expect(statement).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  });

  test('dismissing an alert removes it from the list', async ({ page }) => {
    await openApp(page);

    const heading = page.getByRole('heading', { name: /Active Alerts \(\d+\)/ });
    await expect(heading).toBeVisible();
    const count = Number(/\((\d+)\)/.exec((await heading.textContent()) ?? '')?.[1]);

    await page.getByRole('button', { name: 'Dismiss Winter Weather Advisory alert' }).click();
    await expect(
      page.getByRole('button', { name: /^Show the area of Winter Weather Advisory/ }),
    ).toHaveCount(0);
    if (count > 1) {
      await expect(
        page.getByRole('heading', { name: `Active Alerts (${count - 1})` }),
      ).toBeVisible();
    } else {
      await expect(page.getByRole('heading', { name: /Active Alerts/ })).toHaveCount(0);
    }
  });
});

test.describe('radar controls', () => {
  test('hides and shows the radar overlay and steps frames', async ({ page, isMobile }) => {
    await openApp(page);
    if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click();

    const hide = page.getByRole('button', { name: 'Hide radar overlay' });
    await expect(hide).toHaveAttribute('aria-pressed', 'true');
    await hide.click();
    await expect(page.getByRole('button', { name: 'Show radar overlay' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await page.getByRole('button', { name: 'Show radar overlay' }).click();

    const timeline = page.getByRole('slider', { name: 'Radar timeline' });
    await expect(timeline).toBeVisible();
    const before = await timeline.getAttribute('aria-valuenow');
    await page.getByRole('button', { name: 'Previous radar frame' }).click();
    await expect(timeline).not.toHaveAttribute('aria-valuenow', before ?? '');
  });
});

test.describe('map features', () => {
  test('weather station toggle adds and removes markers', async ({ page, isMobile }) => {
    await openApp(page);
    if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click();

    const chip = page.locator('button.filter-chip[data-chip-type="weather"]');
    const markers = page.locator('.weather-station-marker');
    const initiallyOn = (await chip.getAttribute('aria-pressed')) === 'true';
    if (!initiallyOn) await chip.click();

    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await expect(markers.first()).toBeAttached({ timeout: 15_000 });

    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
    await expect(markers).toHaveCount(0);
  });

  test('clicking a weather station opens the detail panel', async ({ page, isMobile }) => {
    await openApp(page);
    if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click();

    const chip = page.locator('button.filter-chip[data-chip-type="weather"]');
    if ((await chip.getAttribute('aria-pressed')) !== 'true') await chip.click();
    if (isMobile) await page.getByRole('button', { name: 'Close panel' }).click();

    const marker = page.locator('.weather-station-marker').first();
    await expect(marker).toBeAttached({ timeout: 15_000 });
    // Markers can sit under the panel at the default zoom; dispatch the click directly.
    await marker.dispatchEvent('click');

    const panel = page.locator('.detail-panel');
    await expect(panel).toHaveClass(/\bopen\b/);
    await page.getByRole('button', { name: 'Close detail panel' }).click();
    await expect(panel).not.toHaveClass(/\bopen\b/);
  });
});

test.describe('degraded backend', () => {
  test('the map and controls still work when the backend is unreachable', async ({
    page,
    backendDown,
    isMobile,
  }) => {
    await backendDown();
    await openApp(page);
    // Toggle the theme first: the open mobile menu's backdrop covers the toggle.
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await expect(page.locator('.weather-map-container')).toHaveClass(/\bdark\b/);
    if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click();

    // Radar comes straight from RainViewer, so it keeps working without the backend.
    await expect(page.getByRole('slider', { name: 'Radar timeline' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Active Alerts/ })).toHaveCount(0);
    await expect(page.locator('.error-boundary')).toHaveCount(0);
  });
});
