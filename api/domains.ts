import { getCairoToday } from "../src/lib/domain-date";
import { validateDomainInput } from "../src/lib/domain-validation";
import { createDomain, listDomains } from "../src/server/domains";
import {
  ApiError,
  jsonResponse,
  methodNotAllowed,
  readJson,
  withApiErrors,
} from "../src/server/http";

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

export default { fetch: withApiErrors(handler) };
