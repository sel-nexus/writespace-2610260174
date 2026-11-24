/** Provide a controlled form that saves only after validation and persistence. */
import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { getSession } from '../utils/auth';
import { canMutatePost, createPost, readPosts, updatePost } from '../utils/storage';

export default function WriteBlog() {
  const { id } = useParams();
  const editing = id !== undefined;
  const [initial] = useState(() => {
    if (!editing) return { status: 'create' };
    const posts = readPosts();
    if (!posts.ok) return { status: 'error' };
    const post = posts.value.find((item) => item.id === id);
    if (!post) return { status: 'missing' };
    return canMutatePost(getSession(), post) ? { status: 'edit', post } : { status: 'forbidden' };
  });
  const [title, setTitle] = useState(initial.post?.title || '');
  const [content, setContent] = useState(initial.post?.content || '');
  const [fields, setFields] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  /** Preserve the draft unless the complete post is persisted. */
  function handleSubmit(event) {
    event.preventDefault();
    const result = editing
      ? updatePost({ id, title, content }, getSession)
      : createPost({ title, content }, getSession);
    if (!result.ok) {
      setFields(result.fields || []);
      setError(
        result.code === 'VALIDATION'
          ? ''
          : result.code === 'UNAUTHENTICATED'
            ? 'Your session is no longer available. Sign in before saving.'
            : 'Could not save this post to local storage. Your draft is still here.',
      );
      return;
    }
    navigate(`/blog/${encodeURIComponent(result.value.id)}`);
  }
  if (initial.status === 'forbidden') return <Navigate to="/blogs" replace />;
  if (initial.status === 'missing' || initial.status === 'error')
    return (
      <main className="mx-auto max-w-3xl px-5 py-14">
        {initial.status === 'missing' ? (
          <h1 className="font-serif text-4xl">Post not found</h1>
        ) : (
          <p role="alert" className="text-red-800">
            Posts could not be read from local storage.
          </p>
        )}
        <Link to="/blogs" className="mt-6 inline-block font-semibold text-indigo-700 underline">
          Back to All Posts
        </Link>
      </main>
    );
  return (
    <main className="mx-auto max-w-3xl px-5 py-14">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-700">Make space for an idea</p>
      <h1 className="mt-3 font-serif text-4xl">{editing ? 'Edit post' : 'Write a post'}</h1>
      <form className="mt-10 space-y-6" onSubmit={handleSubmit} noValidate>
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
            {error}
          </p>
        )}
        <div>
          <label htmlFor="post-title" className="block font-semibold">
            Title
          </label>
          <input
            id="post-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-required="true"
            aria-invalid={fields.includes('title')}
            aria-describedby={fields.includes('title') ? 'title-error' : undefined}
            className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
          {fields.includes('title') && (
            <p id="title-error" role="alert" className="mt-2 text-sm text-red-700">
              Title is required.
            </p>
          )}
        </div>
        <div>
          <label htmlFor="post-content" className="block font-semibold">
            Content
          </label>
          <textarea
            id="post-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            aria-required="true"
            aria-invalid={fields.includes('content')}
            aria-describedby={fields.includes('content') ? 'content-error content-count' : 'content-count'}
            className="mt-2 min-h-[256px] w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
          <p id="content-count" className="mt-1 text-sm text-slate-600">
            {content.length} characters
          </p>
          {fields.includes('content') && (
            <p id="content-error" role="alert" className="mt-2 text-sm text-red-700">
              Content is required.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            className={
              'rounded-lg bg-indigo-700 px-5 py-3 font-semibold text-white hover:bg-indigo-800 ' +
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ' +
              'focus-visible:outline-indigo-700'
            }
          >
            Save
          </button>
          <Link
            to="/blogs"
            className={
              'rounded-lg px-4 py-3 font-semibold text-slate-700 hover:bg-slate-100 ' +
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700'
            }
          >
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
