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
  await expect(page.getByRole('link', { name: 'Users' })).toBeVisible();
});
