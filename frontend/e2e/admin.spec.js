import { test, expect } from '@playwright/test';

const checked = test.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', (error) => errors.push(error.message));
    await use(page);
    expect(errors).toEqual([]);
  },
});

checked('admin creates accounts, preserves posts on deletion, and manages recent posts', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.getByRole('link', { name: 'Login', exact: true }).first().click();
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password').fill('admin');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText('Total Users', { exact: true }).locator('..')).toContainText('1');
  await page.getByRole('link', { name: 'Write New Post' }).click();
  await page.getByLabel('Title').fill('Admin story');
  await page.getByLabel('Content').fill('Kept body');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await page.getByRole('link', { name: 'Go to Dashboard' }).click();
  await expect(page.getByRole('link', { name: 'Admin story', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Manage Users' }).click();
  await expect(page.getByRole('button', { name: 'Delete admin' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Delete admin' })).toHaveAttribute('title', 'Default admin cannot be deleted.');
  await page.getByLabel('Display Name').fill('Lee');
  await page.getByLabel('Username').fill('lee');
  await page.getByLabel('Password').fill('demo');
  await page.getByRole('button', { name: 'Create User' }).click();
  await expect(page.getByText('@lee')).toBeVisible();
  await page.reload();
  await expect(page.getByText('@lee')).toBeVisible();
  await page.getByLabel('Display Name').fill('Pat');
  await page.getByLabel('Username').fill('pat');
  await page.getByLabel('Password').fill('demo');
  await page.getByLabel('Role').selectOption('admin');
  await page.getByRole('button', { name: 'Create User' }).click();
  await expect(page.getByText('@pat')).toBeVisible();
  await page.getByRole('button', { name: /Admin/ }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
  await page.getByRole('link', { name: 'Login', exact: true }).first().click();
  await page.getByLabel('Username').fill('lee');
  await page.getByLabel('Password').fill('demo');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByRole('link', { name: 'Write', exact: true }).click();
  await page.getByLabel('Title').fill('Lee story');
  await page.getByLabel('Content').fill('Lee body');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: /Lee/ }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
  await page.getByRole('link', { name: 'Login', exact: true }).first().click();
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password').fill('admin');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByRole('link', { name: 'Users', exact: true }).click();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete lee' }).click();
  await expect(page.getByText('@lee')).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete lee' }).click();
  await expect(page.getByText('@lee')).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('posts remain');
  await page.getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await page.getByRole('link', { name: 'Go to Dashboard' }).click();
  await expect(page.getByRole('link', { name: 'Admin story', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Lee story', exact: true })).toBeVisible();
  await expect(page.getByText('Total Users', { exact: true }).locator('..')).toContainText('2');
  await expect(page.getByText('Total Admins', { exact: true }).locator('..')).toContainText('2');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete Admin story' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('link', { name: 'Lee story', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Lee story', exact: true })).toBeVisible();
});

checked('guest cannot open user management directly', async ({ page }) => {
  await page.goto('/users');
  await expect(page).toHaveURL(/\/login$/);
});

checked('regular user cannot open user management directly', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('writespace_session', JSON.stringify({ userId: 'u1', username: 'writer', displayName: 'Writer', role: 'user' })));
  await page.goto('/users');
  await expect(page).toHaveURL(/\/blogs$/);
});

for (const width of [375, 768, 1280]) {
  checked(`populated account management layout and keyboard focus at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    await page.getByRole('link', { name: 'Login', exact: true }).first().click();
    await page.getByLabel('Username').fill('admin');
    await page.getByLabel('Password').fill('admin');
    await page.getByRole('button', { name: 'Login' }).click();
    await page.getByRole('link', { name: 'Manage Users' }).click();
    for (const [name, username] of [['Lee Writer', 'lee'], ['Pat Editor', 'pat']]) {
      await page.getByLabel('Display Name').fill(name);
      await page.getByLabel('Username').fill(username);
      await page.getByLabel('Password').fill('demo');
      await page.getByRole('button', { name: 'Create User' }).click();
      await expect(page.getByText(`@${username}`)).toBeVisible();
    }
    await page.reload();
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(3);
    await expect(page.getByText('@admin')).toBeVisible();
    await expect(page.getByText('@lee')).toBeVisible();
    await expect(page.getByText('@pat')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete admin' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Delete lee' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Delete pat' })).toBeEnabled();

    const layout = await page.evaluate(() => {
      const rect = (element) => {
        const { left, right, top, bottom } = element.getBoundingClientRect();
        return { left, right, top, bottom };
      };
      const rows = [...document.querySelectorAll('tbody tr')];
      return {
        viewport: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        rowDisplay: getComputedStyle(rows[0]).display,
        cellDisplay: getComputedStyle(rows[0].querySelector('td')).display,
        rows: rows.map(rect),
        controls: [...document.querySelectorAll('main input, main select, main button')].map(rect),
        form: rect(document.querySelector('main form')),
      };
    });
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewport);
    expect(layout.rowDisplay).toBe(width < 768 ? 'block' : 'table-row');
    expect(layout.cellDisplay).toBe(width < 768 ? 'block' : 'table-cell');
    for (const box of [...layout.rows, ...layout.controls]) {
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(layout.viewport);
      expect(box.right).toBeGreaterThan(box.left);
      expect(box.bottom).toBeGreaterThan(box.top);
    }
    expect(layout.rows[0].top).toBeGreaterThanOrEqual(layout.form.bottom);
    expect(layout.rows[1].top).toBeGreaterThanOrEqual(layout.rows[0].bottom);
    expect(layout.rows[2].top).toBeGreaterThanOrEqual(layout.rows[1].bottom);

    // Tab from the role selector exercises the keyboard-only focus-visible styles.
    await page.getByLabel('Role').focus();
    await page.keyboard.press('Tab');
    const create = page.getByRole('button', { name: 'Create User' });
    await expect(create).toBeFocused();
    const focus = await create.evaluate((element) => {
      const style = getComputedStyle(element);
      return { visible: element.matches(':focus-visible'), style: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor };
    });
    expect(focus.visible).toBe(true);
    expect(focus.style).not.toBe('none');
    expect(parseFloat(focus.width)).toBeGreaterThanOrEqual(2);
    expect(focus.color).not.toBe('transparent');
    expect(focus.color).not.toBe('rgba(0, 0, 0, 0)');
  });
}
