import { ROLE_INFO } from '../../config/roles.js';
import { DEMO_LOGINS, DEMO_PASSWORD } from '../../mock/seedUsers.js';
import './LoginPage.css';

// DEMO ONLY: lists the seeded accounts so you can fill the form with one click.
// Delete this component (and its use in LoginPage) before connecting a real backend.
export default function DemoAccounts({ onPick, disabled }) {
  return (
    <details className="demo">
      <summary>Demo accounts (mock data)</summary>
      <p className="demo__note">Password for all: <code>{DEMO_PASSWORD}</code></p>
      <ul className="demo__list">
        {DEMO_LOGINS.map((account) => (
          <li key={account.id}>
            <button
              type="button"
              className="demo__item"
              disabled={disabled}
              onClick={() => onPick({ email: account.email, password: DEMO_PASSWORD })}
            >
              <span className="demo__role">{account.role ? ROLE_INFO[account.role].label : 'Unassigned user'}</span>
              <span className="demo__email">
                {account.email}
                {!account.isActive && ' (deactivated)'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
