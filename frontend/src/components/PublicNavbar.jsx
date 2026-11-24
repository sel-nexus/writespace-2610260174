/** Show public navigation and the current identity when available. */
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { roleHome } from '../utils/auth';
import { Avatar } from './Avatar';

export function PublicNavbar({ session }) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-100 bg-white shadow-sm">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4"
      >
        <Link
          className="text-xl font-bold tracking-tight text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
          to="/"
        >
          Write<span className="text-indigo-700">Space</span>
        </Link>
        {session ? (
          <div className="flex items-center gap-3">
            <Avatar role={session.role} />
            <span className="hidden text-sm font-medium text-slate-700 sm:inline">{session.displayName}</span>
            <Link
              className={
                'rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white ' +
                'hover:bg-indigo-800 focus-visible:outline focus-visible:outline-2 ' +
                'focus-visible:outline-offset-2 focus-visible:outline-indigo-700'
              }
              to={roleHome(session)}
            >
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-4 text-sm font-semibold">
            <Link
              className="text-slate-700 hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700"
              to="/login"
            >
              Login
            </Link>
            <Link
              className={
                'rounded-lg bg-indigo-700 px-4 py-2 text-white hover:bg-indigo-800 ' +
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ' +
                'focus-visible:outline-indigo-700'
              }
              to="/register"
            >
              Get Started
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}
PublicNavbar.propTypes = { session: PropTypes.object };
