import { config } from '../../utils/config.js';
import './layout.css';

export default function BrandLogo({ showName = true }) {
  return (
    <span className="brand">
      <span className="brand__mark" aria-hidden="true">PM</span>
      {showName && <span className="brand__name">{config.appName}</span>}
    </span>
  );
}
