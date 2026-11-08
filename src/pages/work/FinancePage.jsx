import { useState } from 'react';
import Card from '../../components/common/Card.jsx';
import MetricCard from '../../components/common/MetricCard.jsx';
import Input from '../../components/forms/Input.jsx';
import { PERMISSIONS } from '../../config/permissions.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { workService } from '../../services/workService.js';
import { formatNumber } from '../../utils/formatters.js';
import WorkPage from './WorkPage.jsx';
import './work.css';

export default function FinancePage() {
  const { user } = useAuth();
  const actor = { id: user.id, role: user.role };
  const [date, setDate] = useState('');
  const [, setRevision] = useState(0);
  const sales = workService.list('sales', actor).filter((row) => !date || row.date === date);
  const expenses = workService.list('expenses', actor).filter((row) => !date || row.date === date);
  const revenue = sales.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const costs = expenses.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  return <div className="work__stack"><div className="work__filters"><Input label="Summary date" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div><div className="org__metrics"><MetricCard label="Recorded sales" value={`PKR ${formatNumber(revenue)}`} icon="cart" /><MetricCard label="Recorded costs" value={`PKR ${formatNumber(costs)}`} icon="dollar" /><MetricCard label="Operating surplus / deficit" value={`PKR ${formatNumber(revenue - costs)}`} icon="barChart" /></div><Card><p className="text-muted">Summary uses recorded sales and expense entries for the selected date. It is not an official ROI calculation.</p></Card><WorkPage kind="expenses" permission={PERMISSIONS.FINANCE_MANAGE} onSaved={() => setRevision((value) => value + 1)} /></div>;
}
