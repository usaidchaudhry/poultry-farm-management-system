import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const options = { timestamps: true, strict: 'throw', versionKey: false };
const ref = (name, required = true) => ({ type: Schema.Types.ObjectId, ref: name, required });
const scope = { organizationId: ref('Organization'), siteId: ref('Site'), farmId: ref('Farm'), houseId: ref('House'), flockId: ref('Flock') };
const reportSchema = new Schema({ ...scope, businessDate: { type: String, required: true }, status: { type: String, enum: ['draft', 'submitted', 'returned'], default: 'draft' }, version: { type: Number, default: 1 }, data: Schema.Types.Mixed, summary: Schema.Types.Mixed, publishedSummary: Schema.Types.Mixed, publishedRevision: { type: Number, default: 0 }, returnReason: { type: String, default: '' }, createdBy: ref('User'), createdByName: String, updatedBy: ref('User'), updatedByName: String }, options);
reportSchema.index({ flockId: 1, businessDate: 1 }, { unique: true });
reportSchema.index({ organizationId: 1, farmId: 1, businessDate: -1 });
const revisionSchema = new Schema({ ...scope, reportId: ref('DailyReport'), businessDate: String, number: Number, data: Schema.Types.Mixed, summary: Schema.Types.Mixed, reason: String, submittedBy: ref('User'), submittedByName: String, submittedAt: Date }, options);
revisionSchema.index({ reportId: 1, number: 1 }, { unique: true });
const movementSchema = new Schema({ ...scope, businessDate: String, type: { type: String, enum: ['opening', 'placement', 'adjustment', 'reconciliation', 'mortality'] }, count: Number, reason: String, sourceKey: { type: String, required: true, unique: true }, reportId: ref('DailyReport', false), revision: Number, createdBy: ref('User', false) }, options);
movementSchema.index({ flockId: 1, businessDate: 1 });
const measurementSchema = new Schema({ ...scope, measuredAt: Date, businessDate: String, sampleSize: Number, averageWeight: Number, unit: { type: String, enum: ['g', 'kg'] }, grams: Number, notes: String, createdBy: ref('User') }, options);
measurementSchema.index({ flockId: 1, measuredAt: -1 });
measurementSchema.index({ organizationId: 1, farmId: 1, businessDate: -1 });
const intentSchema = new Schema({ ...scope, reportId: ref('DailyReport'), revision: Number, previousRevision: Number, sourceKey: { type: String, required: true, unique: true }, businessDate: String, eggDelta: Schema.Types.Mixed, feedKgDelta: Number, feedBefore: Schema.Types.Mixed, feedAfter: Schema.Types.Mixed, status: { type: String, enum: ['deferred'], default: 'deferred' } }, options);
// Evidence collections have no update/delete routes. Protect document saves too;
// this is application-level immutability, not a claim against DB administrators.
for (const schema of [revisionSchema, movementSchema, intentSchema, measurementSchema]) schema.pre('save', function () { if (!this.isNew) throw new Error('Evidence is append-only.'); });
export const DailyReport = model('DailyReport', reportSchema);
export const ReportRevision = model('ReportRevision', revisionSchema);
export const BirdMovement = model('BirdMovement', movementSchema);
export const BirdMeasurement = model('BirdMeasurement', measurementSchema);
export const PublicationIntent = model('PublicationIntent', intentSchema);
export const reportModels = [DailyReport, ReportRevision, BirdMovement, BirdMeasurement, PublicationIntent];
export const flockScope = (flock) => ({ organizationId: flock.organizationId, siteId: flock.siteId, farmId: flock.farmId, houseId: flock.houseId, flockId: flock._id });
export async function openingMovement(flock, session) {
  const sourceKey = `flock:${flock._id}:opening`;
  if (!await BirdMovement.exists({ sourceKey }).session(session)) await BirdMovement.create([{ ...flockScope(flock), businessDate: flock.placementDate, type: 'opening', count: flock.initialCount, reason: 'Initial flock placement', sourceKey }], { session });
}
