import { cn } from '../../utils/classNames.js';
import './Card.css';

// Generic container. Use `padded={false}` when the content (e.g. a table) should touch the edges.
export default function Card({ title, subtitle, actions, footer, padded = true, className, children }) {
  return (
    <section className={cn('card', className)}>
      {(title || actions) && (
        <header className="card__header">
          <div>
            {title && <h3 className="card__title">{title}</h3>}
            {subtitle && <p className="card__subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="card__actions">{actions}</div>}
        </header>
      )}
      <div className={cn('card__body', !padded && 'card__body--flush')}>{children}</div>
      {footer && <footer className="card__footer">{footer}</footer>}
    </section>
  );
}
