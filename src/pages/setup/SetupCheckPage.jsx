import { Link } from 'react-router-dom';
import Card from '../../components/common/Card.jsx';
import './SetupCheckPage.css';

export default function SetupCheckPage() {
  return <div className="setup">
    <header className="setup__header"><span className="setup__logo">PM</span><div><h1>Project setup</h1><p className="text-muted">Poultry Management System frontend</p></div></header>
    <Card title="Application ready">
      <ul className="setup__checks">
        <li><span className="setup__tick">✓</span><div><strong>React and Vite</strong><span>Application loaded successfully.</span></div></li>
        <li><span className="setup__tick">✓</span><div><strong>Routing</strong><span>Pages and navigation are available.</span></div></li>
        <li><span className="setup__tick">✓</span><div><strong>Design system</strong><span>Shared components and styles are loaded.</span></div></li>
      </ul>
      <div className="setup__interactive"><Link to="/login">Go to sign in</Link></div>
    </Card>
  </div>;
}
