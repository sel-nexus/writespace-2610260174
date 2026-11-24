/** Render a static, role-aware identity mark. */
import PropTypes from 'prop-types';

export function Avatar({ role }) {
  const color = role === 'admin' ? 'bg-violet-700' : role === 'user' ? 'bg-indigo-600' : 'bg-slate-500';
  return (
    <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-white ${color}`} aria-label={role === 'admin' ? 'Admin' : role === 'user' ? 'Writer' : 'Unknown role'}>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {role === 'admin' ? <path d="M3 8l4 4 5-7 5 7 4-4-2 10H5L3 8z" /> : <path d="M4 5c3-1 5-1 8 1 3-2 5-2 8-1v13c-3-1-5-1-8 1-3-2-5-2-8-1V5zm8 1v13" />}
      </svg>
    </span>
  );
}
Avatar.propTypes = { role: PropTypes.string };
