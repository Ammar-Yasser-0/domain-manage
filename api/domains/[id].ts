import { validateDomainInput } from "../../src/lib/domain-validation";
import { deleteDomain, updateDomain } from "../../src/server/domains";
import {
  ApiError,
  jsonResponse,
  methodNotAllowed,
  readJson,
  withApiErrors,
} from "../../src/server/http";

async function handler(request: Request): Promise<Response> {
  const id = getDomainId(request);

  if (request.method === "PUT") {
    const result = validateDomainInput(await readJson(request));

    if (!result.ok) {
      throw new ApiError(422, "VALIDATION_ERROR", result.message, {
        field: result.field,
      });
    }

    return jsonResponse(
      await updateDomain(
        id,
        result.value.domainName,
        result.value.expirationDate,
      ),
    );
  }

  if (request.method === "DELETE") {
    await deleteDomain(id);
    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return methodNotAllowed(["PUT", "DELETE"]);
}

function getDomainId(request: Request): string {
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  const id = segments.at(-1) ?? "";

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new ApiError(400, "INVALID_DOMAIN_ID", "The domain id is invalid.");
  }

  return id;
}

export default { fetch: withApiErrors(handler) };
