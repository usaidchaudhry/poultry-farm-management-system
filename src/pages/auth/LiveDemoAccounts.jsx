import { useEffect, useState } from 'react';
import { authService } from '../../services/authService.js';

export default function LiveDemoAccounts({ onPick, disabled }) {
  const [accounts, setAccounts] = useState([]);
  useEffect(() => {
    let cancelled = false;
    authService.demoAccounts().then((rows) => { if (!cancelled) setAccounts(rows); }).catch(() => { /* Optional helper; normal sign-in remains available. */ });
    return () => { cancelled = true; };
  }, []);
  if (!accounts.length) return null;
  return <details className="demo" open><summary>Demo accounts (localhost)</summary><p className="demo__note">Choose a role to fill the sign-in form. New demo accounts use the configured temporary password and require a password change. For an account already changed, enter its current password.</p><ul className="demo__list">{accounts.map((account) => <li key={account.id}><button type="button" className="demo__item" disabled={disabled} onClick={() => onPick(account)}><span className="demo__role">{account.roleLabel}</span><span className="demo__email">{account.email}{!account.password && ' (enter current password)'}</span></button></li>)}</ul></details>;
}
