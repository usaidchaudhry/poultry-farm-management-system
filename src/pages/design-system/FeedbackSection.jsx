import { useState } from 'react';
import Button from '../../components/common/Button.jsx';
import Card from '../../components/common/Card.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import LoadingState from '../../components/common/LoadingState.jsx';
import Modal from '../../components/common/Modal.jsx';
import Input from '../../components/forms/Input.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export default function FeedbackSection() {
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = () => {
    setDeleting(true);
    setTimeout(() => {
      setDeleting(false);
      setConfirmOpen(false);
      toast.success('Record deleted.');
    }, 1000);
  };

  return (
    <>
      <Card title="Modals, confirmations and toasts">
        <div className="ds__row">
          <Button onClick={() => setModalOpen(true)}>Open modal</Button>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>Delete record</Button>
          <Button variant="secondary" onClick={() => toast.success('Changes saved.')}>Success toast</Button>
          <Button variant="secondary" onClick={() => toast.error('Could not save changes.', { title: 'Save failed' })}>Error toast</Button>
          <Button variant="secondary" onClick={() => toast.warning('Feed stock is running low.')}>Warning toast</Button>
          <Button variant="secondary" onClick={() => toast.info('Report will be ready shortly.')}>Info toast</Button>
        </div>
      </Card>

      <Card title="Loading, empty and error states">
        <div className="ds__states">
          <div className="ds__state-box"><LoadingState message="Loading flocks..." /></div>
          <div className="ds__state-box">
            <EmptyState title="No flocks yet" description="Create the first flock for this house to start tracking it." action={<Button leftIcon="plus">Add flock</Button>} />
          </div>
          <div className="ds__state-box"><ErrorState onRetry={() => toast.info('Retrying...')} /></div>
        </div>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add house"
        description="Escape, the close button and clicking outside all close this dialog."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={() => { setModalOpen(false); toast.success('House added (demo).'); }}>Add house</Button>
          </>
        }
      >
        <Input label="House name" placeholder="e.g. House A3" />
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this record?"
        message="This action cannot be undone."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
