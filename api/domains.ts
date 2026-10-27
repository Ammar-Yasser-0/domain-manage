import { getCairoToday } from "../src/lib/domain-date.js";
import { validateDomainInput } from "../src/lib/domain-validation.js";
import { createDomain, listDomains } from "../src/server/domains.js";
import {
  ApiError,
  jsonResponse,
  methodNotAllowed,
  readJson,
} from "../src/server/http.js";
import { withAuthenticatedApi } from "../src/server/auth.js";

async function handler(request: Request): Promise<Response> {
  if (request.method === "GET") {
    const items = await listDomains();
    return jsonResponse({ items, today: getCairoToday() });
  }

  if (request.method === "POST") {
    const result = validateDomainInput(await readJson(request));

    if (!result.ok) {
      throw new ApiError(422, "VALIDATION_ERROR", result.message, {
        field: result.field,
      });
    }

    return jsonResponse(
      await createDomain(
        result.value.domainName,
        result.value.expirationDate,
      ),
      201,
    );
  }

  return methodNotAllowed(["GET", "POST"]);
}

export default { fetch: withAuthenticatedApi(handler, ["POST"]) };
