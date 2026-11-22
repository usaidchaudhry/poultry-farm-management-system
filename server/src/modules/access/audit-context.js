import mongoose from 'mongoose';
const models = { site: 'Site', farm: 'Farm', house: 'House', flock: 'Flock', 'daily-report': 'DailyReport', report: 'DailyReport', 'bird-movement': 'BirdMovement', 'bird-measurement': 'BirdMeasurement', 'clinical-visit': 'ClinicalVisit', prescription: 'Prescription', 'medication-task': 'MedicationTask', 'inventory-item': 'InventoryItem', 'stock-location': 'StockLocation', 'stock-balance': 'StockBalance', 'formula-version': 'FormulaVersion', sale: 'Sale', expense: 'Expense', 'egg-policy': 'EggPolicy', notification: 'Notification', alert: 'Notification' };
export async function auditContext(targetType, targetId, session = null) {
  if (targetType === 'stock-operation' && mongoose.models.StockMovement) {
    const rows = await mongoose.models.StockMovement.find({ operationId: targetId }).select('siteId farmId businessDate').session(session).lean();
    if (rows.length) return { siteId: rows[0].siteId, farmId: rows[0].farmId, farmIds: [...new Set(rows.map((r) => String(r.farmId)))], businessDate: rows[0].businessDate };
  }
  const Model = mongoose.models[models[targetType]];
  if (!Model || !targetId || !mongoose.isValidObjectId(targetId)) return {};
  const row = await Model.findById(targetId).session(session).lean(); if (!row) return {};
  const output = {};
  for (const kind of ['site', 'farm', 'house', 'flock']) if (row[`${kind}Id`] || targetType === kind) output[`${kind}Id`] = targetType === kind ? row._id : row[`${kind}Id`];
  if (row.businessDate) output.businessDate = row.businessDate;
  if (targetType === 'medication-task' && row.outcomeBusinessDate) output.businessDate = row.outcomeBusinessDate;
  if (targetType === 'prescription' && mongoose.models.ClinicalVisit) { const visit = await mongoose.models.ClinicalVisit.findById(row.visitId).select('businessDate').session(session).lean(); if (visit) output.businessDate = visit.businessDate; }
  return output;
}
