import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import App from './App';
import { clearSession, getSession, login, logout, register, roleHome, setSession } from './utils/auth';
import { getPosts, getUsers, readCollection, savePosts, saveUsers, SESSION_KEY, USERS_KEY } from './utils/storage';
import { ProtectedRoute } from './components/ProtectedRoute';

const input = { displayName: 'Lee', username: 'lee', password: 'demo', confirmPassword: 'demo' };
const userSession = { userId: 'u1', username: 'lee', displayName: 'Lee', role: 'user' };
const storedUser = { id: 'u1', username: 'existing', displayName: 'Existing', password: 'secret', role: 'user', createdAt: '2024-01-01T00:00:00.000Z' };

beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function mount(path = '/') {
  return render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><App /></MemoryRouter>);
}

describe('storage and identity contracts', () => {
  it.each([null, undefined])('rejects a missing registration input (%s)', (value) => {
    expect(register(value)).toEqual({ ok: false, code: 'VALIDATION', fields: ['displayName', 'username', 'password', 'confirmPassword'] });
    expect(localStorage.getItem(USERS_KEY)).toBeNull();
  });
  it.each(['displayName', 'username', 'password', 'confirmPassword'].flatMap((field) => [
    [field, undefined], [field, null], [field, 42], [field, {}], [field, '  '],
  ]))('rejects registration with invalid %s (%s)', (field, value) => {
    expect(register({ ...input, [field]: value })).toMatchObject({ ok: false, code: 'VALIDATION', fields: [field] });
    expect(localStorage.getItem(USERS_KEY)).toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });
  it.each(['userId', 'username', 'displayName', 'role'].flatMap((field) => [
    [field, undefined], [field, null], [field, 42], [field, {}], [field, '  '],
  ]))('rejects session with invalid %s (%s) on read and write', (field, value) => {
    const invalid = { ...userSession, [field]: value };
    expect(setSession(invalid)).toMatchObject({ ok: false, code: 'VALIDATION' });
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    localStorage.setItem(SESSION_KEY, JSON.stringify(invalid));
    expect(getSession()).toBeNull();
  });
  it.each([
    ['invalid date', [{ ...storedUser, createdAt: 'not a date' }]],
    ['duplicate id', [storedUser, { ...storedUser, username: 'other' }]],
    ['duplicate username', [storedUser, { ...storedUser, id: 'u2' }]],
    ['reserved id', [{ ...storedUser, id: 'default-admin' }]],
    ['reserved username', [{ ...storedUser, username: 'admin' }]],
    ['invalid record', [storedUser, null]],
  ])('does not rewrite %s account data during registration', (_name, records) => {
    const raw = JSON.stringify(records);
    localStorage.setItem(USERS_KEY, raw);
    expect(register(input)).toEqual({ ok: false, code: 'STORAGE_READ_FAILED' });
    expect(localStorage.getItem(USERS_KEY)).toBe(raw);
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });
  it.each(['id', 'displayName', 'username', 'password', 'role', 'createdAt'].flatMap((field) => [
    [field, undefined], [field, 42],
  ]))('preserves stored account with invalid %s (%s)', (field, value) => {
    const raw = JSON.stringify([{ ...storedUser, [field]: value }]);
    localStorage.setItem(USERS_KEY, raw);
    expect(register(input).code).toBe('STORAGE_READ_FAILED');
    expect(localStorage.getItem(USERS_KEY)).toBe(raw);
  });
  it.each([['collision', 'u1'], ['reserved id', 'default-admin'], ['blank id', '  '], ['non-string id', 42]])('rejects generated %s without writes', (_name, id) => {
    const raw = JSON.stringify([storedUser]);
    localStorage.setItem(USERS_KEY, raw);
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(id);
    expect(register(input)).toEqual({ ok: false, code: 'STORAGE_WRITE_FAILED' });
    expect(localStorage.getItem(USERS_KEY)).toBe(raw);
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });
  it('preserves accounts if UUID generation throws', () => {
    const raw = JSON.stringify([storedUser]);
    localStorage.setItem(USERS_KEY, raw);
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw Error('unavailable'); });
    expect(register(input).code).toBe('STORAGE_WRITE_FAILED');
    expect(localStorage.getItem(USERS_KEY)).toBe(raw);
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });
  it('keeps exact built-in credentials authoritative even with a stored admin impersonator', () => {
    localStorage.setItem(USERS_KEY, JSON.stringify([{ ...storedUser, username: 'admin', password: 'secret', role: 'user' }]));
    expect(login({ username: 'admin', password: 'admin' }).value).toEqual({ userId: 'default-admin', username: 'admin', displayName: 'Admin', role: 'admin' });
    expect(login({ username: 'admin', password: 'secret' }).code).toBe('INVALID_CREDENTIALS');
  });
  it('reads missing, corrupt and non-array collections without rewriting them', () => {
    expect(getPosts()).toEqual([]);
    expect(readCollection(USERS_KEY)).toEqual({ ok: true, value: [] });
    localStorage.setItem(USERS_KEY, '{broken');
    expect(getUsers()).toEqual([]);
    expect(register(input).code).toBe('STORAGE_READ_FAILED');
    expect(localStorage.getItem(USERS_KEY)).toBe('{broken');
    localStorage.setItem(USERS_KEY, '{}');
    expect(readCollection(USERS_KEY).code).toBe('STORAGE_READ_FAILED');
    localStorage.setItem(USERS_KEY, '[null]');
    expect(register(input).code).toBe('STORAGE_READ_FAILED');
    expect(localStorage.getItem(USERS_KEY)).toBe('[null]');
  });
  it('handles inaccessible storage and failed collection writes', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw Error('blocked'); });
    expect(getUsers()).toEqual([]);
    expect(getSession()).toBeNull();
    expect(register(input).code).toBe('STORAGE_READ_FAILED');
    vi.restoreAllMocks();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota'); });
    expect(saveUsers([]).code).toBe('STORAGE_WRITE_FAILED');
    expect(savePosts([]).code).toBe('STORAGE_WRITE_FAILED');
    expect(register(input).code).toBe('STORAGE_WRITE_FAILED');
    expect(login({ username: 'admin', password: 'admin' }).code).toBe('STORAGE_WRITE_FAILED');
  });
  it('registers literal credentials and persists identity separately from the password', () => {
    const result = register(input);
    expect(result.ok).toBe(true);
    expect(getUsers()[0]).toMatchObject({ username: 'lee', role: 'user', password: 'demo' });
    expect(getSession()).toEqual(result.value);
    expect(getSession()).not.toHaveProperty('password');
    expect(register(input)).toMatchObject({ code: 'VALIDATION', reason: 'USERNAME_TAKEN' });
    expect(register({ ...input, username: 'Lee' }).ok).toBe(true);
    expect(login({ username: 'LEE', password: 'demo' }).code).toBe('INVALID_CREDENTIALS');
    expect(login({ username: 'lee', password: 'demo' }).value.username).toBe('lee');
  });
  it('validates required fields, confirmation and reserved username', () => {
    expect(register({ ...input, displayName: '  ' })).toMatchObject({ code: 'VALIDATION', fields: ['displayName'] });
    expect(register({ ...input, confirmPassword: 'other' }).fields).toContain('confirmPassword');
    expect(register({ ...input, username: 'admin' })).toMatchObject({ code: 'VALIDATION', reason: 'USERNAME_TAKEN' });
    expect(getUsers()).toEqual([]);
  });
  it('preserves a partially registered user and rejects duplicate retry', () => {
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === SESSION_KEY) throw Error('quota');
      return original.call(this, key, value);
    });
    expect(register(input).code).toBe('PARTIAL_REGISTRATION');
    expect(getUsers()).toHaveLength(1);
    expect(getSession()).toBeNull();
    expect(register(input)).toMatchObject({ reason: 'USERNAME_TAKEN' });
  });
  it('gives built-in admin precedence and rejects invalid sessions', () => {
    localStorage.setItem(USERS_KEY, '[null]');
    expect(login({ username: 'admin', password: 'admin' }).value).toMatchObject({ userId: 'default-admin', role: 'admin' });
    expect(roleHome(getSession())).toBe('/admin');
    expect(roleHome(userSession)).toBe('/blogs');
    localStorage.setItem(SESSION_KEY, '{bad');
    expect(getSession()).toBeNull();
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...userSession, role: 'root' }));
    expect(getSession()).toBeNull();
    expect(setSession({ ...userSession, role: 'root' }).code).toBe('VALIDATION');
  });
  it('removes only session and reports remove failures', () => {
    saveUsers([]); savePosts([]); setSession(userSession);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw Error('blocked'); });
    expect(logout().code).toBe('STORAGE_WRITE_FAILED');
    expect(getSession()).toEqual(userSession);
    vi.restoreAllMocks();
    expect(clearSession().ok).toBe(true);
    expect(getSession()).toBeNull();
    expect(localStorage.getItem(USERS_KEY)).toBe('[]');
    expect(localStorage.getItem('writespace_posts')).toBe('[]');
  });
});

describe('pages and routing', () => {
  it.each(['partial', 'read', 'write'])('discloses registration %s failure without navigating', async (failure) => {
    const raw = failure === 'read' ? '[null]' : null;
    if (raw) localStorage.setItem(USERS_KEY, raw);
    mount('/register');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Display Name'), 'Lee');
    await user.type(screen.getByLabelText('Username'), 'lee');
    await user.type(screen.getByLabelText('Password', { exact: true }), 'demo');
    await user.type(screen.getByLabelText('Confirm Password'), 'demo');
    const original = Storage.prototype.setItem;
    if (failure !== 'read') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === (failure === 'partial' ? SESSION_KEY : USERS_KEY)) throw Error('quota');
      return original.call(this, key, value);
    });
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(screen.getByRole('heading', { name: 'Create your space' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'All Blogs' })).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(failure === 'partial' ? 'Your account was saved, but signing in failed. Please use Login' : failure === 'read' ? 'No account was created' : 'Could not save to local storage');
    expect(screen.getByLabelText('Username')).toHaveValue('lee');
    expect(getSession()).toBeNull();
    if (failure === 'partial') expect(getUsers()).toMatchObject([{ username: 'lee', password: 'demo' }]);
    else expect(localStorage.getItem(USERS_KEY)).toBe(raw);
  });
  it('reports login session write failure without navigating', async () => {
    mount('/login');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Username'), 'admin');
    await user.type(screen.getByLabelText('Password'), 'admin');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota'); });
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save to local storage');
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(getSession()).toBeNull();
  });
  it('shows guest landing and newest valid three previews', () => {
    savePosts([1, ...[1, 2, 3, 4].map((n) => ({ id: String(n), title: `Story ${n}`, content: `Text ${n}`, createdAt: `2024-01-0${n}T00:00:00Z` }))]);
    mount();
    expect(screen.getByText('Your thoughts. Your space. Beautifully simple.')).toBeInTheDocument();
    expect(screen.getByText('Story 4')).toBeInTheDocument();
    expect(screen.queryByText('Story 1')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start Reading' })).toHaveAttribute('href', '/login');
  });
  it('shows empty landing and redirects guests on protected paths', () => {
    mount('/admin');
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    cleanup(); mount('/');
    expect(screen.getByText('No posts yet — check back soon!')).toBeInTheDocument();
  });
  it('rejects the wrong role before rendering an admin child', () => {
    render(<MemoryRouter initialEntries={['/secret']}><Routes><Route path="/secret" element={<ProtectedRoute session={userSession} adminOnly><p>Secret</p></ProtectedRoute>} /><Route path="/blogs" element={<p>Blogs destination</p>} /></Routes></MemoryRouter>);
    expect(screen.getByText('Blogs destination')).toBeInTheDocument();
    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
  });
  it('validates a form and registers, reloads, logs out and logs back in', async () => {
    const user = userEvent.setup(); mount('/register');
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(screen.getByText('Display Name is required.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Display Name'), 'Lee');
    await user.type(screen.getByLabelText('Username'), 'lee');
    await user.type(screen.getByLabelText('Password', { exact: true }), 'demo');
    await user.type(screen.getByLabelText('Confirm Password'), 'demo');
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(screen.getByRole('heading', { name: 'All Blogs' })).toBeInTheDocument();
    cleanup(); mount('/blogs');
    await user.click(screen.getByRole('button', { name: /Lee/ }));
    await user.click(screen.getByRole('button', { name: 'Logout' }));
    expect(screen.getByText('Your thoughts. Your space. Beautifully simple.')).toBeInTheDocument();
    expect(getSession()).toBeNull();
    await user.click(screen.getAllByRole('link', { name: 'Login' })[0]);
    await user.type(screen.getByLabelText('Username'), 'lee');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByText('Invalid username or password.')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Password'));
    await user.type(screen.getByLabelText('Password'), 'demo');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(getSession().username).toBe('lee');
  });
  it('keeps UI signed in when logout removal fails', async () => {
    setSession(userSession); mount('/blogs');
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw Error('blocked'); });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Lee/ }));
    await user.click(screen.getByRole('button', { name: 'Logout' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not sign out');
    expect(getSession()).toEqual(userSession);
  });
  it('re-reads session on cross-tab storage events', () => {
    mount('/');
    act(() => { setSession(userSession); window.dispatchEvent(new StorageEvent('storage', { key: SESSION_KEY })); });
    expect(screen.getByRole('link', { name: 'Go to Dashboard' })).toHaveAttribute('href', '/blogs');
    act(() => { clearSession(); window.dispatchEvent(new StorageEvent('storage', { key: SESSION_KEY })); });
    expect(screen.getByRole('link', { name: 'Get Started' })).toBeInTheDocument();
  });
});
