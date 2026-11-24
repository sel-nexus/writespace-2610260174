/** Present the public entry and the latest readable local post previews. */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { getPosts, POSTS_KEY } from '../utils/storage';

/** Keep malformed local records from breaking the public view. */
function previews() {
  return getPosts().filter((p) => p && typeof p.id === 'string' && typeof p.title === 'string' && typeof p.content === 'string' && typeof p.createdAt === 'string' && Number.isFinite(Date.parse(p.createdAt)))
    .slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 3);
}

export default function LandingPage({ session }) {
  const [posts, setPosts] = useState(previews);
  useEffect(() => {
    const update = (event) => { if (event.key === POSTS_KEY || event.key === null) setPosts(previews()); };
    window.addEventListener('storage', update);
    return () => window.removeEventListener('storage', update);
  }, []);
  return (
    <main>
      <section className="bg-indigo-50">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 md:grid-cols-2 md:py-28">
          <div>
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.22em] text-indigo-700">A little room for big ideas</p>
            <h1 className="font-serif text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl">WriteSpace</h1>
            <p className="mt-5 max-w-lg text-2xl leading-snug text-slate-700">Your thoughts. Your space. Beautifully simple.</p>
            <p className="mt-5 max-w-md leading-7 text-slate-600">A quiet place to put your ideas into words, right in your browser.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="rounded-lg bg-indigo-700 px-5 py-3 font-semibold text-white hover:bg-indigo-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700" to={session ? '/blogs' : '/login'}>Start Reading</Link>
              <Link className="rounded-lg border border-indigo-200 bg-white px-5 py-3 font-semibold text-indigo-800 hover:bg-indigo-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700" to="/register">Get Started Free</Link>
            </div>
          </div>
          <div aria-hidden="true" className="mx-auto w-full max-w-sm rotate-2 rounded-2xl border border-indigo-100 bg-white p-8 shadow-xl shadow-indigo-200/60">
            <div className="mb-7 flex gap-1.5"><span className="h-2 w-2 rounded-full bg-indigo-300" /><span className="h-2 w-2 rounded-full bg-indigo-200" /><span className="h-2 w-2 rounded-full bg-indigo-100" /></div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-700">A new page</p>
            <p className="mt-3 font-serif text-3xl text-slate-800">The beginning of something.</p>
            <div className="mt-6 space-y-3"><div className="h-2 rounded bg-slate-100" /><div className="h-2 rounded bg-slate-100" /><div className="h-2 w-3/4 rounded bg-slate-100" /></div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 py-20" aria-labelledby="features-heading">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-700">Made for your words</p>
        <h2 id="features-heading" className="mt-3 font-serif text-4xl text-slate-900">Less noise, more writing.</h2>
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          <div><p className="text-sm font-bold text-indigo-700">01</p><h3 className="mt-3 text-xl font-semibold">Write Freely</h3><p className="mt-2 leading-7 text-slate-600">Give your ideas room to grow in a simple, focused space.</p></div>
          <div><p className="text-sm font-bold text-indigo-700">02</p><h3 className="mt-3 text-xl font-semibold">Private &amp; Local</h3><p className="mt-2 leading-7 text-slate-600">Your demo data stays in this browser. It is not secure or shared.</p></div>
          <div><p className="text-sm font-bold text-indigo-700">03</p><h3 className="mt-3 text-xl font-semibold">Instant &amp; Fast</h3><p className="mt-2 leading-7 text-slate-600">Open your space and pick up where you left off.</p></div>
        </div>
      </section>
      <section className="bg-slate-50 py-20" aria-labelledby="latest-heading">
        <div className="mx-auto max-w-6xl px-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-700">From this browser</p>
          <h2 id="latest-heading" className="mt-3 font-serif text-4xl text-slate-900">Latest stories</h2>
          {posts.length === 0 ? <p className="mt-8 text-slate-600">No posts yet — check back soon!</p> : (
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <article key={post.id} className="rounded-xl border border-slate-200 bg-white p-6">
                  <time className="text-sm text-slate-600" dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}</time>
                  <h3 className="mt-3 text-xl font-semibold text-slate-900"><Link className="hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700" to={`/blog/${encodeURIComponent(post.id)}`}>{post.title}</Link></h3>
                  <p className="mt-3 break-words leading-7 text-slate-600">{post.content.slice(0, 120)}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
      <footer className="bg-slate-900 text-slate-200">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-5 py-8">
          <p>© {new Date().getFullYear()} WriteSpace</p>
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-5 text-sm">
            <Link to="/">Home</Link><Link to="/blogs">All Blogs</Link><Link to="/login">Login</Link><Link to="/register">Register</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
LandingPage.propTypes = { session: PropTypes.object };
