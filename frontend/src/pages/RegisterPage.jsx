/** Show the local registration form. */
import PropTypes from 'prop-types';
import { AuthForm } from '../components/AuthForm';

export default function RegisterPage({ onSessionChange }) {
  return <AuthForm mode="register" onSessionChange={onSessionChange} />;
}
RegisterPage.propTypes = { onSessionChange: PropTypes.func.isRequired };
