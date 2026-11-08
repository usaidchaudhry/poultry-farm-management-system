import SearchInput from '../../components/forms/SearchInput.jsx';
import Switch from '../../components/forms/Switch.jsx';
import './organization.css';

// Search box + filter dropdowns (children) + "show archived" switch for the list pages.
export default function OrgToolbar({ search, onSearch, placeholder, showArchived, onShowArchived, children }) {
  return (
    <div className="org__toolbar">
      <div className="org__toolbar-search">
        <SearchInput value={search} onChange={onSearch} placeholder={placeholder} />
      </div>
      {children}
      <Switch label="Show archived" checked={showArchived} onChange={onShowArchived} />
    </div>
  );
}
