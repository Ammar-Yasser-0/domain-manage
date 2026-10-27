import { getCairoToday, getDomainDateStatus } from "../../src/lib/domain-date";
import { listDomains } from "../../src/server/domains";
import { methodNotAllowed } from "../../src/server/http";
import { withAuthenticatedApi } from "../../src/server/auth";

async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  const today = getCairoToday();
  const domains = await listDomains();
  const rows = [
    [
      "Domain",
      "Expiration date",
      "Status",
      "Days remaining",
      "Created at",
      "Updated at",
    ],
    ...domains.map((domain) => {
      const dateStatus = getDomainDateStatus(domain.expirationDate, today);
      return [
        domain.domainName,
        domain.expirationDate,
        dateStatus.status,
        String(dateStatus.daysRemaining),
        domain.createdAt,
        domain.updatedAt,
      ];
    }),
  ];
  const csv = "\uFEFF" + rows.map((row) => row.map(quoteCsv).join(",")).join("\r\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="domainflow-domains.csv"',
      "Cache-Control": "no-store",
    },
  });
}

function quoteCsv(value: string): string {
  return '"' + value.replaceAll('"', '""') + '"';
}

export default { fetch: withAuthenticatedApi(handler) };
