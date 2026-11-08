import { useState } from 'react';
import Button from '../../components/common/Button.jsx';
import ChartContainer from '../../components/charts/ChartContainer.jsx';
import { DEMO_CHART_DATA } from './demoData.js';

// Tiny SVG bar chart so the container has something to hold.
// Real dashboards will use a chart library (chosen in the dashboard phase).
function DemoBars({ data }) {
  const max = Math.max(...data.map((d) => d.value));
  const barWidth = 100 / data.length;
  return (
    <svg viewBox="0 0 100 60" preserveAspectRatio="none" role="img" aria-label="Demo bar chart">
      {data.map((d, i) => {
        const h = (d.value / max) * 46;
        return <rect key={d.label} x={i * barWidth + barWidth * 0.2} y={50 - h} width={barWidth * 0.6} height={h} rx="1" fill="var(--color-primary)" />;
      })}
      <line x1="0" y1="50" x2="100" y2="50" stroke="var(--color-border)" strokeWidth="0.4" />
      {data.map((d, i) => (
        <text key={d.label} x={i * barWidth + barWidth / 2} y="57" textAnchor="middle" fontSize="3.2" fill="var(--color-text-muted)">{d.label}</text>
      ))}
    </svg>
  );
}

export default function ChartSection() {
  const [view, setView] = useState('normal'); // normal | loading | empty | error

  return (
    <ChartContainer
      title="Chart container"
      subtitle="Sample weekly values (demo data)"
      loading={view === 'loading'}
      isEmpty={view === 'empty'}
      error={view === 'error' ? 'The demo data could not be loaded.' : null}
      onRetry={() => setView('normal')}
      actions={['normal', 'loading', 'empty', 'error'].map((name) => (
        <Button key={name} size="sm" variant={view === name ? 'primary' : 'secondary'} onClick={() => setView(name)}>
          {name.charAt(0).toUpperCase() + name.slice(1)}
        </Button>
      ))}
    >
      <DemoBars data={DEMO_CHART_DATA} />
    </ChartContainer>
  );
}
