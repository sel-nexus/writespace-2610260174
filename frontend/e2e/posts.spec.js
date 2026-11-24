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

checked('register, validate, create, read and reload a post', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Get Started', exact: true }).click();
  await page.getByLabel('Display Name').fill('Lee');
  await page.getByLabel('Username').fill('lee');
  await page.getByLabel('Password', { exact: true }).fill('demo');
  await page.getByLabel('Confirm Password').fill('demo');
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
  await page.getByRole('link', { name: 'Write a post' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Title is required.')).toBeVisible();
  await expect(page.getByText('Content is required.')).toBeVisible();
  await page.getByLabel('Title').fill('A local story');
  await page.getByLabel('Content').fill('First line\n  <b>Second line</b>');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'A local story' })).toBeVisible();
  await expect(page.getByText('First line', { exact: false })).toContainText('<b>Second line</b>');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')));
  expect(stored).toHaveLength(1);
  expect(stored[0]).toMatchObject({ title: 'A local story', content: 'First line\n  <b>Second line</b>', authorName: 'Lee' });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'A local story' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to All Posts' }).click();
  await expect(page.getByRole('link', { name: 'A local story' })).toBeVisible();
  await page.getByRole('link', { name: 'A local story' }).click();
  await expect(page.getByRole('heading', { name: 'A local story' })).toBeVisible();
});

checked('admin can create and cancel leaves stored posts unchanged', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Login', exact: true }).first().click();
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password').fill('admin');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByRole('link', { name: 'Write', exact: true }).click();
  await page.getByLabel('Title').fill('Admin post');
  await page.getByLabel('Content').fill('Admin text');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Admin post' })).toBeVisible();
  await page.getByRole('link', { name: 'Write', exact: true }).click();
  await page.getByLabel('Title').fill('Discarded');
  await page.getByRole('link', { name: 'Cancel' }).click();
  await expect(page.getByRole('link', { name: 'Admin post' })).toBeVisible();
  const posts = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')));
  expect(posts).toHaveLength(1);
  expect(posts[0]).toMatchObject({ title: 'Admin post', authorId: 'default-admin' });
});
