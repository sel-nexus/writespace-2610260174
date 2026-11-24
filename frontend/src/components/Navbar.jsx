/** Provide responsive navigation and explicit sign-out. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, NavLink } from 'react-router-dom';
import { Avatar } from './Avatar';

export function Navbar({ session, onLogout }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const navClass = ({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700 ${isActive ? 'bg-indigo-100 text-indigo-800' : 'text-slate-700 hover:bg-slate-100'}`;
  return (
    <header className="border-b border-slate-200 bg-white">
      <nav aria-label="Account navigation" className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4">
        <Link className="text-xl font-bold text-slate-900" to="/">Write<span className="text-indigo-700">Space</span></Link>
        <button className="rounded border border-slate-300 px-3 py-2 text-sm sm:hidden" type="button" aria-expanded={mobileOpen} aria-controls="account-links" onClick={() => setMobileOpen(!mobileOpen)}>Menu</button>
        <div id="account-links" className={`${mobileOpen ? 'flex' : 'hidden'} order-last w-full flex-col gap-2 sm:order-none sm:flex sm:w-auto sm:flex-row sm:items-center`}>
          <NavLink className={navClass} to="/blogs">All Blogs</NavLink>
          <NavLink className={navClass} to="/write">Write</NavLink>
          {session.role === 'admin' && <NavLink className={navClass} to="/users">Users</NavLink>}
        </div>
        <div className="relative">
          <button type="button" className="flex items-center gap-2 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700" aria-expanded={accountOpen} onClick={() => setAccountOpen(!accountOpen)}>
            <Avatar role={session.role} />
            <span className="text-sm font-medium text-slate-800">{session.displayName}</span>
            <span aria-hidden="true">⌄</span>
          </button>
          {accountOpen && (
            <div className="absolute right-0 z-20 mt-2 w-36 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
              <button type="button" onClick={onLogout} className="w-full rounded px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700">Logout</button>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
Navbar.propTypes = { session: PropTypes.object.isRequired, onLogout: PropTypes.func.isRequired };
