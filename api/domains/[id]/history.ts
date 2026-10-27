import { listRenewalHistory } from "../../../src/server/domains";
import {
  ApiError,
  jsonResponse,
  methodNotAllowed,
  withApiErrors,
} from "../../../src/server/http";

async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  const id = segments.at(-2) ?? "";

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new ApiError(400, "INVALID_DOMAIN_ID", "The domain id is invalid.");
  }

  return jsonResponse({ items: await listRenewalHistory(id) });
}

export default { fetch: withApiErrors(handler) };
