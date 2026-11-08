import { useState } from 'react';
import Badge from '../../components/common/Badge.jsx';
import Button from '../../components/common/Button.jsx';
import Card from '../../components/common/Card.jsx';
import IconButton from '../../components/common/IconButton.jsx';
import MetricCard from '../../components/common/MetricCard.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';

export default function BasicsSection() {
  const [loading, setLoading] = useState(false);

  const simulateSave = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1500);
  };

  return (
    <>
      <Card title="Buttons" subtitle="Variants, sizes, icons and loading state">
        <div className="ds__stack">
          <div className="ds__row">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="ds__row">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </div>
          <div className="ds__row">
            <Button leftIcon="plus">Add farm</Button>
            <Button variant="secondary" leftIcon="download">Export</Button>
            <Button loading={loading} onClick={simulateSave}>
              {loading ? 'Saving' : 'Save changes'}
            </Button>
          </div>
          <div className="ds__row">
            <IconButton icon="eye" label="View" />
            <IconButton icon="edit" label="Edit" />
            <IconButton icon="archive" label="Archive" />
            <IconButton icon="trash" label="Delete" variant="secondary" />
            <IconButton icon="plus" label="Add" variant="primary" />
          </div>
        </div>
      </Card>

      <Card title="Badges" subtitle="Generic tones and status badges">
        <div className="ds__stack">
          <div className="ds__row">
            <Badge>Neutral</Badge>
            <Badge tone="primary">Primary</Badge>
            <Badge tone="success">Success</Badge>
            <Badge tone="warning">Warning</Badge>
            <Badge tone="danger">Danger</Badge>
            <Badge tone="info">Info</Badge>
          </div>
          <div className="ds__row">
            <StatusBadge status="active" />
            <StatusBadge status="inactive" />
            <StatusBadge status="pending" />
            <StatusBadge status="completed" />
            <StatusBadge status="overdue" />
            <StatusBadge status="archived" />
          </div>
        </div>
      </Card>

      <div className="ds__metrics">
        <MetricCard label="Live birds" value="48,250" icon="home" tone="primary" trend={{ direction: 'flat', value: 'No change', label: 'since yesterday' }} />
        <MetricCard label="Daily mortality" value="0.08" unit="%" icon="alert" tone="warning" trend={{ direction: 'up', value: '0.02%', label: 'vs yesterday', isGood: false }} />
        <MetricCard label="Egg production" value="86.4" unit="%" icon="trendUp" tone="success" trend={{ direction: 'up', value: '1.3%', label: 'vs last week' }} />
        <MetricCard label="Feed stock" value="12.5" unit="tons" icon="archive" tone="info" trend={{ direction: 'down', value: '0.8 tons', label: 'vs last week', isGood: false }} />
      </div>
    </>
  );
}
