import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, openApp, test } from './fixtures';

/**
 * axe-core scan of the loaded app. Serious and critical WCAG 2.1 A/AA
 * violations fail the test. A known violation may only be listed in KNOWN with
 * the docs/review/FINDINGS.md id that tracks its fix; remove the entry when fixed.
 */
const KNOWN: Record<string, string> = {
  // 'rule-id': 'FINDINGS id',
};

async function scan(page: Page, label: string): Promise<void> {
  // Let async layers (alerts, stations, current weather) settle first.
  await expect(page.locator('.current-weather.loading')).toHaveCount(0, { timeout: 15_000 });

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // The WebGL canvas has no DOM content to audit.
    .exclude('.maplibregl-canvas')
    .analyze();

  await test.info().attach(`axe-${label}.json`, {
    body: JSON.stringify(results.violations, null, 2),
    contentType: 'application/json',
  });

  const blocking = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .filter((v) => !(v.id in KNOWN))
    .map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')),
    }));

  expect(blocking, `serious/critical axe violations (${label})`).toEqual([]);
}

test.describe('accessibility (axe)', () => {
  test('light theme', async ({ page, isMobile }) => {
    await openApp(page);
    if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click();
    await scan(page, 'light');
  });

  test('dark theme', async ({ page, isMobile }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click();
    await scan(page, 'dark');
  });
});
