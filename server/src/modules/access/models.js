import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const options = { timestamps: true, strict: 'throw', versionKey: false };
const ref = (name, required = true) => ({ type: Schema.Types.ObjectId, ref: name, required });

const organizationSchema = new Schema({ key: { type: String, default: 'default', unique: true }, name: String, timezone: String, currency: String }, options);
const roleSchema = new Schema({
  organizationId: ref('Organization'), code: { type: String, required: true }, name: { type: String, required: true }, description: { type: String, default: '' },
  permissions: { type: [String], default: [] }, scopeMode: { type: String, enum: ['company', 'assigned'], default: 'assigned' },
  isProtected: { type: Boolean, default: false }, version: { type: Number, default: 1 },
}, options);
roleSchema.index({ organizationId: 1, code: 1 }, { unique: true });
roleSchema.index({ organizationId: 1, name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
const userSchema = new Schema({
  organizationId: ref('Organization'), name: { type: String, required: true }, email: { type: String, required: true },
  passwordHash: { type: String, required: true, select: false }, roleId: ref('Role', false),
  isActive: { type: Boolean, default: true }, mustChangePassword: { type: Boolean, default: true },
  authVersion: { type: Number, default: 0, select: false }, version: { type: Number, default: 1 },
  siteIds: { type: [Schema.Types.ObjectId], default: [] }, farmIds: { type: [Schema.Types.ObjectId], default: [] }, lastLoginAt: Date,
}, options);
userSchema.index({ organizationId: 1, email: 1 }, { unique: true });
const auditSchema = new Schema({
  organizationId: ref('Organization', false), actorId: ref('User', false), action: { type: String, required: true },
  targetType: String, targetId: String, requestId: String, changes: Schema.Types.Mixed,
}, { ...options, timestamps: { createdAt: true, updatedAt: false } });
auditSchema.index({ organizationId: 1, createdAt: -1 });
const guardSchema = new Schema({ _id: String, revision: { type: Number, default: 0 } }, { versionKey: false });
const migrationSchema = new Schema({ _id: String, appliedAt: Date }, { versionKey: false });
const idempotencySchema = new Schema({ actorId: ref('User'), operation: String, key: String, fingerprint: String, result: Schema.Types.Mixed, expiresAt: Date }, options);
idempotencySchema.index({ actorId: 1, operation: 1, key: 1 }, { unique: true });
idempotencySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Organization = model('Organization', organizationSchema);
export const Role = model('Role', roleSchema);
export const User = model('User', userSchema);
export const AuditEvent = model('AuditEvent', auditSchema);
export const SecurityGuard = model('SecurityGuard', guardSchema);
export const Migration = model('Migration', migrationSchema);
export const IdempotencyRecord = model('IdempotencyRecord', idempotencySchema);
export const models = [Organization, Role, User, AuditEvent, SecurityGuard, Migration, IdempotencyRecord];
