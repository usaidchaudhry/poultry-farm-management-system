import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ROLE_INFO } from '../../config/roles.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import Icon from '../common/Icon.jsx';
import './layout.css';

const getInitials = (name = '') =>
  name.replace(/^Dr\.?\s+/i, '').split(' ').filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');

export default function UserMenu() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return undefined;
    const handlePointer = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false);
    };
    const handleKey = (event) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  if (!user) return null;
  const roleLabel = ROLE_INFO[user.role]?.label || user.role;

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    toast.info('You have been signed out.');
    navigate('/login', { replace: true });
  };

  return (
    <div className="user-menu" ref={wrapperRef}>
      <button
        type="button"
        className="user-menu__trigger"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="user-menu__avatar" aria-hidden="true">{getInitials(user.name)}</span>
        <span className="user-menu__info">
          <span className="user-menu__name">{user.name}</span>
          <span className="user-menu__role">{roleLabel}</span>
        </span>
        <Icon name="chevronDown" size={14} className="user-menu__chevron" />
      </button>

      {open && (
        <div className="user-menu__panel" role="menu">
          <div className="user-menu__summary">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          <Link to="/profile" className="user-menu__item" role="menuitem" onClick={() => setOpen(false)}>
            <Icon name="user" size={16} /> My profile
          </Link>
          <button type="button" className="user-menu__item" role="menuitem" onClick={handleLogout}>
            <Icon name="logOut" size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
