import { useState, type FormEvent } from "react";
import { CircleAlert, Globe2, X } from "lucide-react";
import type { DomainInput, DomainRecord } from "../types/domain";
import {
  validateDomainName,
  validateExpirationDate,
} from "../lib/domain-validation";
import { formatDate } from "../lib/format";
import { Modal } from "./Modal";

interface DomainFormDialogProps {
  mode: "add" | "edit";
  domain?: DomainRecord;
  onClose: () => void;
  onSubmit: (input: DomainInput) => Promise<void>;
}

type FieldName = "domainName" | "expirationDate";

export function DomainFormDialog({
  mode,
  domain,
  onClose,
  onSubmit,
}: DomainFormDialogProps) {
  const [domainName, setDomainName] = useState(domain?.domainName ?? "");
  const [expirationDate, setExpirationDate] = useState(
    domain?.expirationDate ?? "",
  );
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);
  const title = mode === "add" ? "Add domain" : "Edit domain";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");

    const domainResult = validateDomainName(domainName);
    const dateResult = validateExpirationDate(expirationDate);
    const nextErrors: Partial<Record<FieldName, string>> = {};

    if (!domainResult.ok) {
      nextErrors.domainName = domainResult.message;
    }

    if (!dateResult.ok) {
      nextErrors.expirationDate = dateResult.message;
    }

    setErrors(nextErrors);

    if (!domainResult.ok || !dateResult.ok) {
      return;
    }

    setSaving(true);

    try {
      await onSubmit({
        domainName: domainResult.value,
        expirationDate: dateResult.value,
      });
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "The domain could not be saved. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  function updateField(field: FieldName) {
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError("");
  }

  return (
    <Modal open onClose={onClose} titleId="domain-form-title">
      <div className="modal-card">
        <div className="modal-heading">
          <span className="modal-heading-icon modal-heading-icon--teal">
            <Globe2 size={22} aria-hidden="true" />
          </span>
          <div>
            <h2 id="domain-form-title">{title}</h2>
            <p>
              {mode === "add"
                ? "Keep your next renewal date close at hand."
                : "Update the saved domain details."}
            </p>
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

        <form className="dialog-form" onSubmit={handleSubmit} noValidate>
          <label className="field">
            <span>Domain name</span>
            <input
              autoComplete="url"
              aria-describedby={errors.domainName ? "domain-name-error" : "domain-name-help"}
              aria-invalid={Boolean(errors.domainName)}
              autoFocus
              maxLength={253}
              onChange={(event) => {
                setDomainName(event.target.value);
                updateField("domainName");
              }}
              placeholder="example.com"
              required
              spellCheck={false}
              type="text"
              value={domainName}
            />
            {errors.domainName ? (
              <span className="field-error" id="domain-name-error">
                <CircleAlert size={15} aria-hidden="true" />
                {errors.domainName}
              </span>
            ) : (
              <span className="field-help" id="domain-name-help">
                Enter the name without https:// or a path.
              </span>
            )}
          </label>

          <label className="field">
            <span>Expiration date</span>
            <input
              aria-describedby={
                errors.expirationDate ? "expiration-error" : undefined
              }
              aria-invalid={Boolean(errors.expirationDate)}
              onChange={(event) => {
                setExpirationDate(event.target.value);
                updateField("expirationDate");
              }}
              required
              type="date"
              value={expirationDate}
            />
            {errors.expirationDate && (
              <span className="field-error" id="expiration-error">
                <CircleAlert size={15} aria-hidden="true" />
                {errors.expirationDate}
              </span>
            )}
            {domain && !errors.expirationDate && (
              <span className="field-help">
                Current saved date: {formatDate(domain.expirationDate)}
              </span>
            )}
          </label>

          {submitError && (
            <p className="form-error" role="alert">
              <CircleAlert size={17} aria-hidden="true" />
              {submitError}
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
              className="button button--primary"
              disabled={saving}
              type="submit"
            >
              {saving ? "Saving…" : mode === "add" ? "Add domain" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
