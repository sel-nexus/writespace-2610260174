/** Capture representative UI evidence against an already-running Vite server.
 * Run from frontend: node visual-preflight.js [baseURL] [outputDirectory]
 * The browser context is isolated; the script does not run the E2E suite.
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const baseURL = process.argv[2] || 'http://127.0.0.1:4173';
const output = process.argv[3] || `visual-preflight-${Date.now()}`;
// Fail instead of overwriting prior evidence when an output directory exists.
await mkdir(output);

async function capture(page, name) {
  await page.screenshot({ path: join(output, `${name}.png`), fullPage: true });
  let accessibility;
  try {
    if (page.accessibility?.snapshot) {
      accessibility = JSON.stringify(await page.accessibility.snapshot(), null, 2);
    } else {
      accessibility = await page.locator('body').ariaSnapshot();
    }
  } catch (error) {
    accessibility = `Accessibility snapshot unavailable: ${error.message}\n` + JSON.stringify(await page.locator('body').evaluate((body) =>
      [...body.querySelectorAll('h1,h2,h3,a,button,input,textarea,select,[role]')].map((el) => ({
        tag: el.tagName, role: el.getAttribute('role'), label: el.getAttribute('aria-label'), text: (el.innerText || '').trim(),
      }))), null, 2);
  }
  const styles = await page.evaluate(() => [...document.querySelectorAll('body,header,nav,main,h1,h2,article,form,input,textarea,button,a')].map((el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { tag: el.tagName, text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 100),
      display: s.display, color: s.color, background: s.backgroundColor, font: s.font,
      lineHeight: s.lineHeight, padding: s.padding, margin: s.margin, rect: { x: r.x, y: r.y, width: r.width, height: r.height } };
  }));
  await writeFile(join(output, `${name}.txt`), `URL: ${page.url()}\n\nACCESSIBILITY\n${accessibility}\n\nCOMPUTED STYLES\n${JSON.stringify(styles, null, 2)}\n\nHTML\n${await page.content()}\n`);
}

const browser = await chromium.launch({ channel: 'chromium' });
try {
  for (const [name, viewport] of [['desktop', { width: 1280, height: 800 }], ['mobile', { width: 375, height: 812 }]]) {
    const context = await browser.newContext({ baseURL, viewport });
    try {
      const page = await context.newPage();
      await page.goto('/');
      await capture(page, `${name}-landing`);
      await page.getByRole('link', { name: 'Login', exact: true }).first().click();
      await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
      await capture(page, `${name}-login`);
      await page.getByLabel('Username').fill('admin');
      await page.getByLabel('Password').fill('admin');
      await page.getByRole('button', { name: 'Login' }).click();
      await page.getByRole('heading', { name: 'Admin Dashboard' }).waitFor();
      await capture(page, `${name}-admin-empty`);
      await page.getByRole('link', { name: 'Write New Post' }).click();
      await page.getByLabel('Title').fill('A local story');
      await page.getByLabel('Content').fill('A representative post for visual review.');
      await page.getByRole('button', { name: 'Save' }).click();
      await page.getByRole('heading', { name: 'A local story' }).waitFor();
      await capture(page, `${name}-reader`);
      await page.getByRole('link', { name: 'Back to All Posts' }).click();
      await page.getByRole('link', { name: 'A local story', exact: true }).waitFor();
      await capture(page, `${name}-blogs`);
      if (name === 'mobile') {
        await page.getByRole('button', { name: 'Menu' }).click();
        await capture(page, `${name}-navigation-open`);
      }
      await page.getByRole('link', { name: 'Users', exact: true }).click();
      await page.getByRole('heading', { name: 'User Management' }).waitFor();
      await capture(page, `${name}-users`);
      await page.getByRole('link', { name: 'WriteSpace', exact: true }).click();
      await page.getByRole('link', { name: 'Go to Dashboard' }).click();
      await page.getByRole('link', { name: 'A local story', exact: true }).waitFor();
      await capture(page, `${name}-admin-populated`);
    } finally {
      await context.close();
    }
  }
  console.log(`Visual evidence written to ${output}`);
} finally {
  await browser.close();
}
