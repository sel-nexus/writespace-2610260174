/** Safely read and write the browser-local collections. */
export const USERS_KEY = 'writespace_users';
export const POSTS_KEY = 'writespace_posts';
export const SESSION_KEY = 'writespace_session';

/** Read a collection without confusing a failed read with a missing key.
 * @param {string} key Storage key.
 * @returns {object} A status and array, or a read failure.
 */
export function readCollection(key) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return { ok: true, value: [] };
    const value = JSON.parse(raw);
    return Array.isArray(value) ? { ok: true, value } : { ok: false, code: 'STORAGE_READ_FAILED' };
  } catch {
    return { ok: false, code: 'STORAGE_READ_FAILED' };
  }
}

/** Return a collection or an empty read-only fallback. */
function getCollection(key) {
  const result = readCollection(key);
  return result.ok ? result.value : [];
}

/** Return local posts, falling back to an empty array on read failure. */
export function getPosts() { return getCollection(POSTS_KEY); }
/** Return local users, falling back to an empty array on read failure. */
export function getUsers() { return getCollection(USERS_KEY); }

/** Save a value and report serialization or storage failure. */
export function writeValue(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return { ok: true, value: null };
  } catch {
    return { ok: false, code: 'STORAGE_WRITE_FAILED' };
  }
}

/** Save a collection of posts. */
export function savePosts(posts) { return writeValue(POSTS_KEY, posts); }
/** Save a collection of users. */
export function saveUsers(users) { return writeValue(USERS_KEY, users); }
