import BasicsSection from './BasicsSection.jsx';
import ChartSection from './ChartSection.jsx';
import DataSection from './DataSection.jsx';
import FeedbackSection from './FeedbackSection.jsx';
import FormsSection from './FormsSection.jsx';
import './DesignSystemPage.css';

// Living style guide: every shared component in one place. Removed or hidden once real pages exist.
export default function DesignSystemPage() {
  return (
    <main className="ds">
      <p className="text-muted">Phase 2 shared components. Everything here is reusable across the app.</p>

      <BasicsSection />
      <FormsSection />
      <DataSection />
      <FeedbackSection />
      <ChartSection />
    </main>
  );
}
