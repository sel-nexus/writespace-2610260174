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

/** Check the fields needed to safely display and preserve a post. */
export function validPost(post) {
  const present = (value) => typeof value === 'string' && value.trim().length > 0;
  return Boolean(post && typeof post === 'object' && !Array.isArray(post)
    && present(post.id) && present(post.title) && present(post.content)
    && present(post.authorId) && present(post.authorName) && present(post.createdAt)
    && Number.isFinite(Date.parse(post.createdAt)));
}

/** Read posts only when every record and identifier can be safely retained. */
export function readPosts() {
  const result = readCollection(POSTS_KEY);
  if (!result.ok) return result;
  const ids = new Set();
  for (const post of result.value) {
    if (!validPost(post) || ids.has(post.id)) return { ok: false, code: 'STORAGE_READ_FAILED' };
    ids.add(post.id);
  }
  return result;
}

/** Persist a new post using a fresh session supplied by the caller.
 * @param {object} input The entered title and plain-text content.
 * @param {Function} getSession Read and validate the current persisted identity.
 * @returns {object} The saved post or a failure without a successful write.
 */
export function createPost(input, getSession) {
  const fields = ['title', 'content'].filter((key) => typeof input?.[key] !== 'string' || !input[key].trim());
  if (fields.length) return { ok: false, code: 'VALIDATION', fields };
  const session = typeof getSession === 'function' ? getSession() : null;
  if (!session || typeof session.userId !== 'string' || !session.userId.trim()
    || typeof session.username !== 'string' || !session.username.trim()
    || typeof session.displayName !== 'string' || !session.displayName.trim()
    || !['user', 'admin'].includes(session.role)) return { ok: false, code: 'UNAUTHENTICATED' };
  const posts = readPosts();
  if (!posts.ok) return posts;
  let id;
  let createdAt;
  try {
    id = crypto.randomUUID();
    createdAt = new Date().toISOString();
  } catch {
    return { ok: false, code: 'STORAGE_WRITE_FAILED' };
  }
  if (typeof id !== 'string' || !id.trim() || posts.value.some((post) => post.id === id)) {
    return { ok: false, code: 'STORAGE_WRITE_FAILED' };
  }
  const post = { id, title: input.title, content: input.content, createdAt, authorId: session.userId, authorName: session.displayName };
  const saved = savePosts([...posts.value, post]);
  return saved.ok ? { ok: true, value: post } : saved;
}

/** Check demo-only ownership; local roles are not a security boundary. */
export function canMutatePost(session, post) {
  const present = (value) => typeof value === 'string' && value.trim().length > 0;
  return Boolean(session && present(session.userId) && present(session.username)
    && present(session.displayName) && ['user', 'admin'].includes(session.role)
    && validPost(post) && (session.role === 'admin' || post.authorId === session.userId));
}

/** Read the current identity and collection before authorizing a mutation. */
function mutationTarget(id, getSession) {
  const session = typeof getSession === 'function' ? getSession() : null;
  if (!session || typeof session.userId !== 'string' || !session.userId.trim()
    || typeof session.username !== 'string' || !session.username.trim()
    || typeof session.displayName !== 'string' || !session.displayName.trim()
    || !['user', 'admin'].includes(session.role)) return { ok: false, code: 'UNAUTHENTICATED' };
  const posts = readPosts();
  if (!posts.ok) return posts;
  const post = posts.value.find((item) => item.id === id);
  if (!post) return { ok: false, code: 'NOT_FOUND' };
  if (!canMutatePost(session, post)) return { ok: false, code: 'FORBIDDEN' };
  return { ok: true, value: { post, posts: posts.value } };
}

/** Persist only editable fields of an authorized current post. */
export function updatePost(input, getSession) {
  const fields = ['title', 'content'].filter((key) => typeof input?.[key] !== 'string' || !input[key].trim());
  if (fields.length) return { ok: false, code: 'VALIDATION', fields };
  const target = mutationTarget(input.id, getSession);
  if (!target.ok) return target;
  const updated = { ...target.value.post, title: input.title, content: input.content };
  const saved = savePosts(target.value.posts.map((post) => post.id === input.id ? updated : post));
  return saved.ok ? { ok: true, value: updated } : saved;
}

/** Confirm and reauthorize deletion against freshly read local data. */
export function deletePost(input, getSession, confirm = (message) => window.confirm(message)) {
  const target = mutationTarget(input?.id, getSession);
  if (!target.ok) return target;
  if (!confirm('Delete this post?')) return { ok: false, code: 'CANCELLED' };
  const current = mutationTarget(input?.id, getSession);
  if (!current.ok) return current;
  return savePosts(current.value.posts.filter((post) => post.id !== input.id));
}
