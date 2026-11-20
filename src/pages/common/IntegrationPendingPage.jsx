import EmptyState from '../../components/common/EmptyState.jsx';
import { MERN_PHASE } from '../../config/integration.js';

export default function IntegrationPendingPage({ page }) {
  return <EmptyState icon="layers" title={`${page.label} integration is pending`} description={`This module is scheduled for MERN Phase ${MERN_PHASE[page.key] || 3}. Authentication, users, and roles are connected to the API. Farm workflows will become available as their backend phases are completed.`} />;
}
