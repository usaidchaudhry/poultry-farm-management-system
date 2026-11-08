import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import EntityDetailsModal from './EntityDetailsModal.jsx';
import EntityFormModal from './EntityFormModal.jsx';

// Renders the form, details and archive-confirmation dialogs for a page that uses useOrgCrud.
export default function OrgCrudDialogs({ crud, parentOptions, getDetailRows }) {
  const lower = crud.label.toLowerCase();
  return (
    <>
      <EntityFormModal
        key={`form-${crud.form.key}`}
        open={crud.form.open}
        kind={crud.kind}
        mode={crud.form.mode}
        record={crud.form.record}
        parentOptions={parentOptions}
        onClose={crud.closeForm}
        onSubmit={crud.submitForm}
      />
      <EntityDetailsModal
        open={crud.details.open}
        title={crud.details.record ? crud.details.record.name : crud.label}
        rows={crud.details.record ? getDetailRows(crud.details.record) : []}
        onClose={crud.closeDetails}
      />
      <ConfirmDialog
        open={Boolean(crud.archiving)}
        title={`Archive this ${lower}?`}
        message={crud.archiving ? `"${crud.archiving.name}" will be hidden from selectors and active lists. You can restore it later.` : ''}
        confirmLabel="Archive"
        loading={crud.busy}
        onConfirm={crud.confirmArchive}
        onCancel={crud.cancelArchive}
      />
    </>
  );
}
