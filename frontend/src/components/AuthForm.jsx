/** Render accessible controlled fields for the local identity flows. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate } from 'react-router-dom';
import { login, register, roleHome } from '../utils/auth';

const labels = { displayName: 'Display Name', username: 'Username', password: 'Password', confirmPassword: 'Confirm Password' };

export function AuthForm({ mode, onSessionChange }) {
  const isRegister = mode === 'register';
  const fields = isRegister ? ['displayName', 'username', 'password', 'confirmPassword'] : ['username', 'password'];
  const [values, setValues] = useState({ displayName: '', username: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  /** Validate input and navigate only after the session was saved. */
  function submit(event) {
    event.preventDefault();
    const missing = fields.filter((name) => !values[name].trim());
    if (missing.length) {
      setErrors(Object.fromEntries(missing.map((name) => [name, `${labels[name]} is required.`])));
      setMessage('');
      return;
    }
    const result = isRegister ? register(values) : login(values);
    if (result.ok) {
      onSessionChange(result.value);
      navigate(roleHome(result.value), { replace: true });
      return;
    }
    const nextErrors = {};
    if (result.code === 'VALIDATION') {
      for (const field of result.fields || []) {
        nextErrors[field] = result.reason === 'USERNAME_TAKEN' ? 'That username is reserved or already in use.' : field === 'confirmPassword' ? 'Passwords must match.' : `${labels[field]} is required.`;
      }
    }
    setErrors(nextErrors);
    setMessage(result.code === 'INVALID_CREDENTIALS' ? 'Invalid username or password.' : result.code === 'PARTIAL_REGISTRATION' ? 'Your account was saved, but signing in failed. Please use Login with your saved credentials.' : result.code === 'STORAGE_READ_FAILED' ? 'Local account data could not be read safely. No account was created.' : result.code === 'STORAGE_WRITE_FAILED' ? 'Could not save to local storage. Please check browser storage and try again.' : '');
  }
  return (
    <main className="flex min-h-[calc(100vh-73px)] items-center justify-center bg-indigo-50 px-5 py-12">
      <div className="w-full max-w-md rounded-2xl border border-indigo-100 bg-white p-7 shadow-xl shadow-indigo-100 sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-700">WriteSpace</p>
        <h1 className="mt-3 font-serif text-4xl text-slate-900">{isRegister ? 'Create your space' : 'Welcome back'}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{isRegister ? 'Start with a local demo account.' : 'Sign in to your local demo account.'}</p>
        {!isRegister && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">Demo admin: <strong>admin</strong> / <strong>admin</strong></p>}
        <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
          {fields.map((field) => (
            <div key={field}>
              <label className="block text-sm font-semibold text-slate-800" htmlFor={field}>{labels[field]}</label>
              <input id={field} name={field} type={field.toLowerCase().includes('password') ? 'password' : 'text'} autoComplete={field === 'confirmPassword' ? 'new-password' : field === 'password' ? (isRegister ? 'new-password' : 'current-password') : field === 'username' ? 'username' : 'name'} value={values[field]} onChange={(event) => setValues({ ...values, [field]: event.target.value })} aria-required="true" aria-invalid={Boolean(errors[field])} aria-describedby={errors[field] ? `${field}-error` : undefined} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 focus:border-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              {errors[field] && <p id={`${field}-error`} role="alert" className="mt-1 text-sm text-red-700">{errors[field]}</p>}
            </div>
          ))}
          {message && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{message}</p>}
          <button className="w-full rounded-lg bg-indigo-700 px-4 py-3 font-semibold text-white hover:bg-indigo-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700" type="submit">{isRegister ? 'Register' : 'Login'}</button>
        </form>
        <p className="mt-6 text-sm text-slate-600">{isRegister ? 'Already have an account?' : 'New to WriteSpace?'}{' '}<Link className="font-semibold text-indigo-700 underline underline-offset-2" to={isRegister ? '/login' : '/register'}>{isRegister ? 'Login' : 'Register'}</Link></p>
      </div>
    </main>
  );
}
AuthForm.propTypes = { mode: PropTypes.oneOf(['login', 'register']).isRequired, onSessionChange: PropTypes.func.isRequired };
