import Spinner from './Spinner.jsx';
import './StateViews.css';

export default function LoadingState({ message = 'Loading...' }) {
  return (
    <div className="state" aria-busy="true">
      <Spinner size={28} label={message} />
      <p className="state__text">{message}</p>
    </div>
  );
}
