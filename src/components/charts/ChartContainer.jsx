import Card from '../common/Card.jsx';
import EmptyState from '../common/EmptyState.jsx';
import ErrorState from '../common/ErrorState.jsx';
import LoadingState from '../common/LoadingState.jsx';
import './ChartContainer.css';

// Card + fixed-height area for any chart library. Handles loading, empty and error states
// so every chart in the app behaves the same. Put the chart itself in `children`.
export default function ChartContainer({
  title,
  subtitle,
  actions,
  height = 280,
  loading = false,
  error = null,
  onRetry,
  isEmpty = false,
  emptyMessage = 'There is no data to display for this period.',
  children,
}) {
  let content = children;
  if (error) content = <ErrorState title="Chart unavailable" message={typeof error === 'string' ? error : undefined} onRetry={onRetry} />;
  else if (loading) content = <LoadingState message="Loading chart..." />;
  else if (isEmpty) content = <EmptyState icon="inbox" title="No data yet" description={emptyMessage} />;

  return (
    <Card title={title} subtitle={subtitle} actions={actions}>
      <div className="chart-area" style={{ height }}>{content}</div>
    </Card>
  );
}
