import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { getSession, setSession } from './utils/auth';
import { createPost, POSTS_KEY, readPosts, savePosts, SESSION_KEY } from './utils/storage';

const session = { userId: 'u1', username: 'lee', displayName: 'Lee', role: 'user' };
const post = { id: 'p1', title: 'First', content: 'Hello', createdAt: '2024-01-01T12:00:00.000Z', authorId: 'u1', authorName: 'Lee' };

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function mount(path) {
  return render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><App /></MemoryRouter>);
}

describe('safe creation', () => {
  it.each(['title', 'content'].flatMap((field) => [[field, undefined], [field, null], [field, 123], [field, {}], [field, '  ']]))('rejects invalid post %s (%s)', (field, value) => {
    setSession(session);
    expect(createPost({ title: 'Title', content: 'Content', [field]: value }, getSession)).toEqual({ ok: false, code: 'VALIDATION', fields: [field] });
    expect(localStorage.getItem(POSTS_KEY)).toBeNull();
  });
  it.each(['id', 'title', 'content', 'authorId', 'authorName', 'createdAt'].flatMap((field) => [[field, undefined], [field, 7]]))('preserves stored post with invalid %s (%s)', (field, value) => {
    setSession(session);
    const raw = JSON.stringify([{ ...post, [field]: value }]);
    localStorage.setItem(POSTS_KEY, raw);
    expect(createPost({ title: 'New', content: 'Text' }, getSession).code).toBe('STORAGE_READ_FAILED');
    expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
  });
  it('saves large plaintext exactly and retains existing posts when quota fails', () => {
    setSession(session);
    const content = '<script>text</script>\n  '.repeat(5000);
    const saved = createPost({ title: 'Large', content }, getSession);
    expect(saved.ok).toBe(true);
    expect(JSON.parse(localStorage.getItem(POSTS_KEY))[0].content).toBe(content);
    const raw = localStorage.getItem(POSTS_KEY);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); });
    expect(createPost({ title: 'Another', content }, getSession).code).toBe('STORAGE_WRITE_FAILED');
    expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
  });
  it('saves input and snapshots the fresh identity, UUID and ISO date', () => {
    setSession(session);
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('new-id');
    const result = createPost({ title: ' My title ', content: ' line one\n  line two ' }, getSession);
    expect(result.ok).toBe(true);
    expect(result.value).toMatchObject({ id: 'new-id', title: ' My title ', content: ' line one\n  line two ', authorId: 'u1', authorName: 'Lee' });
    expect(new Date(result.value.createdAt).toISOString()).toBe(result.value.createdAt);
    expect(JSON.parse(localStorage.getItem(POSTS_KEY))).toEqual([result.value]);
  });
  it('validates both fields and rejects absent or invalid fresh sessions', () => {
    expect(createPost({ title: ' ', content: '' }, getSession)).toEqual({ ok: false, code: 'VALIDATION', fields: ['title', 'content'] });
    expect(createPost({ title: 'Valid', content: 'Valid' }, getSession).code).toBe('UNAUTHENTICATED');
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, role: 'root' }));
    expect(createPost({ title: 'Valid', content: 'Valid' }, getSession).code).toBe('UNAUTHENTICATED');
    expect(localStorage.getItem(POSTS_KEY)).toBeNull();
  });
  it.each(['{broken', '{}', '[null]', JSON.stringify([{ ...post, createdAt: 'bad' }]), JSON.stringify([post, post])])('rejects unsafe post storage %s without overwriting', (raw) => {
    setSession(session);
    localStorage.setItem(POSTS_KEY, raw);
    expect(readPosts().code).toBe('STORAGE_READ_FAILED');
    expect(createPost({ title: 'New', content: 'Text' }, getSession).code).toBe('STORAGE_READ_FAILED');
    expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
  });
  it('refuses a colliding id and reports unavailable reads or writes', () => {
    setSession(session); savePosts([post]);
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('p1');
    expect(createPost({ title: 'New', content: 'Text' }, getSession).code).toBe('STORAGE_WRITE_FAILED');
    expect(JSON.parse(localStorage.getItem(POSTS_KEY))).toEqual([post]);
    vi.restoreAllMocks();
    const originalGet = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
      if (key === POSTS_KEY) throw Error('blocked');
      return originalGet.call(this, key);
    });
    expect(createPost({ title: 'New', content: 'Text' }, getSession).code).toBe('STORAGE_READ_FAILED');
    vi.restoreAllMocks();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota'); });
    expect(createPost({ title: 'New', content: 'Text' }, getSession).code).toBe('STORAGE_WRITE_FAILED');
    expect(JSON.parse(localStorage.getItem(POSTS_KEY))).toEqual([post]);
  });
});

describe('post pages', () => {
  it('keeps the draft and stays on the editor when a post collection cannot be read', async () => {
    setSession(session); localStorage.setItem(POSTS_KEY, '[null]'); mount('/write');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Title'), 'Draft title');
    await user.type(screen.getByLabelText('Content'), 'Draft content');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('draft is still here');
    expect(screen.getByRole('heading', { name: 'Write a post' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Draft title');
    expect(screen.getByLabelText('Content')).toHaveValue('Draft content');
    expect(localStorage.getItem(POSTS_KEY)).toBe('[null]');
  });
  it('guards guests and keeps admin placeholders guarded', () => {
    mount('/write');
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    cleanup(); setSession(session); mount('/admin');
    expect(screen.getByRole('heading', { name: 'All Blogs' })).toBeInTheDocument();
  });
  it('lists newest first with a 120-character excerpt and neutral unknown author', () => {
    setSession(session);
    savePosts([post, { ...post, id: 'p2', title: 'Newest', content: 'x'.repeat(120) + 'TAIL', createdAt: '2024-02-02T12:00:00.000Z', authorId: 'deleted' }]);
    mount('/blogs');
    const cards = screen.getAllByRole('article');
    expect(within(cards[0]).getByRole('link', { name: 'Newest' })).toBeInTheDocument();
    expect(within(cards[0]).getByText('x'.repeat(120))).toBeInTheDocument();
    expect(within(cards[0]).queryByText(/TAIL/)).not.toBeInTheDocument();
    expect(within(cards[0]).getByText('Feb 02, 2024')).toBeInTheDocument();
    expect(within(cards[0]).getByLabelText('Unknown role')).toBeInTheDocument();
  });
  it('reads escaped text with preserved whitespace, handles missing posts and reacts to storage changes', async () => {
    setSession(session);
    savePosts([{ ...post, content: '<script>bad</script>\n  second line' }]);
    mount('/blog/p1');
    const body = screen.getByText('<script>bad</script> second line');
    expect(body).toHaveClass('whitespace-pre-wrap');
    expect(body.textContent).toBe('<script>bad</script>\n  second line');
    expect(document.querySelector('script')).toBeNull();
    act(() => { savePosts([]); window.dispatchEvent(new StorageEvent('storage', { key: POSTS_KEY })); });
    expect(screen.getByRole('heading', { name: 'Post not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to All Posts' })).toHaveAttribute('href', '/blogs');
  });
  it('validates, retains a draft after write failure, then saves and opens it', async () => {
    setSession(session); mount('/write');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Title is required.')).toBeInTheDocument();
    expect(screen.getByText('Content is required.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Title'), 'A story');
    await user.type(screen.getByLabelText('Content'), 'A draft');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota'); });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('draft is still here');
    expect(screen.getByLabelText('Title')).toHaveValue('A story');
    expect(screen.getByLabelText('Content')).toHaveValue('A draft');
    expect(localStorage.getItem(POSTS_KEY)).toBeNull();
    vi.restoreAllMocks();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('heading', { name: 'A story' })).toBeInTheDocument();
    expect(screen.getByText('A draft')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(POSTS_KEY))).toHaveLength(1);
  });
  it('cancels without writing and reports unsafe reads', async () => {
    setSession(session); mount('/write');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Title'), 'Unsaved');
    await user.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(screen.getByText('No blogs yet. Be the first to write one!')).toBeInTheDocument();
    expect(localStorage.getItem(POSTS_KEY)).toBeNull();
    act(() => { localStorage.setItem(POSTS_KEY, '[null]'); window.dispatchEvent(new StorageEvent('storage', { key: POSTS_KEY })); });
    expect(screen.getByRole('alert')).toHaveTextContent('could not be read');
  });
});
