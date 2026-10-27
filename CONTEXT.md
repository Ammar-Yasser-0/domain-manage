# Domain Context: DomainFlow

## Language

### Canonical terms

**Domain** — a normalized domain name and its currently recorded expiration date; it is a renewal record, not a registrar account.

**Expiration date** — a calendar date stored as PostgreSQL DATE and represented as YYYY-MM-DD; it has no time or timezone component.

**Status** — a value derived from the difference between the expiration date and today's calendar date in Africa/Cairo; it is not persisted.

**Renewal** — a planning record that advances the stored expiration date by a number of whole years and records the old and new dates; it does not contact or renew a registrar account.

**Authorized user** — a Vercel account that has access to the protected deployment; the application has no separate user table or password login.

### Avoid

| Instead of | Use | Reason |
|---|---|---|
| domain account | domain | The app stores domain renewal records, not registrar credentials or accounts. |
| expiry timestamp | expiration date | Expiration is a date-only calendar value. |
| renewal completed with registrar | renewal recorded | DomainFlow updates its own schedule and does not call a registrar. |
| active boolean | domain status | Status is derived and has three mutually exclusive values. |

## Seams

Vercel Deployment Protection authenticates access to the UI and same-origin API routes. DomainFlow owns validation, renewal calculations, and database persistence. Neon stores dates and renewal history; the app does not register, transfer, or renew names with a registrar.
