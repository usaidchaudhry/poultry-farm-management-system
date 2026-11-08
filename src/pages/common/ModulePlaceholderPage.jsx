import Badge from '../../components/common/Badge.jsx';
import Card from '../../components/common/Card.jsx';
import './ModulePlaceholderPage.css';

// Temporary page for modules that are built in later phases. Content comes from config/modules.js.
export default function ModulePlaceholderPage({ page }) {
  return (
    <Card
      title="Planned for a later phase"
      actions={page.phase ? <Badge tone="info">Phase {page.phase}</Badge> : null}
    >
      <p className="placeholder__intro">
        The {page.label.toLowerCase()} screens are not built yet. This page is in the menu so navigation, permissions and
        breadcrumbs can be tested now.
      </p>
      {page.capabilities?.length > 0 && (
        <>
          <h3 className="placeholder__heading">What this page will include</h3>
          <ul className="placeholder__list">
            {page.capabilities.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      )}
      {page.permission && (
        <p className="text-muted placeholder__perm">Required permission: <code>{page.permission}</code></p>
      )}
    </Card>
  );
}
