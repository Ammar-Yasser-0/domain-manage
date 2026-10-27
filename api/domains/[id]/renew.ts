import { validateRenewalYears } from "../../../src/lib/domain-validation.js";
import { renewDomain } from "../../../src/server/domains.js";
import {
  ApiError,
  jsonResponse,
  methodNotAllowed,
  readJson,
} from "../../../src/server/http.js";
import { withAuthenticatedApi } from "../../../src/server/auth.js";

async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return methodNotAllowed(["POST"]);
  }

  const id = getDomainId(request);
  const body = await readJson(request);

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiError(422, "VALIDATION_ERROR", "Choose a renewal period.");
  }

  const result = validateRenewalYears((body as Record<string, unknown>).years);

  if (!result.ok) {
    throw new ApiError(422, "VALIDATION_ERROR", result.message, {
      field: result.field,
    });
  }

  return jsonResponse(await renewDomain(id, result.value));
}

function getDomainId(request: Request): string {
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  const id = segments.at(-2) ?? "";

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new ApiError(400, "INVALID_DOMAIN_ID", "The domain id is invalid.");
  }

  return id;
}

export default { fetch: withAuthenticatedApi(handler, ["POST"]) };
