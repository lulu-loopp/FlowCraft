import { chromium } from '@playwright/test';

async function main() {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('about:blank');
    await context.close();
    await browser.close();
    console.log('Playwright browser launch check passed.');
  } catch (err) {
    if (browser) {
      try { await browser.close(); } catch {}
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error('Playwright browser launch check failed:', message);
    process.exit(1);
  }
}

main();

