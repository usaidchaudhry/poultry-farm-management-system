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
  draft: { tone: 'neutral', label: 'Draft' },
  submitted: { tone: 'info', label: 'Submitted' },
  returned: { tone: 'warning', label: 'Returned' },
  due: { tone: 'info', label: 'Due' },
  missed: { tone: 'danger', label: 'Missed' },
  cancelled: { tone: 'neutral', label: 'Cancelled' },
  recorded: { tone: 'info', label: 'Recorded' },
  pending_costing: { tone: 'warning', label: 'Pending costing' },
  finalized: { tone: 'success', label: 'Finalized' },
  created: { tone: 'info', label: 'Created' },
  acknowledged: { tone: 'warning', label: 'Acknowledged' },
  resolved: { tone: 'success', label: 'Resolved' },
  warning: { tone: 'warning', label: 'Warning' },
  emergency: { tone: 'danger', label: 'Emergency' },
};

export default function StatusBadge({ status, label }) {
  const config = STATUS_MAP[status] || { tone: 'neutral', label: String(status ?? 'Unknown') };
  return (
    <Badge tone={config.tone} dot>
      {label || config.label}
    </Badge>
  );
}
