/** Compose the identity routes and synchronize local sessions across tabs. */
import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { PublicNavbar } from './components/PublicNavbar';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Home from './pages/Home';
import ReadBlog from './pages/ReadBlog';
import WriteBlog from './pages/WriteBlog';
import { getSession, logout, roleHome } from './utils/auth';
import { SESSION_KEY } from './utils/storage';

/** Explain routes outside the delivered identity slice without pretending they exist. */
function Unavailable() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-20">
      <h1 className="font-serif text-3xl text-slate-900">Page not available</h1>
      <p className="mt-4 text-slate-600">This part of WriteSpace is not included in this identity preview.</p>
      <Link to="/" className="mt-6 inline-block font-semibold text-indigo-700 underline">Return home</Link>
    </main>
  );
}

export default function App() {
  const [session, setSession] = useState(getSession);
  const [error, setError] = useState('');
  const [signedOut, setSignedOut] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const update = (event) => { if (event.key === SESSION_KEY || event.key === null) setSession(getSession()); };
    window.addEventListener('storage', update);
    return () => window.removeEventListener('storage', update);
  }, []);
  useEffect(() => {
    if (location.pathname === '/') setSignedOut(false);
  }, [location.pathname]);
  /** Keep the current session visible if the storage removal fails. */
  function handleLogout() {
    const result = logout();
    if (!result.ok) { setError('Could not sign out: local storage removal failed. Please try again.'); return; }
    setError('');
    setSignedOut(true);
    setSession(null);
    navigate('/');
  }
  const publicNav = location.pathname === '/' || !session;
  const authPage = (page) => session ? <Navigate to={roleHome(session)} replace /> : page;
  const protectedPage = (page, adminOnly = false) => signedOut && !session ? <Navigate to="/" replace /> : <ProtectedRoute session={session} adminOnly={adminOnly}>{page}</ProtectedRoute>;
  const acceptSession = (value) => { setSignedOut(false); setSession(value); };
  return (
    <div className="min-h-screen bg-white text-slate-900">
      {publicNav ? <PublicNavbar session={session} /> : <Navbar session={session} onLogout={handleLogout} />}
      {error && <p role="alert" className="mx-auto max-w-6xl bg-red-50 px-5 py-3 text-red-800">{error}</p>}
      <Routes>
        <Route path="/" element={<LandingPage session={session} />} />
        <Route path="/login" element={authPage(<LoginPage onSessionChange={acceptSession} />)} />
        <Route path="/register" element={authPage(<RegisterPage onSessionChange={acceptSession} />)} />
        <Route path="/blogs" element={protectedPage(<Home session={session} />)} />
        <Route path="/blog/:id" element={protectedPage(<ReadBlog session={session} />)} />
        <Route path="/write" element={protectedPage(<WriteBlog key={location.pathname} />)} />
        <Route path="/edit/:id" element={protectedPage(<WriteBlog key={location.pathname} />)} />
        <Route path="/admin" element={protectedPage(<Unavailable />, true)} />
        <Route path="/users" element={protectedPage(<Unavailable />, true)} />
        <Route path="*" element={<Unavailable />} />
      </Routes>
    </div>
  );
}
