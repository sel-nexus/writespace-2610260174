/** Manage local accounts without changing the current identity. */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { UserRow } from '../components/UserRow';
import { DEFAULT_ADMIN_ID, getSession } from '../utils/auth';
import { createUser, deleteUser, readUsers, USERS_KEY } from '../utils/storage';

const emptyForm = { displayName: '', username: '', password: '', role: 'user' };
const defaultAdmin = { id: DEFAULT_ADMIN_ID, displayName: 'Admin', username: 'admin', role: 'admin' };

export default function UserManagement({ session }) {
  const [users, setUsers] = useState(readUsers);
  const [form, setForm] = useState(emptyForm);
  const [fields, setFields] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const update = (event) => { if (event.key === USERS_KEY || event.key === null) setUsers(readUsers()); };
    window.addEventListener('storage', update);
    return () => window.removeEventListener('storage', update);
  }, []);
  /** Persist the form first; never report success on a failed operation. */
  function handleCreate(event) {
    event.preventDefault();
    setNotice('');
    const result = createUser(form, getSession);
    if (!result.ok) {
      setFields(result.fields || []);
      setError(result.reason === 'USERNAME_TAKEN' ? 'That username is reserved or already in use.' : result.code === 'VALIDATION' ? 'Please complete all required fields.' : 'Could not create the account. Check your access and local storage.');
      return;
    }
    setFields([]);
    setError('');
    setForm(emptyForm);
    setUsers(readUsers());
    setNotice('Account created.');
  }
  /** Reauthorize the target before and after confirmation. */
  function handleDelete(id) {
    setNotice('');
    setError('');
    const result = deleteUser({ id }, getSession);
    if (result.ok) {
      setUsers(readUsers());
      setNotice('Account deleted. Its posts remain.');
    } else if (result.code !== 'CANCELLED') setError('Could not delete the account. Check your access and local storage.');
  }
  const inputClass = 'mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-700';
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <p className="text-sm font-semibold uppercase tracking-widest text-violet-700">Administration</p>
        <h1 className="mt-3 font-serif text-4xl">User Management</h1>
        <p className="mt-3 text-slate-600">Accounts are stored only in this browser. Use demo credentials only.</p>
        <section className="mt-10 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-serif text-2xl">Create User</h2>
          <form className="mt-5" onSubmit={handleCreate} noValidate>
            {error && <p id="user-error" role="alert" className="mb-4 text-red-800">{error}</p>}
            {notice && <p role="status" className="mb-4 text-green-800">{notice}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              {['displayName', 'username', 'password'].map((name) => (
                <label key={name} className="font-medium" htmlFor={`user-${name}`}>
                  {{ displayName: 'Display Name', username: 'Username', password: 'Password' }[name]}
                  <input id={`user-${name}`} type={name === 'password' ? 'password' : 'text'} value={form[name]} onChange={(event) => setForm({ ...form, [name]: event.target.value })} required aria-required="true" aria-invalid={fields.includes(name)} aria-describedby={fields.includes(name) ? 'user-error' : undefined} className={inputClass} />
                </label>
              ))}
              <label className="font-medium" htmlFor="user-role">
                Role
                <select id="user-role" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className={inputClass}>
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </label>
            </div>
            <button type="submit" className="mt-5 rounded-lg bg-indigo-700 px-5 py-3 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700">Create User</button>
          </form>
        </section>
        <section className="mt-10">
          <h2 className="font-serif text-2xl">Accounts</h2>
          {!users.ok && <p role="alert" className="mt-4 text-red-800">Accounts could not be read from local storage.</p>}
          <ul className="mt-4 rounded-xl border border-slate-200 bg-white px-5">
            <UserRow user={defaultAdmin} isDefault isCurrent={session?.userId === DEFAULT_ADMIN_ID} onDelete={handleDelete} />
            {users.ok && users.value.map((user) => <UserRow key={user.id} user={user} isCurrent={session?.userId === user.id} onDelete={handleDelete} />)}
          </ul>
        </section>
      </div>
    </main>
  );
}
UserManagement.propTypes = { session: PropTypes.object };
