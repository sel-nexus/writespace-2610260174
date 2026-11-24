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
  await expect(page.getByRole('link', { name: 'A local story', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'A local story', exact: true }).click();
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
  await expect(page.getByRole('link', { name: 'Admin post', exact: true })).toBeVisible();
  const posts = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')));
  expect(posts).toHaveLength(1);
  expect(posts[0]).toMatchObject({ title: 'Admin post', authorId: 'default-admin' });
});

for (const width of [1280, 768, 375]) {
  checked(`post journey remains usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'WriteSpace' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Login' })).toBeFocused();
    await page.keyboard.press('Enter');
    await page.getByLabel('Username').fill('admin');
    await page.getByLabel('Password').fill('admin');
    await page.getByRole('button', { name: 'Login' }).click();
    const menu = page.getByRole('button', { name: 'Menu' });
    if (width < 640) {
      await expect(menu).toHaveAttribute('aria-expanded', 'false');
      await menu.focus();
      await page.keyboard.press('Enter');
      await expect(menu).toHaveAttribute('aria-expanded', 'true');
    } else {
      await expect(menu).toBeHidden();
    }
    await page.getByRole('link', { name: 'Write', exact: true }).click();
    await page.getByLabel('Title').fill(`Responsive ${width}`);
    await page.getByLabel('Content').fill('Readable on every screen');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Readable on every screen')).toBeVisible();
    await page.getByRole('link', { name: 'Back to All Posts' }).click();
    await expect(page.getByRole('link', { name: `Responsive ${width}`, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

checked('two tabs synchronize post edits and logout; last save wins', async ({ page, context }) => {
  const second = await context.newPage();
  const errors = [];
  second.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  second.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('link', { name: 'Login', exact: true }).first().click();
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password').fill('admin');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByRole('link', { name: 'Write New Post' }).click();
  await page.getByLabel('Title').fill('Shared story');
  await page.getByLabel('Content').fill('Initial body');
  await page.getByRole('button', { name: 'Save' }).click();
  await second.goto('/');
  await second.getByRole('link', { name: 'Start Reading' }).click();
  await expect(second.getByRole('link', { name: 'Shared story', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await second.getByRole('link', { name: 'Edit Shared story', exact: true }).click();
  await expect(page.getByLabel('Content')).toHaveValue('Initial body');
  await expect(second.getByLabel('Content')).toHaveValue('Initial body');
  await page.getByLabel('Content').fill('First tab save');
  await second.getByLabel('Content').fill('Second tab save');
  await page.evaluate(() => {
    window.observedPostEvents = [];
    window.addEventListener('storage', (event) => {
      if (event.key === 'writespace_posts') window.observedPostEvents.push(JSON.parse(event.newValue));
    });
  });
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('First tab save')).toBeVisible();
  await second.getByRole('button', { name: 'Save' }).click();
  await expect(second.getByText('Second tab save')).toBeVisible();
  await expect(page.getByText('Second tab save')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.observedPostEvents)).toEqual([
    [expect.objectContaining({ title: 'Shared story', content: 'Second tab save' })],
  ]);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')));
  expect(stored).toHaveLength(1);
  expect(stored[0]).toMatchObject({ title: 'Shared story', content: 'Second tab save' });
  await page.getByRole('button', { name: /Admin/ }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(second).toHaveURL(/\/login$/);
  await expect(second.getByLabel('Username')).toBeVisible();
  expect(errors).toEqual([]);
});

checked('interleaved stale post collection writes are last-writer-wins, not an atomic merge', async ({ page, context }) => {
  const second = await context.newPage();
  const errors = [];
  second.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  second.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('link', { name: 'Login', exact: true }).first().click();
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password').fill('admin');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByRole('link', { name: 'Write New Post' }).click();
  await page.getByLabel('Title').fill('Original title');
  await page.getByLabel('Content').fill('Original body');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Original title' })).toBeVisible();
  await second.goto('/blogs');
  await expect(second.getByRole('link', { name: 'Original title', exact: true })).toBeVisible();
  expect(new URL(page.url()).origin).toBe(new URL(second.url()).origin);

  // Pause both read-modify-write operations after reading the same collection.
  const snapshot = async () => {
    const { readPosts } = await import('/src/utils/storage.js');
    const result = readPosts();
    window.pendingPosts = result.value;
    return result;
  };
  const firstRead = await page.evaluate(snapshot);
  const secondRead = await second.evaluate(snapshot);
  expect(firstRead.ok).toBe(true);
  expect(firstRead.value).toHaveLength(1);
  expect(secondRead).toEqual(firstRead);

  const firstWrite = await page.evaluate(async () => {
    const { savePosts } = await import('/src/utils/storage.js');
    window.pendingPosts[0].title = 'First tab title';
    return savePosts(window.pendingPosts);
  });
  expect(firstWrite.ok).toBe(true);
  expect(await second.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([
    { ...firstRead.value[0], title: 'First tab title' },
  ]);

  // The second tab writes its earlier snapshot, losing the first tab's title change.
  const secondWrite = await second.evaluate(async () => {
    const { savePosts } = await import('/src/utils/storage.js');
    window.pendingPosts[0].content = 'Second tab body';
    return savePosts(window.pendingPosts);
  });
  expect(secondWrite.ok).toBe(true);
  const expected = [{ ...firstRead.value[0], content: 'Second tab body' }];
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(expected);
  expect(await second.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(expected);
  await second.reload();
  await expect(second.getByRole('link', { name: 'Original title', exact: true })).toBeVisible();
  await expect(second.getByRole('link', { name: 'First tab title' })).toHaveCount(0);
  await second.getByRole('link', { name: 'Original title', exact: true }).click();
  await expect(second.getByText('Second tab body')).toBeVisible();
  expect(errors).toEqual([]);
});
