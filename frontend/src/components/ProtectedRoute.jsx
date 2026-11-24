/** Restrict navigation in the demo interface; this is not authorization. */
import PropTypes from 'prop-types';
import { Navigate } from 'react-router-dom';

export function ProtectedRoute({ session, adminOnly = false, children }) {
  if (!session) return <Navigate to="/login" replace />;
  if (adminOnly && session.role !== 'admin') return <Navigate to="/blogs" replace />;
  return children;
}
ProtectedRoute.propTypes = { session: PropTypes.object, adminOnly: PropTypes.bool, children: PropTypes.node.isRequired };
