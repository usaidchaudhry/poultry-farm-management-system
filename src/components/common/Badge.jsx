import { cn } from '../../utils/classNames.js';
import './Badge.css';

// tone: neutral | primary | success | warning | danger | info
export default function Badge({ tone = 'neutral', dot = false, children }) {
  return (
    <span className={cn('badge', `badge--${tone}`)}>
      {dot && <span className="badge__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
