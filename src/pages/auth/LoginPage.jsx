import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import Alert from '../../components/common/Alert.jsx';
import Button from '../../components/common/Button.jsx';
import LoadingState from '../../components/common/LoadingState.jsx';
import Input from '../../components/forms/Input.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import usePageTitle from '../../hooks/usePageTitle.js';
import { getErrorMessage } from '../../services/apiError.js';
import { email as emailRule, required } from '../../utils/validators.js';
import DemoAccounts from './DemoAccounts.jsx';
import './LoginPage.css';

export default function LoginPage() {
  const { user, isAuthenticated, isInitializing, login, sessionNotice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  usePageTitle('Sign in');

  if (isInitializing) return <LoadingState message="Checking your session..." />;
  if (isAuthenticated) return <Navigate to={user.role ? '/dashboard' : '/pending-access'} replace />;

  const setField = (field) => (event) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: '' }));
    if (formError) setFormError('');
  };

  const validate = () => ({
    email: required(values.email, 'Email') || emailRule(values.email),
    password: required(values.password, 'Password'),
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSubmitting(true);
    setFormError('');
    try {
      const signedIn = await login({ email: values.email.trim(), password: values.password });
      const target = signedIn.role ? location.state?.from?.pathname || '/dashboard' : '/pending-access';
      navigate(target, { replace: true });
    } catch (error) {
      setFormError(getErrorMessage(error, 'We could not sign you in. Please try again.'));
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="login__title">Sign in</h1>
      <p className="login__intro">Use the email and password for your account.</p>

      {sessionNotice && !formError && (
        <div className="login__alert"><Alert tone="warning">{sessionNotice}</Alert></div>
      )}
      {formError && <div className="login__alert"><Alert tone="error">{formError}</Alert></div>}

      <form className="login__form" onSubmit={handleSubmit} noValidate>
        <Input
          label="Email"
          type="email"
          autoComplete="username"
          placeholder="you@company.com"
          required
          value={values.email}
          onChange={setField('email')}
          error={errors.email}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={values.password}
          onChange={setField('password')}
          error={errors.password}
        />
        <Button type="submit" fullWidth size="lg" loading={submitting}>
          {submitting ? 'Signing in' : 'Sign in'}
        </Button>
      </form>

      <DemoAccounts
        disabled={submitting}
        onPick={(account) => {
          setValues({ email: account.email, password: account.password });
          setErrors({});
          setFormError('');
        }}
      />
    </div>
  );
}
