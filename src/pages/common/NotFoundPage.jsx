import { useNavigate } from 'react-router-dom';
import Button from '../../components/common/Button.jsx';
import Card from '../../components/common/Card.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <Card>
      <EmptyState
        icon="search"
        title="Page not found"
        description="The page you opened does not exist or has moved. Check the address or use the menu."
        action={<Button onClick={() => navigate('/dashboard')}>Go to dashboard</Button>}
      />
    </Card>
  );
}
