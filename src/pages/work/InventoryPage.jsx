import { useState } from 'react';
import Button from '../../components/common/Button.jsx';
import Card from '../../components/common/Card.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { PERMISSIONS } from '../../config/permissions.js';
import { workService } from '../../services/workService.js';
import WorkPage from './WorkPage.jsx';
import './work.css';

export default function InventoryPage() {
  const [tab, setTab] = useState('items');
  const [, setRevision] = useState(0);
  const { user } = useAuth();
  const items = workService.list('inventoryItems', { id: user.id, role: user.role });
  const low = items.filter((item) => Number(item.balance) <= Number(item.minimum || 0));
  return <div className="work__stack"><div className="org__quick-links"><Button variant={tab === 'items' ? 'primary' : 'secondary'} onClick={() => setTab('items')}>Items</Button><Button variant={tab === 'feed' ? 'primary' : 'secondary'} onClick={() => setTab('feed')}>Feed stock</Button><Button variant={tab === 'movements' ? 'primary' : 'secondary'} onClick={() => setTab('movements')}>Stock movements</Button><Button variant={tab === 'low' ? 'primary' : 'secondary'} onClick={() => setTab('low')}>Low stock ({low.length})</Button></div>{tab === 'items' && <WorkPage key="items" kind="inventoryItems" permission={PERMISSIONS.INVENTORY_MANAGE} onSaved={() => setRevision((value) => value + 1)} />}{tab === 'feed' && <WorkPage key="feed" kind="inventoryItems" permission={PERMISSIONS.INVENTORY_MANAGE} filterRows={(row) => row.category?.toLowerCase() === 'feed'} onSaved={() => setRevision((value) => value + 1)} />}{tab === 'movements' && <WorkPage key="movements" kind="stockMovements" permission={PERMISSIONS.INVENTORY_MANAGE} onSaved={() => setRevision((value) => value + 1)} />}{tab === 'low' && <Card title="Low and out of stock"><ul>{low.map((item) => <li key={item.id}>{item.name}: {item.balance} {item.unit} remaining (minimum {item.minimum})</li>)}</ul>{!low.length && <p>No items below their minimum.</p>}</Card>}</div>;
}
