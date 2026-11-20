import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const ref = (name) => ({ type: Schema.Types.ObjectId, ref: name, required: true });
const models = {};
for (const [kind, parent] of [['site', null], ['farm', 'site'], ['house', 'farm'], ['flock', 'house']]) {
  const fields = {
    organizationId: ref('Organization'), name: { type: String, required: true },
    nameKey: { type: String, required: true }, status: { type: String, enum: ['active', 'archived'], default: 'active' },
    version: { type: Number, default: 1 },
  };
  for (const ancestor of ['site', 'farm', 'house'].slice(0, ['site', 'farm', 'house', 'flock'].indexOf(kind))) fields[`${ancestor}Id`] = ref(ancestor[0].toUpperCase() + ancestor.slice(1));
  if (kind === 'site') fields.location = { type: String, required: true };
  if (kind === 'house') fields.capacity = { type: Number, min: 1, default: null };
  if (kind === 'flock') Object.assign(fields, { birdType: String, strain: { type: String, default: '' }, ageAtPlacementDays: { type: Number, min: 0, default: null }, placementDate: { type: String, required: true }, initialCount: { type: Number, min: 1, required: true } });
  const schema = new Schema(fields, { timestamps: true, strict: 'throw', versionKey: false });
  schema.index({ organizationId: 1, ...(parent ? { [`${parent}Id`]: 1 } : {}), nameKey: 1 }, { unique: true });
  schema.index({ organizationId: 1, siteId: 1, farmId: 1, status: 1 });
  if (kind === 'flock') schema.index({ houseId: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });
  models[kind] = model(kind[0].toUpperCase() + kind.slice(1), schema);
}
export const hierarchyModels = models;
