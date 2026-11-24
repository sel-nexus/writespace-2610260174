/** Present a readable summary of one local post. */
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Avatar } from './Avatar';
import { DEFAULT_ADMIN_ID } from '../utils/auth';
import { canMutatePost } from '../utils/storage';

/** Resolve a role only when the current account data supports it. */
export function authorRole(authorId, users) {
  if (authorId === DEFAULT_ADMIN_ID) return 'admin';
  const matches = users.filter((user) => user && user.id === authorId);
  return matches.length === 1 && ['admin', 'user'].includes(matches[0].role) ? matches[0].role : undefined;
}

/** Format a valid post timestamp in the same style as the public previews. */
export function postDate(value) {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

export function BlogCard({ post, index, role, session }) {
  const borders = ['border-indigo-500', 'border-violet-500', 'border-pink-500', 'border-teal-500'];
  return (
    <article
      className={`rounded-xl border border-slate-200 border-t-4 ${borders[index % borders.length]} bg-white p-6`}
    >
      <time className="text-sm text-slate-600" dateTime={post.createdAt}>
        {postDate(post.createdAt)}
      </time>
      <h2 className="mt-3 break-words font-serif text-2xl font-semibold">
        <Link
          className="hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700"
          to={`/blog/${encodeURIComponent(post.id)}`}
        >
          {post.title}
        </Link>
      </h2>
      <p className="mt-3 break-words whitespace-pre-wrap leading-7 text-slate-600">
        {post.content.slice(0, 120)}
      </p>
      <div className="mt-6 flex items-center gap-3 text-sm font-medium text-slate-700">
        <Avatar role={role} />
        <span>{post.authorName}</span>
      </div>
      {canMutatePost(session, post) && (
        <Link
          to={`/edit/${encodeURIComponent(post.id)}`}
          aria-label={`Edit ${post.title}`}
          className="mt-4 inline-block font-semibold text-indigo-700 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700"
        >
          Edit
        </Link>
      )}
    </article>
  );
}
BlogCard.propTypes = {
  post: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  role: PropTypes.string,
  session: PropTypes.object,
};
