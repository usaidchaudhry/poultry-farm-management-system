import { useState } from 'react';
import { useFarm } from '../../context/FarmContext.jsx';
import Icon from '../../components/common/Icon.jsx';
import ActiveSelectionModal from './ActiveSelectionModal.jsx';
import './organization.css';

// Top bar button that shows the current working area and opens the selection dialog.
export default function ActiveSelectionButton() {
  const { selectionLabel } = useFarm();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="scope-btn" onClick={() => setOpen(true)} aria-haspopup="dialog" title="Choose working area">
        <Icon name="home" size={16} />
        <span className="scope-btn__text">{selectionLabel || 'Select farm'}</span>
        <Icon name="chevronDown" size={14} className="scope-btn__chevron" />
      </button>
      <ActiveSelectionModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
