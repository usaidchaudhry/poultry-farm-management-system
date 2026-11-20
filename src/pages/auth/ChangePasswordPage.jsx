import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import Button from '../../components/common/Button.jsx';
import Alert from '../../components/common/Alert.jsx';
import Input from '../../components/forms/Input.jsx';
import LoadingState from '../../components/common/LoadingState.jsx';
import { getErrorMessage } from '../../services/apiError.js';
import usePageTitle from '../../hooks/usePageTitle.js';
import './LoginPage.css';

export default function ChangePasswordPage() {
  const { user, isInitializing, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  usePageTitle('Change password');
  if (isInitializing) return <LoadingState message="Checking your session..." />;
  if (!user) return <Navigate to="/login" replace />;
  const change = (key) => (event) => setValues((current) => ({ ...current, [key]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault(); setError(''); setErrors({});
    if (values.newPassword !== values.confirmPassword) { setErrors({ confirmPassword: 'Passwords must match.' }); return; }
    setBusy(true);
    try {
      const current = await changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword });
      navigate(current.role ? '/dashboard' : '/pending-access', { replace: true });
    } catch (failure) { setError(getErrorMessage(failure)); setErrors(failure.fieldErrors || {}); }
    finally { setBusy(false); }
  };
  const signOut = async () => {
    setBusy(true);
    try { await logout(); navigate('/login', { replace: true }); }
    catch (failure) { setError(getErrorMessage(failure)); }
    finally { setBusy(false); }
  };
  return <div>
    <h1 className="login__title">Change password</h1>
    <p className="login__intro">{user.mustChangePassword ? 'Choose your own password before continuing.' : 'Changing your password signs out your other sessions.'}</p>
    {error && <Alert tone="error">{error}</Alert>}
    <form className="login__form" onSubmit={submit}>
      <Input label="Current password" type="password" autoComplete="current-password" required value={values.currentPassword} onChange={change('currentPassword')} error={errors.currentPassword} />
      <Input label="New password" type="password" autoComplete="new-password" minLength={12} maxLength={128} hint="12–128 characters." required value={values.newPassword} onChange={change('newPassword')} error={errors.newPassword} />
      <Input label="Confirm new password" type="password" autoComplete="new-password" required value={values.confirmPassword} onChange={change('confirmPassword')} error={errors.confirmPassword} />
      <Button type="submit" loading={busy}>Save password</Button>
      {!user.mustChangePassword && <Link to="/profile">Back to profile</Link>}
      <Button variant="secondary" disabled={busy} onClick={signOut}>Sign out</Button>
    </form>
  </div>;
}
