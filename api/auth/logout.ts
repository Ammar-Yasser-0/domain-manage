import { assertSameOrigin, clearSessionCookie } from "../../src/server/auth";
import {
  jsonResponse,
  methodNotAllowed,
  withApiErrors,
} from "../../src/server/http";

async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return methodNotAllowed(["POST"]);
  }

  assertSameOrigin(request);

  return jsonResponse(
    { authenticated: false },
    200,
    { "Set-Cookie": clearSessionCookie() },
  );
}

export default { fetch: withApiErrors(handler) };
