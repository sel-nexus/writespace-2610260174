/** Read a local post as plain text or offer a route back. */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { authorRole, postDate } from '../components/BlogCard';
import { getSession } from '../utils/auth';
import { canMutatePost, deletePost, getUsers, POSTS_KEY, readPosts, USERS_KEY } from '../utils/storage';

/** Read the current post and author snapshots. */
function snapshot() {
  return { posts: readPosts(), users: getUsers() };
}

export default function ReadBlog({ session }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(snapshot);
  const [error, setError] = useState('');
  useEffect(() => {
    const update = (event) => {
      if (event.key === POSTS_KEY || event.key === USERS_KEY || event.key === null) setData(snapshot());
    };
    window.addEventListener('storage', update);
    return () => window.removeEventListener('storage', update);
  }, []);
  const post = data.posts.ok ? data.posts.value.find((item) => item.id === id) : null;
  /** Leave the reader unchanged unless the deletion is committed. */
  function handleDelete() {
    const result = deletePost({ id }, getSession);
    if (result.ok) navigate('/blogs');
    else if (result.code !== 'CANCELLED') setError('Could not delete this post. It may be unavailable or you may no longer have permission.');
  }
  return (
    <main className="mx-auto max-w-3xl px-5 py-14">
      <Link to="/blogs" className="font-semibold text-indigo-700 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700">Back to All Posts</Link>
      {error && <p role="alert" className="mt-6 text-red-800">{error}</p>}
      {!data.posts.ok ? <p role="alert" className="mt-8 text-red-800">Posts could not be read from local storage.</p> : !post ? (
        <h1 className="mt-8 font-serif text-4xl">Post not found</h1>
      ) : (
        <article className="mt-10">
          <h1 className="break-words font-serif text-4xl font-semibold sm:text-5xl">{post.title}</h1>
          <div className="mt-6 flex items-center gap-3 text-sm text-slate-600">
            <Avatar role={authorRole(post.authorId, data.users)} />
            <span>{post.authorName}</span>
            <time dateTime={post.createdAt}>{postDate(post.createdAt)}</time>
          </div>
          <div className="mt-10 whitespace-pre-wrap break-words text-lg leading-8 text-slate-800">{post.content}</div>
          {canMutatePost(session, post) && (
            <div className="mt-8 flex gap-4">
              <Link to={`/edit/${encodeURIComponent(post.id)}`} className="font-semibold text-indigo-700 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700">Edit</Link>
              <button type="button" onClick={handleDelete} className="font-semibold text-red-700 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-700">Delete</button>
            </div>
          )}
        </article>
      )}
    </main>
  );
}
