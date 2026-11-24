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

const owner = { userId: 'u1', username: 'lee', displayName: 'Lee', role: 'user' };
const other = { userId: 'u2', username: 'pat', displayName: 'Pat', role: 'user' };
const admin = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' };
const post = { id: 'p1', title: 'Original story', content: 'Original body', authorId: 'u1', authorName: 'Lee', createdAt: '2024-01-01T12:00:00.000Z' };

async function seed(page, session, route = '/') {
  await page.addInitScript(({ session, post }) => {
    if (sessionStorage.getItem('test_seeded')) return;
    sessionStorage.setItem('test_seeded', '1');
    localStorage.setItem('writespace_session', JSON.stringify(session));
    localStorage.setItem('writespace_posts', JSON.stringify([post]));
  }, { session, post });
  await page.goto(route);
}

checked('owner edits, reloads, cancels then confirms deletion', async ({ page }) => {
  await seed(page, owner);
  await page.getByRole('link', { name: 'Start Reading' }).click();
  await page.getByRole('link', { name: 'Edit Original story', exact: true }).click();
  await expect(page.getByLabel('Title')).toHaveValue('Original story');
  await page.getByLabel('Title').fill('Revised story');
  await page.getByLabel('Content').fill('Revised body');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Revised story' })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Revised body')).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts'))[0]);
  expect(saved).toEqual({ ...post, title: 'Revised story', content: 'Revised body' });
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Title')).toHaveValue('Revised story');
  await page.getByLabel('Content').fill('Reader revision');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Reader revision')).toBeVisible();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('heading', { name: 'Revised story' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toHaveLength(1);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([]);
});

checked('other user cannot edit another author from the reader', async ({ page }) => {
  await seed(page, other);
  await page.getByRole('link', { name: 'Start Reading' }).click();
  await page.getByRole('link', { name: 'Original story', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Original story' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Edit', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0);
});

checked('other user cannot open an editor directly', async ({ page }) => {
  await seed(page, other, '/edit/p1');
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('link', { name: 'Edit Original story' })).toHaveCount(0);
});

checked('admin edits another author from recent posts', async ({ page }) => {
  await seed(page, admin);
  await page.getByRole('link', { name: 'Go to Dashboard' }).click();
  await page.getByRole('link', { name: 'Edit Original story', exact: true }).click();
  await page.getByLabel('Title').fill('Admin revision');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Admin revision' })).toBeVisible();
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts'))[0])).toEqual({ ...post, title: 'Admin revision' });
});

checked('missing editor and canceled edit leave posts intact', async ({ page }) => {
  await seed(page, owner, '/edit/missing');
  await expect(page.getByRole('heading', { name: 'Post not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to All Posts' }).click();
  await page.getByRole('link', { name: 'Edit Original story', exact: true }).click();
  await page.getByLabel('Title').fill('Discarded');
  await page.getByRole('link', { name: 'Cancel' }).click();
  await expect(page.getByRole('link', { name: 'Original story', exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([post]);
});
