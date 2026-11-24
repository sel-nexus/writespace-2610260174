/** Show the local sign-in form. */
import PropTypes from 'prop-types';
import { AuthForm } from '../components/AuthForm';

export default function LoginPage({ onSessionChange }) {
  return <AuthForm mode="login" onSessionChange={onSessionChange} />;
}
LoginPage.propTypes = { onSessionChange: PropTypes.func.isRequired };
