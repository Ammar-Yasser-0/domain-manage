import { useState } from "react";
import {
  CalendarDays,
  CalendarPlus,
  CircleAlert,
  History,
  X,
} from "lucide-react";
import type { DomainRecord } from "../types/domain";
import { addYearsToDate } from "../lib/domain-date";
import { validateRenewalYears } from "../lib/domain-validation";
import { formatDate } from "../lib/format";
import { Modal } from "./Modal";

const renewalOptions = [1, 2, 3, 5] as const;
type RenewalSelection = (typeof renewalOptions)[number] | "custom";

interface RenewalDialogProps {
  domain: DomainRecord;
  onClose: () => void;
  onHistory: () => void;
  onSubmit: (years: number) => Promise<void>;
}

export function RenewalDialog({
  domain,
  onClose,
  onHistory,
  onSubmit,
}: RenewalDialogProps) {
  const [selection, setSelection] = useState<RenewalSelection>(1);
  const [customYears, setCustomYears] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);
  const years = selection === "custom" ? Number(customYears) : selection;
  const validation = validateRenewalYears(years);
  const newExpirationDate = (() => {
    if (!validation.ok) {
      return null;
    }

    try {
      return addYearsToDate(domain.expirationDate, validation.value);
    } catch {
      return null;
    }
  })();
  const renewalDateOutOfRange = validation.ok && newExpirationDate === null;

  async function handleConfirm() {
    if (!validation.ok) {
      return;
    }

    setSaving(true);
    setSubmitError("");

    try {
      await onSubmit(validation.value);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "The renewal could not be saved. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      placement="renewal"
      titleId="renew-domain-title"
    >
      <div className="modal-card renewal-card">
        <div className="modal-heading">
          <div>
            <h2 id="renew-domain-title">Renew domain</h2>
            <p className="renew-domain-name">
              <span className="mini-globe">
                <CalendarDays size={18} aria-hidden="true" />
              </span>
              <span>
                <strong>{domain.domainName}</strong>
                <small>Current expiration: {formatDate(domain.expirationDate)}</small>
              </span>
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

        <div className="renewal-content">
          <div className="field-label">Select renewal period</div>
          <div aria-label="Renewal period" className="period-selector" role="group">
            {renewalOptions.map((option) => (
              <button
                aria-pressed={selection === option}
                className={
                  selection === option ? "period-option is-selected" : "period-option"
                }
                key={option}
                onClick={() => {
                  setSelection(option);
                  setSubmitError("");
                }}
                type="button"
              >
                {option} {option === 1 ? "year" : "years"}
              </button>
            ))}
            <button
              aria-pressed={selection === "custom"}
              className={
                selection === "custom" ? "period-option is-selected" : "period-option"
              }
              onClick={() => {
                setSelection("custom");
                setSubmitError("");
              }}
              type="button"
            >
              Custom
            </button>
          </div>

          {selection === "custom" && (
            <label className="field custom-years-field">
              <span>Number of years</span>
              <input
                autoFocus
                inputMode="numeric"
                max={99}
                min={1}
                onChange={(event) => setCustomYears(event.target.value)}
                placeholder="Enter 1–99 years"
                type="number"
                value={customYears}
              />
            </label>
          )}

          <div className="renewal-preview">
            <span className="preview-icon">
              <CalendarPlus size={22} aria-hidden="true" />
            </span>
            <span>
              <small>New expiration</small>
              <strong>
                {newExpirationDate ? formatDate(newExpirationDate) : "Choose a valid period"}
              </strong>
            </span>
          </div>

          {!validation.ok && selection === "custom" && customYears !== "" && (
            <p className="field-error">
              <CircleAlert size={15} aria-hidden="true" />
              {validation.message}
            </p>
          )}

          {renewalDateOutOfRange && (
            <p className="field-error" role="alert">
              <CircleAlert size={15} aria-hidden="true" />
              This renewal would exceed the supported calendar date range.
            </p>
          )}

          {submitError && (
            <p className="form-error" role="alert">
              <CircleAlert size={17} aria-hidden="true" />
              {submitError}
            </p>
          )}

          <button
            className="button button--primary renewal-confirm"
            disabled={!validation.ok || !newExpirationDate || saving}
            onClick={() => void handleConfirm()}
            type="button"
          >
            {saving ? "Saving renewal…" : "Confirm renewal"}
          </button>

          <button
            className="history-link"
            onClick={onHistory}
            type="button"
          >
            <History size={16} aria-hidden="true" />
            View renewal history
          </button>
        </div>
      </div>
    </Modal>
  );
}
