import Badge from './Badge.jsx';

// One central place that maps a status value to a badge colour and label.
// Add new statuses here as modules need them.
const STATUS_MAP = {
  active: { tone: 'success', label: 'Active' },
  inactive: { tone: 'neutral', label: 'Inactive' },
  archived: { tone: 'neutral', label: 'Archived' },
  pending: { tone: 'warning', label: 'Pending' },
  completed: { tone: 'success', label: 'Completed' },
  overdue: { tone: 'danger', label: 'Overdue' },
  critical: { tone: 'danger', label: 'Critical' },
  info: { tone: 'info', label: 'Info' },
};

export default function StatusBadge({ status, label }) {
  const config = STATUS_MAP[status] || { tone: 'neutral', label: String(status ?? 'Unknown') };
  return (
    <Badge tone={config.tone} dot>
      {label || config.label}
    </Badge>
  );
}
