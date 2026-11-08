import Icon from './Icon.jsx';
import './StateViews.css';

// `action` is usually a <Button> that creates the first record.
export default function EmptyState({ icon = 'inbox', title = 'Nothing here yet', description, action }) {
  return (
    <div className="state">
      <span className="state__icon"><Icon name={icon} size={24} /></span>
      <h3 className="state__title">{title}</h3>
      {description && <p className="state__text">{description}</p>}
      {action && <div className="state__action">{action}</div>}
    </div>
  );
}
