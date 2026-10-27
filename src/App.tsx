import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Clock3,
  Globe2,
  LockKeyhole,
  Plus,
  ShieldCheck,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import {
  createDomain,
  deleteDomain,
  getDomains,
  renewDomain,
  updateDomain,
} from "./lib/api";
import { getCairoToday } from "./lib/domain-date";
import { countDomains, type DomainFilter } from "./lib/domain-list";
import { formatDate } from "./lib/format";
import type {
  DateOnly,
  DomainInput,
  DomainRecord,
} from "./types/domain";
import { DeleteDomainDialog } from "./components/DeleteDomainDialog";
import { DomainFormDialog } from "./components/DomainFormDialog";
import { DomainTable } from "./components/DomainTable";
import { HistoryDialog } from "./components/HistoryDialog";
import { RenewalDialog } from "./components/RenewalDialog";
import { StatCard } from "./components/StatCard";
import { Toast, type ToastMessage } from "./components/Toast";

type DialogState =
  | { type: "form"; mode: "add" }
  | { type: "form"; mode: "edit"; domain: DomainRecord }
  | { type: "renew"; domain: DomainRecord }
  | { type: "delete"; domain: DomainRecord }
  | { type: "history"; domain: DomainRecord }
  | null;

export default function App() {
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [today, setToday] = useState<DateOnly>(() => getCairoToday());
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState<DomainFilter>("all");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const loadDomains = useCallback(async (showLoading: boolean) => {
    if (showLoading) {
      setLoading(true);
    }

    setLoadError("");

    try {
      const response = await getDomains();
      setDomains(response.items);
      setToday(response.today);
      setHasLoaded(true);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "The domain list could not be loaded. Please try again.",
      );
      setHasLoaded(true);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadDomains(true);
  }, [loadDomains]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const counts = useMemo(() => countDomains(domains, today), [domains, today]);

  async function handleSaveDomain(input: DomainInput) {
    if (!dialog || dialog.type !== "form") {
      return;
    }

    if (dialog.mode === "add") {
      const response = await createDomain(input);
      setDomains((current) => [response.item, ...current]);
      setFilter("all");
      setDialog(null);
      setToast({ kind: "success", text: "Domain added successfully." });
    } else {
      const response = await updateDomain(dialog.domain.id, input);
      setDomains((current) =>
        current.map((domain) =>
          domain.id === response.item.id ? response.item : domain,
        ),
      );
      setDialog(null);
      setToast({ kind: "success", text: "Domain details updated." });
    }

    void loadDomains(false);
  }

  async function handleRenewDomain(years: number) {
    if (!dialog || dialog.type !== "renew") {
      return;
    }

    const response = await renewDomain(dialog.domain.id, years);
    setDomains((current) =>
      current.map((domain) =>
        domain.id === response.item.id ? response.item : domain,
      ),
    );
    setDialog(null);
    setToast({
      kind: "success",
      text:
        "Renewal recorded. New expiration: " +
        formatDate(response.item.expirationDate) +
        ".",
    });
    void loadDomains(false);
  }

  async function handleDeleteDomain() {
    if (!dialog || dialog.type !== "delete") {
      return;
    }

    const domainName = dialog.domain.domainName;
    await deleteDomain(dialog.domain.id);
    setDomains((current) =>
      current.filter((domain) => domain.id !== dialog.domain.id),
    );
    setDialog(null);
    setToast({ kind: "success", text: domainName + " was deleted." });
    void loadDomains(false);
  }

  function selectFilter(nextFilter: DomainFilter) {
    setFilter(nextFilter);
  }

  const statValue = (value: number) => (hasLoaded ? value : "—");

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <a aria-label="DomainFlow home" className="brand" href="/">
            <span className="brand-icon">
              <Globe2 size={29} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <strong>DomainFlow</strong>
          </a>
          <span aria-hidden="true" className="brand-divider" />
          <span className="product-label">Domain Renewal Manager</span>

          <div className="topbar-spacer" />
          <div aria-label="Private workspace" className="workspace-badge">
            <LockKeyhole size={17} aria-hidden="true" />
            <span>Private workspace</span>
            <ChevronDown size={16} aria-hidden="true" />
          </div>
          <span aria-hidden="true" className="topbar-divider" />
          <div
            aria-label="Access managed by Vercel Authentication"
            className="account-display"
            title="Access managed by Vercel Authentication"
          >
            <span className="account-avatar">
              <UserRound size={19} aria-hidden="true" />
            </span>
          </div>
        </div>
      </header>

      <main className="dashboard-main mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <section aria-labelledby="page-title" className="page-heading">
          <div className="page-heading-copy">
            <p className="eyebrow">Overview</p>
            <h1 id="page-title">Domain renewals</h1>
            <p className="page-description">
              Stay ahead of every expiration, all in one place.
            </p>
          </div>
          <button
            className="button button--primary add-domain-button"
            onClick={() => setDialog({ type: "form", mode: "add" })}
            type="button"
          >
            <Plus size={20} strokeWidth={2.3} aria-hidden="true" />
            Add domain
          </button>
        </section>

        <section aria-label="Domain overview" className="stats-grid">
          <StatCard
            filter="all"
            icon={Globe2}
            label="Total domains"
            onClick={selectFilter}
            selected={filter === "all"}
            tone="blue"
            value={statValue(counts.all)}
          />
          <StatCard
            filter="active"
            icon={CheckCircle2}
            label="Active"
            onClick={selectFilter}
            selected={filter === "active"}
            tone="green"
            value={statValue(counts.active)}
          />
          <StatCard
            filter="expiring-soon"
            icon={Clock3}
            label="Expiring soon"
            onClick={selectFilter}
            selected={filter === "expiring-soon"}
            tone="amber"
            value={statValue(counts["expiring-soon"])}
          />
          <StatCard
            filter="expired"
            icon={TriangleAlert}
            label="Expired"
            onClick={selectFilter}
            selected={filter === "expired"}
            tone="red"
            value={statValue(counts.expired)}
          />
        </section>

        <DomainTable
          domains={domains}
          filter={filter}
          loadError={loadError}
          loading={loading}
          onAdd={() => setDialog({ type: "form", mode: "add" })}
          onDelete={(domain) => setDialog({ type: "delete", domain })}
          onEdit={(domain) => setDialog({ type: "form", mode: "edit", domain })}
          onFilterChange={selectFilter}
          onHistory={(domain) => setDialog({ type: "history", domain })}
          onRenew={(domain) => setDialog({ type: "renew", domain })}
          onRetry={() => void loadDomains(true)}
          today={today}
        />

        <footer className="page-footer">
          <span className="footer-lock">
            <ShieldCheck size={15} aria-hidden="true" />
            Private by design
          </span>
          <span>Dates are evaluated in Africa/Cairo.</span>
        </footer>
      </main>

      {dialog?.type === "form" && (
        <DomainFormDialog
          domain={dialog.mode === "edit" ? dialog.domain : undefined}
          mode={dialog.mode}
          onClose={() => setDialog(null)}
          onSubmit={handleSaveDomain}
        />
      )}
      {dialog?.type === "renew" && (
        <RenewalDialog
          domain={dialog.domain}
          onClose={() => setDialog(null)}
          onHistory={() => setDialog({ type: "history", domain: dialog.domain })}
          onSubmit={handleRenewDomain}
        />
      )}
      {dialog?.type === "delete" && (
        <DeleteDomainDialog
          domain={dialog.domain}
          onClose={() => setDialog(null)}
          onConfirm={handleDeleteDomain}
        />
      )}
      {dialog?.type === "history" && (
        <HistoryDialog
          domain={dialog.domain}
          onClose={() => setDialog(null)}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
