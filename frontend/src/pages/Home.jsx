/** Display the newest local posts for signed-in readers. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BlogCard, authorRole } from '../components/BlogCard';
import { getUsers, POSTS_KEY, readPosts, USERS_KEY } from '../utils/storage';

/** Read the current post and author snapshots. */
function snapshot() {
  return { posts: readPosts(), users: getUsers() };
}

export default function Home({ session }) {
  const [data, setData] = useState(snapshot);
  useEffect(() => {
    const update = (event) => {
      if (event.key === POSTS_KEY || event.key === USERS_KEY || event.key === null) setData(snapshot());
    };
    window.addEventListener('storage', update);
    return () => window.removeEventListener('storage', update);
  }, []);
  const posts = data.posts.ok
    ? [...data.posts.value].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    : [];
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-700">From this browser</p>
            <h1 className="mt-3 font-serif text-4xl text-slate-900">All Blogs</h1>
          </div>
          <Link
            to="/write"
            className={
              'rounded-lg bg-indigo-700 px-5 py-3 font-semibold text-white hover:bg-indigo-800 ' +
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ' +
              'focus-visible:outline-indigo-700'
            }
          >
            Write a post
          </Link>
        </div>
        {!data.posts.ok ? (
          <p role="alert" className="mt-10 text-red-800">
            Posts could not be read from local storage.
          </p>
        ) : posts.length === 0 ? (
          <p className="mt-10 text-slate-600">No blogs yet. Be the first to write one!</p>
        ) : (
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post, index) => (
              <BlogCard
                key={post.id}
                post={post}
                index={index}
                role={authorRole(post.authorId, data.users)}
                session={session}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
