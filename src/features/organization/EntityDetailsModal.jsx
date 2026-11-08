import Button from '../../components/common/Button.jsx';
import Modal from '../../components/common/Modal.jsx';
import './organization.css';

// Read-only view. rows: [{ label, value }]
export default function EntityDetailsModal({ open, title, rows = [], onClose }) {
  return (
    <Modal open={open} onClose={onClose} title={title} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      <dl className="org__details">
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value ?? '-'}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
