import { cn } from '../../utils/classNames.js';
import Icon from './Icon.jsx';
import './Card.css';

// trend (optional): { direction: 'up' | 'down' | 'flat', value: '4.2%', label: 'vs last week', isGood: true }
// tone controls the icon tile colour: primary | success | warning | danger | info
export default function MetricCard({ label, value, unit, icon, tone = 'primary', trend }) {
  const trendTone = !trend || trend.direction === 'flat' ? 'flat' : trend.isGood === false ? 'bad' : 'good';
  return (
    <div className="card metric">
      <div className="metric__top">
        <span className="metric__label">{label}</span>
        {icon && (
          <span className={cn('metric__icon', `metric__icon--${tone}`)}>
            <Icon name={icon} size={18} />
          </span>
        )}
      </div>
      <p className="metric__value">
        {value}
        {unit && <span className="metric__unit"> {unit}</span>}
      </p>
      {trend && (
        <p className={cn('metric__trend', `metric__trend--${trendTone}`)}>
          {trend.direction !== 'flat' && (
            <Icon name={trend.direction === 'down' ? 'trendDown' : 'trendUp'} size={14} />
          )}
          <span>{trend.value}</span>
          {trend.label && <span className="metric__trend-label">{trend.label}</span>}
        </p>
      )}
    </div>
  );
}
