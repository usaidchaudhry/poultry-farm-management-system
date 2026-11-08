import Button from './Button.jsx';
import Icon from './Icon.jsx';
import './StateViews.css';

export default function ErrorState({
  title = 'Something went wrong',
  message = 'We could not load this data. Check your connection and try again.',
  onRetry,
}) {
  return (
    <div className="state" role="alert">
      <span className="state__icon state__icon--error"><Icon name="alert" size={24} /></span>
      <h3 className="state__title">{title}</h3>
      <p className="state__text">{message}</p>
      {onRetry && (
        <div className="state__action">
          <Button variant="secondary" leftIcon="refresh" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
