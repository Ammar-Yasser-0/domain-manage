import { useState } from "react";
import { AlertTriangle, CircleAlert, Trash2, X } from "lucide-react";
import type { DomainRecord } from "../types/domain";
import { Modal } from "./Modal";

interface DeleteDomainDialogProps {
  domain: DomainRecord;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteDomainDialog({
  domain,
  onClose,
  onConfirm,
}: DeleteDomainDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setDeleting(true);
    setError("");

    try {
      await onConfirm();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "The domain could not be deleted. Please try again.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal open onClose={onClose} titleId="delete-domain-title">
      <div className="modal-card">
        <div className="modal-heading">
          <span className="modal-heading-icon modal-heading-icon--red">
            <AlertTriangle size={22} aria-hidden="true" />
          </span>
          <div>
            <h2 id="delete-domain-title">Delete domain?</h2>
            <p>This removes the domain and its renewal history.</p>
          </div>
          <button
            aria-label="Close dialog"
            className="icon-button modal-close"
            onClick={onClose}
            type="button"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>

        <div className="delete-summary">
          <span className="mini-globe">
            <Trash2 size={17} aria-hidden="true" />
          </span>
          <strong>{domain.domainName}</strong>
        </div>

        {error && (
          <p className="form-error" role="alert">
            <CircleAlert size={17} aria-hidden="true" />
            {error}
          </p>
        )}

        <div className="dialog-actions">
          <button
            className="button button--secondary"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="button button--danger"
            disabled={deleting}
            onClick={() => void handleDelete()}
            type="button"
          >
            {deleting ? "Deleting…" : "Delete domain"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
