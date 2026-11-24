import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { getSession, setSession } from './utils/auth';
import { canMutatePost, deletePost, updatePost, POSTS_KEY, SESSION_KEY, savePosts } from './utils/storage';

const owner = { userId: 'u1', username: 'lee', displayName: 'Lee', role: 'user' };
const other = { userId: 'u2', username: 'pat', displayName: 'Pat', role: 'user' };
const admin = { userId: 'a1', username: 'admin2', displayName: 'Admin', role: 'admin' };
const post = { id: 'p1', title: 'Original', content: 'First', authorId: 'u1', authorName: 'Lee', createdAt: '2024-01-01T12:00:00.000Z' };
const another = { ...post, id: 'p2', title: 'Another', authorId: 'u2', authorName: 'Pat' };
const input = { id: 'p1', title: 'Updated', content: 'Updated body', authorId: 'u2', createdAt: 'changed' };
const stored = () => JSON.parse(localStorage.getItem(POSTS_KEY));
const mount = (path) => render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><App /></MemoryRouter>);

beforeEach(() => { localStorage.clear(); setSession(owner); savePosts([post, another]); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('post mutation contracts', () => {
  it('permits owner and admin, but never other users or malformed sessions', () => {
    expect(canMutatePost(owner, post)).toBe(true);
    expect(canMutatePost(admin, post)).toBe(true);
    expect(canMutatePost(other, post)).toBe(false);
    expect(canMutatePost({ ...owner, role: 'root' }, post)).toBe(false);
    expect(canMutatePost(owner, null)).toBe(false);
  });
  it.each([owner, admin])('updates as authorized identity and preserves immutable fields', (identity) => {
    setSession(identity);
    const result = updatePost(input, getSession);
    expect(result).toEqual({ ok: true, value: { ...post, title: 'Updated', content: 'Updated body' } });
    expect(stored()).toEqual([{ ...post, title: 'Updated', content: 'Updated body' }, another]);
  });
  it('validates, rejects stale identity, missing target and malformed session without writing', () => {
    expect(updatePost({ id: 'p1', title: ' ', content: '' }, getSession)).toEqual({ ok: false, code: 'VALIDATION', fields: ['title', 'content'] });
    setSession(other);
    expect(updatePost(input, getSession).code).toBe('FORBIDDEN');
    expect(updatePost({ ...input, id: 'missing' }, getSession).code).toBe('NOT_FOUND');
    localStorage.setItem(SESSION_KEY, '{');
    expect(updatePost(input, getSession).code).toBe('UNAUTHENTICATED');
    expect(stored()).toEqual([post, another]);
  });
  it.each(['title', 'content'])('rejects a missing %s without changing posts', (field) => {
    const invalid = { ...input };
    delete invalid[field];
    const before = localStorage.getItem(POSTS_KEY);
    expect(updatePost(invalid, getSession)).toEqual({ ok: false, code: 'VALIDATION', fields: [field] });
    expect(localStorage.getItem(POSTS_KEY)).toBe(before);
    expect(stored()).toEqual([post, another]);
  });
  it.each(['title', 'content'].flatMap((field) => [
    [field, 'null', null], [field, 'number', 123], [field, 'boolean', false], [field, 'object', {}], [field, 'array', []],
  ]))('rejects %s with invalid %s type without changing posts', (field, _type, value) => {
    const before = localStorage.getItem(POSTS_KEY);
    expect(updatePost({ ...input, [field]: value }, getSession)).toEqual({ ok: false, code: 'VALIDATION', fields: [field] });
    expect(localStorage.getItem(POSTS_KEY)).toBe(before);
    expect(stored()).toEqual([post, another]);
  });
  it('persists large valid editable fields without imposing a size limit', () => {
    const title = 'T'.repeat(10000);
    const content = 'Body '.repeat(10000);
    const updated = { ...post, title, content };
    expect(updatePost({ ...input, title, content }, getSession)).toEqual({ ok: true, value: updated });
    expect(stored()).toEqual([updated, another]);
  });
  it.each(['{broken', '{}', '[null]', JSON.stringify([post, post])])('does not overwrite unsafe collection %s', (raw) => {
    localStorage.setItem(POSTS_KEY, raw);
    expect(updatePost(input, getSession).code).toBe('STORAGE_READ_FAILED');
    expect(deletePost({ id: 'p1' }, getSession, () => true).code).toBe('STORAGE_READ_FAILED');
    expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
  });
  it('reports blocked collection reads and writes without losing posts', () => {
    const original = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
      if (key === POSTS_KEY) throw Error('blocked');
      return original.call(this, key);
    });
    expect(updatePost(input, getSession).code).toBe('STORAGE_READ_FAILED');
    vi.restoreAllMocks();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota'); });
    expect(updatePost(input, getSession).code).toBe('STORAGE_WRITE_FAILED');
    expect(deletePost({ id: 'p1' }, getSession, () => true).code).toBe('STORAGE_WRITE_FAILED');
    expect(stored()).toEqual([post, another]);
  });
  it('rejects unauthorized or missing targets before asking for confirmation', () => {
    const confirm = vi.fn(() => true);
    setSession(other);
    expect(deletePost({ id: 'p1' }, getSession, confirm).code).toBe('FORBIDDEN');
    expect(deletePost({ id: 'missing' }, getSession, confirm).code).toBe('NOT_FOUND');
    localStorage.removeItem(SESSION_KEY);
    expect(deletePost({ id: 'p1' }, getSession, confirm).code).toBe('UNAUTHENTICATED');
    expect(confirm).not.toHaveBeenCalled();
    expect(stored()).toEqual([post, another]);
  });
  it('cancels without a write and deletes only the target for an admin', () => {
    expect(deletePost({ id: 'p1' }, getSession, () => false).code).toBe('CANCELLED');
    expect(stored()).toEqual([post, another]);
    setSession(admin);
    expect(deletePost({ id: 'p1' }, getSession, () => true)).toEqual({ ok: true, value: null });
    expect(stored()).toEqual([another]);
  });
  it.each([
    ['signed out', () => localStorage.removeItem(SESSION_KEY), 'UNAUTHENTICATED'],
    ['different user', () => setSession(other), 'FORBIDDEN'],
    ['removed target', () => savePosts([another]), 'NOT_FOUND'],
    ['changed owner', () => savePosts([{ ...post, authorId: 'u2' }, another]), 'FORBIDDEN'],
    ['corrupt collection', () => localStorage.setItem(POSTS_KEY, '[null]'), 'STORAGE_READ_FAILED'],
  ])('rechecks %s during confirmation', (_label, change, expected) => {
    let afterChange;
    const result = deletePost({ id: 'p1' }, getSession, () => {
      change();
      afterChange = localStorage.getItem(POSTS_KEY);
      return true;
    });
    expect(result.code).toBe(expected);
    expect(localStorage.getItem(POSTS_KEY)).toBe(afterChange);
  });
  it('uses the latest post collection after confirmation', () => {
    expect(deletePost({ id: 'p1' }, getSession, () => { savePosts([post, another, { ...post, id: 'p3' }]); return true; }).ok).toBe(true);
    expect(stored().map((item) => item.id)).toEqual(['p2', 'p3']);
  });
});

describe('mutation pages', () => {
  it('shows separate reader and edit links on owned list cards only', () => {
    mount('/blogs');
    const cards = screen.getAllByRole('article');
    expect(within(cards[0]).getByRole('link', { name: 'Original' })).toHaveAttribute('href', '/blog/p1');
    expect(within(cards[0]).getByRole('link', { name: 'Edit Original' })).toHaveAttribute('href', '/edit/p1');
    expect(within(cards[1]).queryByRole('link', { name: /Edit/ })).not.toBeInTheDocument();
  });
  it('redirects other-owner direct edit, and shows a missing edit state', () => {
    mount('/edit/p2');
    expect(screen.getByRole('heading', { name: 'All Blogs' })).toBeInTheDocument();
    cleanup(); mount('/edit/missing');
    expect(screen.getByRole('heading', { name: 'Post not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to All Posts' })).toHaveAttribute('href', '/blogs');
  });
  it('prefills, validates and updates as admin with immutable author', async () => {
    setSession(admin); mount('/edit/p1');
    const user = userEvent.setup();
    expect(screen.getByLabelText('Title')).toHaveValue('Original');
    await user.clear(screen.getByLabelText('Title'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Title is required.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Title'), 'Admin edit');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('heading', { name: 'Admin edit' })).toBeInTheDocument();
    expect(stored()[0]).toEqual({ ...post, title: 'Admin edit' });
  });
  it('preserves a draft and remains in editor when session changes or write fails', async () => {
    mount('/edit/p1');
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Draft');
    setSession(other);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('draft is still here');
    expect(screen.getByLabelText('Title')).toHaveValue('Draft');
    setSession(owner);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota'); });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('heading', { name: 'Edit post' })).toBeInTheDocument();
    expect(stored()).toEqual([post, another]);
  });
  it('cancels an edit without saving', async () => {
    mount('/edit/p1'); const user = userEvent.setup();
    await user.type(screen.getByLabelText('Title'), ' draft');
    await user.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(screen.getByRole('heading', { name: 'All Blogs' })).toBeInTheDocument();
    expect(stored()).toEqual([post, another]);
  });
  it('keeps reader open on cancel and failure, then navigates only after delete', async () => {
    mount('/blog/p1'); const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('heading', { name: 'Original' })).toBeInTheDocument();
    expect(stored()).toEqual([post, another]);
    confirm.mockReturnValue(true);
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota'); });
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not delete');
    expect(screen.getByRole('heading', { name: 'Original' })).toBeInTheDocument();
    write.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('heading', { name: 'All Blogs' })).toBeInTheDocument();
    expect(stored()).toEqual([another]);
  });
  it('hides actions for another author and blocks session changes during confirmation', async () => {
    setSession(other); mount('/blog/p1');
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    cleanup(); setSession(owner); mount('/blog/p1');
    vi.spyOn(window, 'confirm').mockImplementation(() => { setSession(other); return true; });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not delete');
    expect(screen.getByRole('heading', { name: 'Original' })).toBeInTheDocument();
    expect(stored()).toEqual([post, another]);
  });
});
