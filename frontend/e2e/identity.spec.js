import { test, expect } from '@playwright/test';

const testWithErrors = test.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', (error) => errors.push(error.message));
    await use(page);
    expect(errors).toEqual([]);
  },
});

testWithErrors('register, reload, logout, and log in with local credentials', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('No posts yet — check back soon!')).toBeVisible();
  await page.getByRole('link', { name: 'Get Started', exact: true }).click();
  await page.getByLabel('Display Name').fill('Lee');
  await page.getByLabel('Username').fill('lee');
  await page.getByLabel('Password', { exact: true }).fill('demo');
  await page.getByLabel('Confirm Password').fill('demo');
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await page.reload();
  await expect(page.getByRole('button', { name: /Lee/ })).toBeVisible();
  await page.getByRole('button', { name: /Lee/ }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('link', { name: 'Login', exact: true }).first().click();
  await page.getByLabel('Username').fill('lee');
  await page.getByLabel('Password').fill('wrong');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByText('Invalid username or password.')).toBeVisible();
  await page.getByLabel('Password').fill('demo');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
});

testWithErrors('a regular user opening the admin URL is redirected', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('writespace_session', JSON.stringify({ userId: 'u1', username: 'lee', displayName: 'Lee', role: 'user' })));
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/blogs$/);
});

testWithErrors('guest routes are guarded and admin login survives reload', async ({ page }) => {
  await page.goto('/users');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password').fill('admin');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.reload();
  await expect(page.getByRole('link', { name: 'Users', exact: true })).toBeVisible();
});

for (const width of [1280, 768, 375]) {
  testWithErrors(`account registration and navigation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    await page.getByRole('link', { name: 'Get Started', exact: true }).click();
    await page.getByLabel('Display Name').fill('Responsive Writer');
    await page.getByLabel('Username').fill('responsive');
    await page.getByLabel('Password', { exact: true }).fill('demo');
    await page.getByLabel('Confirm Password').fill('demo');
    await page.getByRole('button', { name: 'Register' }).click();
    await expect(page.getByRole('button', { name: /Responsive Writer/ })).toBeVisible();
    const menu = page.getByRole('button', { name: 'Menu' });
    if (width < 640) {
      await expect(page.getByRole('link', { name: 'Write', exact: true })).toBeHidden();
      await menu.click();
      await expect(menu).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByRole('link', { name: 'Write', exact: true })).toBeVisible();
      await menu.click();
      await expect(menu).toHaveAttribute('aria-expanded', 'false');
    } else {
      await expect(menu).toBeHidden();
      await expect(page.getByRole('link', { name: 'Write', exact: true })).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const account = page.getByRole('button', { name: /Responsive Writer/ });
    await account.focus();
    await page.keyboard.press('Enter');
    await expect(account).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Logout' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/$/);
  });
}
