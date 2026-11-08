import './Spinner.css';

export default function Spinner({ size = 20, label = 'Loading' }) {
  return (
    <span className="spinner" role="status" style={{ width: size, height: size }}>
      <span className="sr-only">{label}</span>
    </span>
  );
}
