import type {
  DomainInput,
  DomainMutationResponse,
  DomainsResponse,
  RenewalHistoryResponse,
  RenewalMutationResponse,
} from "../types/domain";

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code = "REQUEST_FAILED",
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    headers,
    cache: "no-store",
    credentials: "same-origin",
  });
  const payload = response.status === 204
    ? undefined
    : await response.json().catch(() => undefined);

  if (!response.ok) {
    const error = (payload as ApiErrorBody | undefined)?.error;
    throw new ApiClientError(
      error?.message ?? "The request could not be completed. Please try again.",
      response.status,
      error?.code,
    );
  }

  if (response.status !== 204 && payload === undefined) {
    throw new ApiClientError(
      "The server returned an unexpected response.",
      response.status,
      "INVALID_RESPONSE",
    );
  }

  return payload as T;
}

export function getDomains(): Promise<DomainsResponse> {
  return request("/api/domains");
}

export function createDomain(
  input: DomainInput,
): Promise<DomainMutationResponse> {
  return request("/api/domains", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateDomain(
  id: string,
  input: DomainInput,
): Promise<DomainMutationResponse> {
  return request("/api/domains/" + encodeURIComponent(id), {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteDomain(id: string): Promise<void> {
  return request("/api/domains/" + encodeURIComponent(id), {
    method: "DELETE",
  });
}

export function renewDomain(
  id: string,
  years: number,
): Promise<RenewalMutationResponse> {
  return request("/api/domains/" + encodeURIComponent(id) + "/renew", {
    method: "POST",
    body: JSON.stringify({ years }),
  });
}

export function getRenewalHistory(
  id: string,
): Promise<RenewalHistoryResponse> {
  return request("/api/domains/" + encodeURIComponent(id) + "/history");
}
