import { useCallback, useEffect, useState } from "react";
import { CalendarClock, CircleAlert, History, RotateCw, X } from "lucide-react";
import type { DomainRecord, RenewalRecord } from "../types/domain";
import { getRenewalHistory } from "../lib/api";
import { formatCairoDateTime, formatDate } from "../lib/format";
import { Modal } from "./Modal";

interface HistoryDialogProps {
  domain: DomainRecord;
  onClose: () => void;
}

export function HistoryDialog({ domain, onClose }: HistoryDialogProps) {
  const [items, setItems] = useState<RenewalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await getRenewalHistory(domain.id);
      setItems(response.items);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Renewal history could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [domain.id]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  return (
    <Modal open onClose={onClose} titleId="renewal-history-title">
      <div className="modal-card history-card">
        <div className="modal-heading">
          <span className="modal-heading-icon modal-heading-icon--blue">
            <History size={22} aria-hidden="true" />
          </span>
          <div>
            <h2 id="renewal-history-title">Renewal history</h2>
            <p>{domain.domainName}</p>
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

        {loading ? (
          <div className="history-loading" role="status">
            <span className="spinner" aria-hidden="true" />
            Loading renewal history…
          </div>
        ) : error ? (
          <div className="dialog-message dialog-message--error" role="alert">
            <CircleAlert size={19} aria-hidden="true" />
            <span>{error}</span>
            <button
              className="button button--secondary button--small"
              onClick={() => void loadHistory()}
              type="button"
            >
              <RotateCw size={14} aria-hidden="true" />
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="history-empty">
            <span className="empty-icon empty-icon--blue">
              <CalendarClock size={24} aria-hidden="true" />
            </span>
            <strong>No renewals recorded yet</strong>
            <p>Completed renewals will appear here with their previous and new dates.</p>
          </div>
        ) : (
          <ol className="history-list">
            {items.map((item) => (
              <li className="history-item" key={item.id}>
                <span className="history-marker" aria-hidden="true">
                  <History size={16} />
                </span>
                <div className="history-item-main">
                  <div className="history-item-top">
                    <strong>
                      +{item.renewalYears}{" "}
                      {item.renewalYears === 1 ? "year" : "years"}
                    </strong>
                    <time dateTime={item.renewedAt}>
                      {formatCairoDateTime(item.renewedAt)}
                    </time>
                  </div>
                  <p>
                    {formatDate(item.previousExpirationDate)}
                    <span aria-hidden="true"> → </span>
                    <strong>{formatDate(item.renewedExpirationDate)}</strong>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Modal>
  );
}
