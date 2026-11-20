import { ClinicalVisit, Prescription, AdministrationEvent } from './models.js';
import { Organization } from '../access/models.js';
import { allowedDateRange } from '../../policies/dates.js';
import { AppError, denied } from '../../lib/errors.js';

// A reference links evidence only; it never records administration or stock.
export async function assertReportLinks(actor, flockId, date, data, session) {
  const timezone = (await Organization.findById(actor.organizationId).session(session)).timezone;
  const checkDate = (value) => {
    if (value > date) throw new AppError(422, 'INVALID_CLINICAL_LINK', 'Linked evidence cannot be later than the report date.');
    allowedDateRange(actor, { from: value, to: value, clinical: true, timezone });
  };
  if (data.doctorVisitId) {
    if (!actor.permissions.includes('clinical.view')) throw denied();
    const visit = await ClinicalVisit.findOne({ _id: data.doctorVisitId, organizationId: actor.organizationId, flockId }).session(session);
    if (!visit) throw new AppError(422, 'INVALID_CLINICAL_LINK', 'Choose a clinical visit for this flock.');
    checkDate(visit.businessDate);
  }
  for (const row of [...data.medicines, ...data.vaccines]) {
    if (row.prescriptionId) {
      if (!actor.permissions.includes('clinical.view')) throw denied();
      const prescription = await Prescription.findOne({ _id: row.prescriptionId, organizationId: actor.organizationId, flockId }).session(session);
      if (!prescription || (data.doctorVisitId && String(prescription.visitId) !== data.doctorVisitId)) throw new AppError(422, 'INVALID_CLINICAL_LINK', 'The prescription must match the flock and selected visit.');
      const visit = await ClinicalVisit.findById(prescription.visitId).session(session); checkDate(visit.businessDate);
    }
    if (row.administrationEventId) {
      if (!actor.permissions.includes('medication.view')) throw denied();
      const event = await AdministrationEvent.findOne({ _id: row.administrationEventId, organizationId: actor.organizationId, flockId }).session(session);
      if (!event || (row.prescriptionId && String(event.prescriptionId) !== row.prescriptionId)) throw new AppError(422, 'INVALID_CLINICAL_LINK', 'The administration event must match the flock and selected prescription.');
      if (data.doctorVisitId) {
        const prescription = await Prescription.findById(event.prescriptionId).session(session);
        if (String(prescription.visitId) !== data.doctorVisitId) throw new AppError(422, 'INVALID_CLINICAL_LINK', 'The event must belong to the selected visit.');
      }
      checkDate(event.businessDate);
    }
  }
}
