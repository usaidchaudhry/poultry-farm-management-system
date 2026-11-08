import Alert from '../../components/common/Alert.jsx';
import Button from '../../components/common/Button.jsx';
import LoadingState from '../../components/common/LoadingState.jsx';
import Modal from '../../components/common/Modal.jsx';
import Select from '../../components/forms/Select.jsx';
import { hasCompanyWideScope } from '../../config/roles.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useFarm } from '../../context/FarmContext.jsx';
import './organization.css';

const toOptions = (records, labelOf) => records.map((record) => ({ value: record.id, label: labelOf(record) }));

// Lets the user pick the working site, farm, house and flock. Choices are limited to their scope.
export default function ActiveSelectionModal({ open, onClose }) {
  const { user } = useAuth();
  const farm = useFarm();
  const { active, options, maps, setActive, clearActive } = farm;
  const hasSelection = Boolean(active.siteId);
  const noRecords = !farm.loading && !farm.error && options.sites.length === 0;

  // Add the parent name to a label when the parent level is not chosen yet
  const farmLabel = (x) => (active.siteId ? x.name : `${maps.siteById[x.siteId]?.name} / ${x.name}`);
  const houseLabel = (x) => (active.farmId ? x.name : `${maps.farmById[x.farmId]?.name} / ${x.name}`);
  const flockLabel = (x) => (active.houseId ? x.name : `${maps.houseById[x.houseId]?.name} / ${x.name}`);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Working area"
      description="Choose the site, farm, house and flock you are working with. Other pages will use this selection."
      footer={
        <>
          <Button variant="ghost" onClick={clearActive} disabled={!hasSelection}>Clear selection</Button>
          <Button onClick={onClose}>Done</Button>
        </>
      }
    >
      {farm.loading ? (
        <LoadingState message="Loading your sites and farms..." />
      ) : farm.error ? (
        <Alert tone="error">{farm.error}</Alert>
      ) : noRecords ? (
        <Alert tone="info">
          {hasCompanyWideScope(user.role)
            ? 'There are no active sites yet. Create one under Organization.'
            : 'No sites or farms are assigned to you yet. Ask the Owner to assign them.'}
        </Alert>
      ) : (
        <div className="org__form">
          <Select label="Site" placeholder="All sites" options={toOptions(options.sites, (x) => x.name)} value={active.siteId} onChange={(e) => setActive('site', e.target.value)} />
          <Select label="Farm" placeholder="All farms" options={toOptions(options.farms, farmLabel)} value={active.farmId} onChange={(e) => setActive('farm', e.target.value)} disabled={options.farms.length === 0} />
          <Select label="House" placeholder="All houses" options={toOptions(options.houses, houseLabel)} value={active.houseId} onChange={(e) => setActive('house', e.target.value)} disabled={options.houses.length === 0} />
          <Select label="Flock" placeholder="All flocks" options={toOptions(options.flocks, flockLabel)} value={active.flockId} onChange={(e) => setActive('flock', e.target.value)} disabled={options.flocks.length === 0} />
        </div>
      )}
    </Modal>
  );
}
