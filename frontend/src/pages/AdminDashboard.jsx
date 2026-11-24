/** Show account counts and recent posts for local administrators. */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { StatCard } from '../components/StatCard';
import { postDate } from '../components/BlogCard';
import { getSession } from '../utils/auth';
import { deletePost, POSTS_KEY, readPosts, readUsers, USERS_KEY } from '../utils/storage';

/** Read status-aware snapshots without treating corrupt data as zero. */
function snapshot() {
  return { posts: readPosts(), users: readUsers() };
}

export default function AdminDashboard() {
  const [data, setData] = useState(snapshot);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  useEffect(() => {
    const update = (event) => {
      if (event.key === POSTS_KEY || event.key === USERS_KEY || event.key === null) setData(snapshot());
    };
    window.addEventListener('storage', update);
    return () => window.removeEventListener('storage', update);
  }, []);
  const posts = data.posts.ok ? [...data.posts.value].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 5) : [];
  const users = data.users.ok ? data.users.value : [];
  /** Navigate only after the shared confirmed deletion succeeds. */
  function handleDelete(id) {
    setError('');
    const result = deletePost({ id }, getSession);
    if (result.ok) navigate('/blogs');
    else if (result.code !== 'CANCELLED') setError('Could not delete this post. It may be unavailable or you may no longer have permission.');
  }
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
        <div className="mx-auto max-w-6xl px-5 py-12">
          <p className="text-sm font-semibold uppercase tracking-widest">WriteSpace administration</p>
          <h1 className="mt-3 font-serif text-4xl">Admin Dashboard</h1>
          <p className="mt-3 text-violet-100">An overview of this browser’s writing community.</p>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-5 py-10">
        {(!data.posts.ok || !data.users.ok) && <p role="alert" className="mb-6 text-red-800">Some local data could not be read. Counts may be unavailable.</p>}
        <section aria-label="Overview" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Posts" value={data.posts.ok ? data.posts.value.length : '—'} />
          <StatCard label="Total Users" value={data.users.ok ? users.length + 1 : '—'} />
          <StatCard label="Total Admins" value={data.users.ok ? users.filter((user) => user.role === 'admin').length + 1 : '—'} />
          <StatCard label="Total users" value={data.users.ok ? users.filter((user) => user.role === 'user').length : '—'} />
        </section>
        <section className="mt-10">
          <h2 className="font-serif text-2xl">Quick actions</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/write" className="rounded-lg bg-indigo-700 px-5 py-3 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700">Write New Post</Link>
            <Link to="/users" className="rounded-lg border border-indigo-700 px-5 py-3 font-semibold text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700">Manage Users</Link>
          </div>
        </section>
        <section className="mt-12">
          <h2 className="font-serif text-2xl">Recent posts</h2>
          {error && <p role="alert" className="mt-4 text-red-800">{error}</p>}
          {data.posts.ok && posts.length === 0 && <p className="mt-4 text-slate-600">No posts yet.</p>}
          <ul className="mt-4 rounded-xl border border-slate-200 bg-white px-5">
            {posts.map((post) => (
              <li key={post.id} className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 py-5 last:border-0">
                <div className="min-w-0 break-words">
                  <Link to={`/blog/${encodeURIComponent(post.id)}`} className="font-semibold text-indigo-700 underline">{post.title}</Link>
                  <p className="mt-1 text-sm text-slate-600">{post.authorName} · <time dateTime={post.createdAt}>{postDate(post.createdAt)}</time></p>
                </div>
                <div className="flex gap-4">
                  <Link to={`/edit/${encodeURIComponent(post.id)}`} aria-label={`Edit ${post.title}`} className="font-semibold text-indigo-700 underline">Edit</Link>
                  <button type="button" aria-label={`Delete ${post.title}`} onClick={() => handleDelete(post.id)} className="font-semibold text-red-700 underline">Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
