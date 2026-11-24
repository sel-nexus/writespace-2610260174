/** Local demonstration identity: these client-side roles are not security. */
import { getUsers, readCollection, saveUsers, SESSION_KEY, USERS_KEY, writeValue } from './storage';

export const DEFAULT_ADMIN_ID = 'default-admin';
const admin = { userId: DEFAULT_ADMIN_ID, username: 'admin', displayName: 'Admin', role: 'admin' };
const present = (value) => typeof value === 'string' && value.trim().length > 0;
const validRole = (role) => role === 'user' || role === 'admin';

/** Validate the fields needed to use an identity in the interface. */
export function validSession(value) {
  return Boolean(value && typeof value === 'object' && present(value.userId) && present(value.username) && present(value.displayName) && validRole(value.role));
}

/** Read a valid session, treating inaccessible or malformed data as signed out. */
export function getSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    const value = raw === null ? null : JSON.parse(raw);
    return validSession(value) ? value : null;
  } catch {
    return null;
  }
}

/** Persist a valid session or report failure. */
export function setSession(session) {
  if (!validSession(session)) return { ok: false, code: 'VALIDATION' };
  return writeValue(SESSION_KEY, session);
}

/** Remove the session without touching other local data. */
export function clearSession() {
  try {
    window.localStorage.removeItem(SESSION_KEY);
    return { ok: true, value: null };
  } catch {
    return { ok: false, code: 'STORAGE_WRITE_FAILED' };
  }
}

/** Choose the destination for the current role. */
export function roleHome(session) { return session?.role === 'admin' ? '/admin' : '/blogs'; }

/** Validate stored account data before it can affect a mutation. */
function validUser(user) {
  return Boolean(user && typeof user === 'object' && present(user.id) && present(user.displayName) && present(user.username) && present(user.password) && validRole(user.role) && present(user.createdAt));
}

/** Authenticate literal credentials and persist the resulting session. */
export function login({ username, password }) {
  let session;
  // The built-in credential is intentionally public and demo-only.
  if (username === 'admin' && password === 'admin') session = { ...admin };
  else {
    const user = getUsers().find((item) => validUser(item) && item.username === username && item.password === password && item.username !== 'admin');
    if (!user) return { ok: false, code: 'INVALID_CREDENTIALS' };
    session = { userId: user.id, username: user.username, displayName: user.displayName, role: user.role };
  }
  const saved = setSession(session);
  return saved.ok ? { ok: true, value: session } : saved;
}

/** Create a local user, then persist its session; disclose partial success. */
export function register(input) {
  const fields = ['displayName', 'username', 'password', 'confirmPassword'].filter((name) => !present(input[name]));
  if (present(input.password) && present(input.confirmPassword) && input.password !== input.confirmPassword) fields.push('confirmPassword');
  if (fields.length) return { ok: false, code: 'VALIDATION', fields };
  const users = readCollection(USERS_KEY);
  if (!users.ok || !users.value.every(validUser)) return { ok: false, code: 'STORAGE_READ_FAILED' };
  if (input.username === 'admin' || users.value.some((user) => user.username === input.username)) {
    return { ok: false, code: 'VALIDATION', fields: ['username'], reason: 'USERNAME_TAKEN' };
  }
  let id;
  try { id = crypto.randomUUID(); } catch { return { ok: false, code: 'STORAGE_WRITE_FAILED' }; }
  if (users.value.some((user) => user.id === id)) return { ok: false, code: 'STORAGE_WRITE_FAILED' };
  const user = { id, displayName: input.displayName, username: input.username, password: input.password, role: 'user', createdAt: new Date().toISOString() };
  const saved = saveUsers([...users.value, user]);
  if (!saved.ok) return saved;
  const session = { userId: user.id, username: user.username, displayName: user.displayName, role: user.role };
  if (!setSession(session).ok) return { ok: false, code: 'PARTIAL_REGISTRATION' };
  return { ok: true, value: session };
}

/** Remove the session and return the actual storage result. */
export function logout() { return clearSession(); }
