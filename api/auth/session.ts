import {
  clearSessionCookie,
  getAuthConfiguration,
  getSessionCookie,
  hasAuthConfiguration,
  verifySessionToken,
} from "../../src/server/auth.js";
import {
  jsonResponse,
  methodNotAllowed,
  withApiErrors,
} from "../../src/server/http.js";

async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  if (!hasAuthConfiguration()) {
    return jsonResponse({ configured: false, authenticated: false });
  }

  const configuration = getAuthConfiguration();
  const token = getSessionCookie(request);
  const authenticated = verifySessionToken(token, configuration.sessionSecret);

  return jsonResponse(
    { configured: true, authenticated },
    200,
    token && !authenticated ? { "Set-Cookie": clearSessionCookie() } : {},
  );
}

export default { fetch: withApiErrors(handler) };
