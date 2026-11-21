import { useState } from 'react';
import Modal from '../../components/common/Modal.jsx';
import Alert from '../../components/common/Alert.jsx';
import Button from '../../components/common/Button.jsx';
import Textarea from '../../components/forms/Textarea.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { reportService } from '../../services/reportService.js';
import { getErrorMessage } from '../../services/apiError.js';
import { eggKeys, label, shown } from './common.jsx';

export default function ReportDetails({ record, onClose, onEdit, onChanged }) {
  const { hasPermission } = useAuth();
  const [snapshot, setSnapshot] = useState(null); const [reason, setReason] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const data = (snapshot || record).data; const summary = (snapshot || record).summary;
  const act = async (action) => {
    setBusy(true); setError('');
    try { await reportService.transition(record, action, reason); await onChanged(record.id); setReason(''); }
    catch (e) { setError(getErrorMessage(e)); if (e.fieldErrors) setError(`${getErrorMessage(e)} ${Object.values(e.fieldErrors).join(' ')}`); }
    finally { setBusy(false); }
  };
  const stats = [
    ['Opening birds', summary.openingBirds], ['Approved change', summary.approvedChange], ['Closing birds', summary.closingBirds],
    ['Mortality', data.mortality], ['Mortality % (opening birds)', summary.mortalityPercent], ['Collected eggs', summary.totalEggs], ['Saleable eggs', summary.saleableEggs], ['Peti equivalent (360 eggs)', summary.petiEquivalent], ['Production % (opening birds)', summary.productionPercent],
    ['Feed consumed (kg)', summary.feedKg], ['Feed per bird (g, opening birds)', summary.feedPerBirdG], ['Water (litres)', data.waterLitres], ['Light hours', data.lightHours], ['Flock age (days)', summary.ageDays], ['Flock week', summary.ageWeek],
    ['Single-egg sample average (g)', summary.eggSampleAverages?.['single-egg']], ['Tray sample average (g)', summary.eggSampleAverages?.tray], ['Linked bird weight (g)', summary.measurement?.grams], ['Weight sample size', summary.measurement?.sampleSize], ['Difference from preceding sample (g)', summary.measurement?.differenceGrams],
  ];
  return <Modal open title={`Daily report · ${record.businessDate}`} size="lg" onClose={busy ? undefined : onClose} footer={<Button onClick={onClose} disabled={busy}>Close</Button>}><div className="reports__stack">
    {error && <Alert tone="error">{error}</Alert>}
    <p>Status: <strong>{record.status}</strong> · Version {record.version} · Published revision {record.publishedRevision || 'None'}</p>
    <p>Recorded by {record.createdByName || record.createdBy} · Updated by {record.updatedByName || record.updatedBy}</p>
    <Alert tone="info">{(snapshot?.summary || record.publishedSummary)?.feedPublication ? 'Published feed consumption has been posted to inventory. Draft edits do not change stock until resubmission.' : 'This report has no stock-enabled feed publication yet. A new submission posts its full selected consumption.'} {(snapshot?.summary || record.publishedSummary)?.eggPublication ? 'Saleable egg production is posted to the collection room.' : 'Legacy egg production requires explicit stock initialization on the Egg production page.'}</Alert>
    {record.returnReason && <Alert tone="warning">Returned: {record.returnReason}. The previous published revision remains effective.</Alert>}
    {!snapshot && record.status !== 'submitted' && <p className="text-muted">Draft totals are previews. Missing inputs still require explicit values before submission.</p>}
    <div className="reports__actions"><Button variant={snapshot ? 'secondary' : 'primary'} onClick={() => setSnapshot(null)}>Current report</Button>{record.revisions.map((r) => <Button key={r.id} variant={snapshot?.id === r.id ? 'primary' : 'secondary'} onClick={() => setSnapshot(r)}>Revision {r.number}</Button>)}</div>
    {snapshot && <p>Submitted {new Date(snapshot.submittedAt).toLocaleString()} · Reason: {snapshot.reason || 'Initial submission'} · Actor: {snapshot.submittedByName || snapshot.submittedBy}</p>}
    {summary.gap && <Alert tone="warning">Population gap: missing earlier reports require an opening reconciliation.</Alert>}
    {summary.invalidPopulation && <Alert tone="error">Population has changed since this draft was saved. Correct its mortality count before submitting.</Alert>}
    <dl className="reports__summary">{stats.map(([title, value]) => <div key={title}><dt>{title}</dt><dd>{shown(value)}</dd></div>)}</dl>
    <p className="text-muted">Standard not configured. Production percentage uses collected eggs divided by opening birds. Saleable categories: Jumbo, Starter, Standard, Small.</p>
    <h3>Egg categories</h3><dl className="reports__summary">{eggKeys.map((key) => <div key={key}><dt>{label(key)}</dt><dd>{shown(data.eggs[key])}</dd></div>)}</dl>
    {data.doctorVisitId && <p>Clinical visit linked to this report; observations are separate from administration evidence.</p>}
    <h3>Feed</h3><p>Item: {data.feed.itemReference || 'Unspecified'} · Location: {data.feed.locationReference || 'Unspecified'} · Bags: {shown(data.feed.bags)} · Bag size: {shown(data.feed.bagSizeKg)} kg · Additional: {shown(data.feed.additionalKg)} kg</p><p className="reports__evidence">{data.feed.notes}</p>
    <h3>Egg sample evidence</h3>{data.eggSamples.length ? <ul>{data.eggSamples.map((s, i) => <li key={i}>{s.sampleType}: {s.value} {s.unit}</li>)}</ul> : <p>No measured samples.</p>}
    {['medicines', 'vaccines'].map((key) => <section key={key}><h3>{label(key)}</h3>{data[key].length ? <ul>{data[key].map((r, i) => <li key={i}>{r.name} · {r.quantity ?? 'Quantity unspecified'} {r.unit} · {r.reference}{r.prescriptionId && ' - Prescription linked'}{r.administrationEventId && ' - Administration event linked'}</li>)}</ul> : <p>None recorded.</p>}</section>)}
    {Object.entries({ observations: 'In-house observations', postMortem: 'Post-mortem observations', comments: 'Comments', issues: 'Operational issues', doctorVisitReference: 'Doctor visit reference note', doctorRemarks: 'Doctor remarks', perPeNote: 'Per Pe note' }).map(([key, title]) => <section key={key}><h3>{title}</h3><p className="reports__evidence">{data[key] || 'None recorded.'}</p></section>)}
    <details><summary>Bird movement evidence</summary>{[...(summary.movements || []), ...(record.birdMovements || [])].map((m) => <p key={m.id}>{m.businessDate} · {m.type} · {m.count} · {m.reason} · {m.sourceKey}</p>)}</details>
    <EvidencePanel type="report" id={record.id} readOnly={Boolean(snapshot) || record.status === 'submitted'} />
    {snapshot && <p className="text-muted">The evidence panel shows retained parent evidence, including later additions. Revision totals above remain the submitted snapshot.</p>}
    {!snapshot && <div className="reports__stack">
      <Textarea label="Submission or return reason" value={reason} onChange={(e) => setReason(e.target.value)} hint="Required for returns, resubmissions, and historical writes." />
      <div className="reports__actions">
        {hasPermission('daily-reports.manage') && record.status !== 'submitted' && <Button onClick={() => onEdit(record)} disabled={busy}>Edit draft</Button>}
        {hasPermission('daily-reports.submit') && record.status !== 'submitted' && <Button onClick={() => act('submit')} loading={busy}>Submit report</Button>}
        {hasPermission('daily-reports.review') && record.status === 'submitted' && <Button variant="secondary" onClick={() => act('return')} loading={busy}>Return for correction</Button>}
      </div>
    </div>}
  </div></Modal>;
}
import EvidencePanel from '../evidence/EvidencePanel.jsx';
