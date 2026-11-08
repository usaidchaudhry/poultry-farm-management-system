import { useNavigate } from 'react-router-dom';
import Button from '../../components/common/Button.jsx';
import Card from '../../components/common/Card.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';

// Shown in place when a signed-in user opens a page their permissions do not allow.
export default function AccessDeniedPage() {
  const navigate = useNavigate();
  return (
    <Card>
      <EmptyState
        icon="lock"
        title="You do not have access to this page"
        description="Your role does not include this area. If you think this is a mistake, ask the Owner to update your access."
        action={<Button onClick={() => navigate('/dashboard')}>Go to dashboard</Button>}
      />
    </Card>
  );
}
