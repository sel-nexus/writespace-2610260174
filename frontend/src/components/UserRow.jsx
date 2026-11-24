/** Display a local account and its guarded delete action. */
import PropTypes from 'prop-types';
import { Avatar } from './Avatar';
import { postDate } from './BlogCard';

export function UserRow({ user, isDefault, isCurrent, onDelete }) {
  const reason = isDefault
    ? 'Default admin cannot be deleted.'
    : isCurrent
      ? 'Current account cannot be deleted.'
      : undefined;
  return (
    <tr className="block rounded-xl border border-slate-200 bg-white p-5 md:table-row md:rounded-none md:border-0 md:border-b md:p-0">
      <td className="block md:table-cell md:px-5 md:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar role={user.role} />
          <div className="min-w-0 break-words">
            <p className="font-semibold">{user.displayName}</p>
            <p className="text-sm text-slate-600">@{user.username}</p>
          </div>
        </div>
      </td>
      <td className="mt-4 block text-sm md:table-cell md:px-5 md:py-4">
        <span className="mr-2 font-medium text-slate-600 md:hidden">Role:</span>
        <span
          className={
            user.role === 'admin'
              ? 'rounded-full bg-violet-100 px-3 py-1 text-violet-700'
              : 'rounded-full bg-indigo-100 px-3 py-1 text-indigo-700'
          }
        >
          {user.role}
        </span>
      </td>
      <td className="mt-3 block text-sm text-slate-600 md:table-cell md:px-5 md:py-4">
        <span className="mr-2 font-medium md:hidden">Joined:</span>
        {isDefault ? '—' : postDate(user.createdAt)}
      </td>
      <td className="mt-3 block md:table-cell md:px-5 md:py-4">
        <button
          type="button"
          disabled={Boolean(reason)}
          title={reason}
          aria-label={`Delete ${user.username}`}
          onClick={() => onDelete(user.id)}
          className={
            'rounded-lg px-3 py-2 font-semibold text-red-700 hover:bg-red-50 focus-visible:outline ' +
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 ' +
            'disabled:cursor-not-allowed disabled:text-slate-400'
          }
        >
          Delete
        </button>
      </td>
    </tr>
  );
}
UserRow.propTypes = {
  user: PropTypes.object.isRequired,
  isDefault: PropTypes.bool,
  isCurrent: PropTypes.bool,
  onDelete: PropTypes.func.isRequired,
};
