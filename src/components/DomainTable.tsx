import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Globe2,
  History,
  LoaderCircle,
  Pencil,
  RotateCw,
  Search,
  Trash2,
} from "lucide-react";
import type {
  DateOnly,
  DomainRecord,
  DomainStatus,
} from "../types/domain";
import { getDomainDateStatus } from "../lib/domain-date";
import { filterAndSortDomains, type DomainFilter } from "../lib/domain-list";
import { formatDate, formatRelativeDays } from "../lib/format";

interface DomainTableProps {
  domains: DomainRecord[];
  today: DateOnly;
  filter: DomainFilter;
  loading: boolean;
  loadError: string;
  onFilterChange: (filter: DomainFilter) => void;
  onAdd: () => void;
  onRetry: () => void;
  onRenew: (domain: DomainRecord) => void;
  onEdit: (domain: DomainRecord) => void;
  onDelete: (domain: DomainRecord) => void;
  onHistory: (domain: DomainRecord) => void;
  onExport: () => Promise<void>;
}

const filterOptions: Array<{ value: DomainFilter; label: string }> = [
  { value: "all", label: "All domains" },
  { value: "active", label: "Active" },
  { value: "expiring-soon", label: "Expiring soon" },
  { value: "expired", label: "Expired" },
];

const statusLabels: Record<DomainStatus, string> = {
  active: "Active",
  "expiring-soon": "Expiring soon",
  expired: "Expired",
};

const statusIcons = {
  active: CheckCircle2,
  "expiring-soon": Clock3,
  expired: AlertCircle,
};

export function DomainTable({
  domains,
  today,
  filter,
  loading,
  loadError,
  onFilterChange,
  onAdd,
  onRetry,
  onRenew,
  onEdit,
  onDelete,
  onHistory,
  onExport,
}: DomainTableProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const pageSize = 5;

  const filteredDomains = useMemo(() => {
    return filterAndSortDomains(domains, filter, search, today);
  }, [domains, filter, search, today]);

  useEffect(() => {
    setPage(1);
  }, [filter, search, domains.length]);

  const pageCount = Math.max(1, Math.ceil(filteredDomains.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const startIndex = (currentPage - 1) * pageSize;
  const visibleDomains = filteredDomains.slice(startIndex, startIndex + pageSize);
  const pageItems = getPageItems(currentPage, pageCount);

  return (
    <section aria-labelledby="domains-heading" className="domains-panel">
      <div className="table-toolbar">
        <div className="table-heading">
          <h2 id="domains-heading">All domains</h2>
          <p>Sorted by nearest expiration</p>
        </div>

        <div className="table-controls">
          <label className="search-field">
            <Search size={19} aria-hidden="true" />
            <span className="sr-only">Search domains</span>
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search domains…"
              type="search"
              value={search}
            />
          </label>
          <nav aria-label="Filter domains" className="filter-tabs">
            {filterOptions.map((option) => (
              <button
                aria-pressed={filter === option.value}
                className={
                  filter === option.value ? "filter-tab is-selected" : "filter-tab"
                }
                key={option.value}
                onClick={() => onFilterChange(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </nav>
          <button
            className="button button--secondary export-button"
            disabled={exporting}
            onClick={() => {
              if (exporting) {
                return;
              }

              setExporting(true);
              void onExport().finally(() => setExporting(false));
            }}
            type="button"
          >
            {exporting ? (
              <LoaderCircle className="login-spinner" size={16} aria-hidden="true" />
            ) : (
              <Download size={16} aria-hidden="true" />
            )}
            <span>{exporting ? "Exporting…" : "Export CSV"}</span>
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="table-feedback table-feedback--error" role="alert">
          <span className="feedback-icon feedback-icon--error">
            <AlertCircle size={22} aria-hidden="true" />
          </span>
          <div>
            <strong>Couldn’t load your domains</strong>
            <p>{loadError}</p>
          </div>
          <button
            className="button button--secondary button--small"
            onClick={onRetry}
            type="button"
          >
            <RotateCw size={15} aria-hidden="true" />
            Try again
          </button>
        </div>
      ) : !loading && domains.length === 0 ? (
        <div className="table-feedback table-feedback--empty">
          <span className="feedback-icon feedback-icon--teal">
            <Globe2 size={24} aria-hidden="true" />
          </span>
          <strong>No domains added yet</strong>
          <p>Add a domain to start tracking its expiration date.</p>
          <button
            className="button button--primary"
            onClick={onAdd}
            type="button"
          >
            Add your first domain
          </button>
        </div>
      ) : !loading && filteredDomains.length === 0 ? (
        <div className="table-feedback table-feedback--empty">
          <span className="feedback-icon feedback-icon--blue">
            <Search size={22} aria-hidden="true" />
          </span>
          <strong>No matching domains</strong>
          <p>Try a different search or clear the selected filter.</p>
          <button
            className="button button--secondary"
            onClick={() => {
              setSearch("");
              onFilterChange("all");
            }}
            type="button"
          >
            Clear search and filters
          </button>
        </div>
      ) : (
        <>
          <div className="table-scroll">
            <table className="domain-table">
              <thead>
                <tr>
                  <th scope="col">Domain</th>
                  <th scope="col">Expiration date</th>
                  <th scope="col">Time left</th>
                  <th scope="col">Status</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: pageSize }, (_, index) => (
                      <tr className="skeleton-row" key={index} aria-hidden="true">
                        <td><span className="skeleton-line skeleton-line--domain" /></td>
                        <td><span className="skeleton-line" /></td>
                        <td><span className="skeleton-line" /></td>
                        <td><span className="skeleton-line skeleton-line--status" /></td>
                        <td><span className="skeleton-line skeleton-line--action" /></td>
                      </tr>
                    ))
                  : visibleDomains.map((domain) => (
                      <DomainRow
                        domain={domain}
                        key={domain.id}
                        onDelete={onDelete}
                        onEdit={onEdit}
                        onHistory={onHistory}
                        onRenew={onRenew}
                        today={today}
                      />
                    ))}
              </tbody>
            </table>
          </div>

          {!loading && (
            <div className="table-footer">
              <p>
                Showing {filteredDomains.length === 0 ? 0 : startIndex + 1}–
                {Math.min(startIndex + pageSize, filteredDomains.length)} of{" "}
                {filteredDomains.length}{" "}
                {filteredDomains.length === 1 ? "domain" : "domains"}
              </p>
              <nav aria-label="Domain pages" className="pagination">
                <button
                  aria-label="Previous page"
                  className="pagination-arrow"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                  type="button"
                >
                  <ChevronLeft size={18} aria-hidden="true" />
                </button>
                {pageItems.map((item, index) =>
                  typeof item === "number" ? (
                    <button
                      aria-current={item === currentPage ? "page" : undefined}
                      className={
                        item === currentPage
                          ? "pagination-number is-current"
                          : "pagination-number"
                      }
                      key={item}
                      onClick={() => setPage(item)}
                      type="button"
                    >
                      {item}
                    </button>
                  ) : (
                    <span className="pagination-ellipsis" key={item + index}>
                      …
                    </span>
                  ),
                )}
                <button
                  aria-label="Next page"
                  className="pagination-arrow"
                  disabled={currentPage === pageCount}
                  onClick={() => setPage(currentPage + 1)}
                  type="button"
                >
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              </nav>
            </div>
          )}
        </>
      )}
    </section>
  );
}

interface DomainRowProps {
  domain: DomainRecord;
  today: DateOnly;
  onRenew: (domain: DomainRecord) => void;
  onEdit: (domain: DomainRecord) => void;
  onDelete: (domain: DomainRecord) => void;
  onHistory: (domain: DomainRecord) => void;
}

function DomainRow({
  domain,
  today,
  onRenew,
  onEdit,
  onDelete,
  onHistory,
}: DomainRowProps) {
  const dateStatus = getDomainDateStatus(domain.expirationDate, today);
  const StatusIcon = statusIcons[dateStatus.status];

  return (
    <tr>
      <td className="domain-name-cell" data-label="Domain">
        <span className="domain-globe">
          <Globe2 size={21} aria-hidden="true" />
        </span>
        <strong>{domain.domainName}</strong>
      </td>
      <td data-label="Expiration date">{formatDate(domain.expirationDate)}</td>
      <td
        className={"days-left days-left--" + dateStatus.status}
        data-label="Time left"
      >
        {formatRelativeDays(dateStatus.daysRemaining)}
      </td>
      <td data-label="Status">
        <span className={"status-badge status-badge--" + dateStatus.status}>
          <StatusIcon size={17} aria-hidden="true" />
          {statusLabels[dateStatus.status]}
        </span>
      </td>
      <td className="row-actions-cell" data-label="Action">
        <div className="row-actions">
          <button
            className="button button--secondary renew-button"
            onClick={() => onRenew(domain)}
            type="button"
          >
            <RotateCw size={16} aria-hidden="true" />
            Renew
          </button>
          <button
            aria-label={"Edit " + domain.domainName}
            className="icon-button"
            onClick={() => onEdit(domain)}
            title="Edit domain"
            type="button"
          >
            <Pencil size={17} aria-hidden="true" />
          </button>
          <button
            aria-label={"View renewal history for " + domain.domainName}
            className="icon-button"
            onClick={() => onHistory(domain)}
            title="Renewal history"
            type="button"
          >
            <History size={17} aria-hidden="true" />
          </button>
          <button
            aria-label={"Delete " + domain.domainName}
            className="icon-button icon-button--danger"
            onClick={() => onDelete(domain)}
            title="Delete domain"
            type="button"
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function getPageItems(
  currentPage: number,
  pageCount: number,
): Array<number | "start" | "end"> {
  if (pageCount <= 6) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, 5, "end", pageCount];
  }

  if (currentPage >= pageCount - 2) {
    return ["start", pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1, pageCount];
  }

  return [
    1,
    "start",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "end",
    pageCount,
  ];
}
