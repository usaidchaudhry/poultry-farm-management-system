import { useState } from 'react';
import Card from '../../components/common/Card.jsx';
import { PERMISSIONS } from '../../config/permissions.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { workService } from '../../services/workService.js';
import { formatNumber } from '../../utils/formatters.js';
import WorkPage from './WorkPage.jsx';
import './work.css';

export default function SalesPage() {
  const { user } = useAuth();
  const [, setRevision] = useState(0);
  const actor = { id: user.id, role: user.role };
  const produced = workService.list('eggProduction', actor).reduce((sum, row) => sum + Number(row.saleableEggs || 0), 0);
  const sold = workService.list('sales', actor).reduce((sum, row) => sum + Number(row.eggs || 0), 0);
  return <div className="work__stack"><Card title="Saleable egg stock"><p>{formatNumber(produced - sold)} eggs available across your permitted farms. Sales are separate from production; the form checks stock before saving.</p></Card><WorkPage kind="sales" permission={PERMISSIONS.SALES_MANAGE} onSaved={() => setRevision((value) => value + 1)} /></div>;
}
