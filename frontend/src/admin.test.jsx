import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { getSession, setSession } from './utils/auth';
import { createUser, deleteUser, POSTS_KEY, savePosts, saveUsers, SESSION_KEY, USERS_KEY } from './utils/storage';

const admin = { userId: 'default-admin', username: 'admin', displayName: 'Admin', role: 'admin' };
const otherAdmin = { id: 'a1', username: 'pat', displayName: 'Pat', password: 'demo', role: 'admin', createdAt: '2024-01-01T00:00:00.000Z' };
const account = { id: 'u1', username: 'lee', displayName: 'Lee', password: 'demo', role: 'user', createdAt: '2024-01-02T00:00:00.000Z' };
const regular = { userId: 'u1', username: 'lee', displayName: 'Lee', role: 'user' };
const input = { displayName: 'New', username: 'new', password: 'demo', role: 'user' };
const post = { id: 'p1', title: 'A story', content: 'Content', authorId: 'u1', authorName: 'Lee', createdAt: '2024-01-01T00:00:00.000Z' };
const stored = () => JSON.parse(localStorage.getItem(USERS_KEY));
const mount = (path) => render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><App /></MemoryRouter>);

beforeEach(() => { localStorage.clear(); setSession(admin); saveUsers([account, otherAdmin]); savePosts([post]); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('admin account operations', () => {
  it.each(['user', 'admin'])('creates %s without replacing session', (role) => {
    const session = localStorage.getItem(SESSION_KEY);
    const result = createUser({ ...input, role }, getSession);
    expect(result.ok).toBe(true);
    expect(result.value).toMatchObject({ ...input, role });
    expect(Number.isFinite(Date.parse(result.value.createdAt))).toBe(true);
    expect(stored()).toEqual([account, otherAdmin, result.value]);
    expect(localStorage.getItem(SESSION_KEY)).toBe(session);
  });
  it('denies missing, invalid and regular identities even on direct calls', () => {
    expect(createUser(input, () => null).code).toBe('UNAUTHENTICATED');
    expect(createUser(input, () => ({ role: 'admin' })).code).toBe('UNAUTHENTICATED');
    setSession(regular);
    expect(createUser(input, getSession).code).toBe('FORBIDDEN');
    expect(deleteUser({ id: 'a1' }, getSession, () => true).code).toBe('FORBIDDEN');
    expect(stored()).toEqual([account, otherAdmin]);
  });
  it('rejects required fields, roles, reserved names and exact duplicates', () => {
    expect(createUser({ displayName: ' ', username: '', password: '', role: 'root' }, getSession)).toEqual({ ok: false, code: 'VALIDATION', fields: ['displayName', 'username', 'password', 'role'] });
    expect(createUser({ ...input, username: 'admin' }, getSession).reason).toBe('USERNAME_TAKEN');
    expect(createUser({ ...input, username: 'lee' }, getSession).reason).toBe('USERNAME_TAKEN');
    expect(createUser({ ...input, username: 'Lee' }, getSession).ok).toBe(true);
  });
  it('rejects UUID collisions including the permanent admin id', () => {
    const uuid = vi.spyOn(crypto, 'randomUUID').mockReturnValue('u1');
    expect(createUser(input, getSession).code).toBe('STORAGE_WRITE_FAILED');
    uuid.mockReturnValue('default-admin');
    expect(createUser(input, getSession).code).toBe('STORAGE_WRITE_FAILED');
    expect(stored()).toEqual([account, otherAdmin]);
  });
  it.each(['{', '{}', '[null]', JSON.stringify([account, account]), JSON.stringify([{ ...account, createdAt: 'bad' }]), JSON.stringify([{ ...account, id: 'default-admin' }])])('does not overwrite unsafe users %s', (raw) => {
    localStorage.setItem(USERS_KEY, raw);
    expect(createUser(input, getSession).code).toBe('STORAGE_READ_FAILED');
    expect(deleteUser({ id: 'u1' }, getSession, () => true).code).toBe('STORAGE_READ_FAILED');
    expect(localStorage.getItem(USERS_KEY)).toBe(raw);
  });
  it('blocks reads and writes without success or data loss', () => {
    const get = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) { if (key === USERS_KEY) throw Error('blocked'); return get.call(this, key); });
    expect(createUser(input, getSession).code).toBe('STORAGE_READ_FAILED');
    vi.restoreAllMocks();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota'); });
    expect(createUser(input, getSession).code).toBe('STORAGE_WRITE_FAILED');
    expect(deleteUser({ id: 'u1' }, getSession, () => true).code).toBe('STORAGE_WRITE_FAILED');
    expect(stored()).toEqual([account, otherAdmin]);
  });
  it('blocks default and current accounts before confirming, and cancels safely', () => {
    const confirm = vi.fn(() => true);
    expect(deleteUser({ id: 'default-admin' }, getSession, confirm).code).toBe('FORBIDDEN');
    setSession({ userId: 'a1', username: 'pat', displayName: 'Pat', role: 'admin' });
    expect(deleteUser({ id: 'a1' }, getSession, confirm).code).toBe('FORBIDDEN');
    expect(deleteUser({ id: 'missing' }, getSession, confirm).code).toBe('NOT_FOUND');
    expect(confirm).not.toHaveBeenCalled();
    expect(deleteUser({ id: 'u1' }, getSession, () => false).code).toBe('CANCELLED');
    expect(stored()).toEqual([account, otherAdmin]);
  });
  it('deletes only the eligible account in one write and retains its posts', () => {
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const before = localStorage.getItem(POSTS_KEY);
    expect(deleteUser({ id: 'u1' }, getSession, () => true)).toEqual({ ok: true, value: null });
    expect(stored()).toEqual([otherAdmin]);
    expect(localStorage.getItem(POSTS_KEY)).toBe(before);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0][0]).toBe(USERS_KEY);
  });
  it.each([
    ['signout', () => localStorage.removeItem(SESSION_KEY), 'UNAUTHENTICATED'],
    ['regular role', () => setSession(regular), 'FORBIDDEN'],
    ['target becomes active', () => setSession({ userId: 'u1', username: 'lee', displayName: 'Lee', role: 'admin' }), 'FORBIDDEN'],
    ['target removed', () => saveUsers([otherAdmin]), 'NOT_FOUND'],
    ['corrupt accounts', () => localStorage.setItem(USERS_KEY, '[null]'), 'STORAGE_READ_FAILED'],
  ])('rechecks %s after confirmation', (_label, change, code) => {
    let after;
    const result = deleteUser({ id: 'u1' }, getSession, () => { change(); after = localStorage.getItem(USERS_KEY); return true; });
    expect(result.code).toBe(code);
    expect(localStorage.getItem(USERS_KEY)).toBe(after);
  });
  it('preserves accounts added during confirmation', () => {
    const extra = { ...account, id: 'u2', username: 'extra' };
    expect(deleteUser({ id: 'u1' }, getSession, () => { saveUsers([account, otherAdmin, extra]); return true; }).ok).toBe(true);
    expect(stored()).toEqual([otherAdmin, extra]);
  });
});

describe('admin pages', () => {
  it.each(['/admin', '/users'])('guards %s for guests and users', (path) => {
    localStorage.removeItem(SESSION_KEY); mount(path);
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    cleanup(); setSession(regular); mount(path);
    expect(screen.getByRole('heading', { name: 'All Blogs' })).toBeInTheDocument();
  });
  it('shows exact counts, quick actions and only the five newest posts', () => {
    savePosts(Array.from({ length: 6 }, (_, i) => ({ ...post, id: `p${i}`, title: `Story ${i}`, createdAt: `2024-01-0${i + 1}T00:00:00.000Z` })));
    mount('/admin');
    const overview = screen.getByRole('region', { name: 'Overview' });
    for (const [label, value] of [['Total Posts', '6'], ['Total Users', '3'], ['Total Admins', '2'], ['Total users', '1']]) {
      expect(within(overview).getByText(label, { exact: true }).parentElement).toHaveTextContent(value);
    }
    expect(screen.getByRole('link', { name: 'Write New Post' })).toHaveAttribute('href', '/write');
    expect(screen.getByRole('link', { name: 'Manage Users' })).toHaveAttribute('href', '/users');
    expect(screen.queryByRole('link', { name: 'Story 0' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /^Story [1-5]$/ })).toHaveLength(5);
  });
  it('updates stats on storage events and avoids fabricated counts on corrupt data', () => {
    mount('/admin');
    saveUsers([]);
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: USERS_KEY })));
    expect(screen.getByText('Total Users').parentElement).toHaveTextContent('1');
    localStorage.setItem(POSTS_KEY, '{');
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: POSTS_KEY })));
    expect(screen.getByText('Total Posts').parentElement).toHaveTextContent('—');
    expect(screen.getByRole('alert')).toHaveTextContent('could not be read');
  });
  it('creates accounts, displays default protection, validation and storage failures', async () => {
    mount('/users'); const user = userEvent.setup();
    expect(screen.getByRole('button', { name: 'Delete admin' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete admin' })).toHaveAttribute('title', 'Default admin cannot be deleted.');
    expect(screen.getByText('—')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create User' }));
    expect(screen.getByRole('alert')).toHaveTextContent('required');
    await user.type(screen.getByLabelText('Display Name'), 'New Admin');
    await user.type(screen.getByLabelText('Username'), 'newadmin');
    await user.type(screen.getByLabelText('Password'), 'demo');
    await user.selectOptions(screen.getByLabelText('Role'), 'admin');
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota'); });
    await user.click(screen.getByRole('button', { name: 'Create User' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not create');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    write.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Create User' }));
    expect(screen.getByRole('status')).toHaveTextContent('Account created');
    expect(screen.getByText('@newadmin')).toBeInTheDocument();
    expect(getSession()).toEqual(admin);
  });
  it('handles canceled, failed and successful user deletion', async () => {
    mount('/users'); const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await user.click(screen.getByRole('button', { name: 'Delete lee' }));
    expect(screen.getByText('@lee')).toBeInTheDocument();
    confirm.mockReturnValue(true);
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota'); });
    await user.click(screen.getByRole('button', { name: 'Delete lee' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not delete');
    expect(screen.getByText('@lee')).toBeInTheDocument();
    write.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Delete lee' }));
    expect(screen.queryByText('@lee')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('posts remain');
    expect(JSON.parse(localStorage.getItem(POSTS_KEY))).toEqual([post]);
  });
  it('refreshes user rows on storage events and disables the active admin', () => {
    setSession({ userId: 'a1', username: 'pat', displayName: 'Pat', role: 'admin' });
    mount('/users');
    expect(screen.getByRole('button', { name: 'Delete pat' })).toBeDisabled();
    saveUsers([otherAdmin]);
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: USERS_KEY })));
    expect(screen.queryByText('@lee')).not.toBeInTheDocument();
  });
  it('does not create an account when the rendered admin session is stale', async () => {
    mount('/users');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Display Name'), 'New');
    await user.type(screen.getByLabelText('Username'), 'new');
    await user.type(screen.getByLabelText('Password'), 'demo');
    setSession(regular);
    await user.click(screen.getByRole('button', { name: 'Create User' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not create');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(stored()).toEqual([account, otherAdmin]);
  });
  it('refuses dashboard post deletion if authorization changes during confirmation', async () => {
    mount('/admin');
    vi.spyOn(window, 'confirm').mockImplementation(() => { setSession({ userId: 'other', username: 'other', displayName: 'Other', role: 'user' }); return true; });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete A story' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not delete');
    expect(JSON.parse(localStorage.getItem(POSTS_KEY))).toEqual([post]);
  });
  it('uses shared post deletion with cancel, failure and successful navigation', async () => {
    mount('/admin'); const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await user.click(screen.getByRole('button', { name: 'Delete A story' }));
    expect(screen.getByRole('link', { name: 'A story' })).toBeInTheDocument();
    confirm.mockReturnValue(true);
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota'); });
    await user.click(screen.getByRole('button', { name: 'Delete A story' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not delete');
    write.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Delete A story' }));
    expect(screen.getByRole('heading', { name: 'All Blogs' })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(POSTS_KEY))).toEqual([]);
  });
});
