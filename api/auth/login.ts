import {
  assertSameOrigin,
  createSessionToken,
  getAuthConfiguration,
  sessionCookie,
  verifyPassword,
} from "../../src/server/auth";
import { recordLoginAttempt } from "../../src/server/login-rate-limit";
import {
  ApiError,
  jsonResponse,
  methodNotAllowed,
  readJson,
  withApiErrors,
} from "../../src/server/http";

async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return methodNotAllowed(["POST"]);
  }

  assertSameOrigin(request);
  const configuration = getAuthConfiguration();
  const rateLimit = await recordLoginAttempt(request, configuration.sessionSecret);

  if (rateLimit.limited) {
    return jsonResponse(
      {
        error: {
          code: "RATE_LIMITED",
          message: "Too many sign-in attempts. Try again shortly.",
        },
      },
      429,
      { "Retry-After": String(rateLimit.retryAfterSeconds) },
    );
  }

  const body = await readJson(request, 4096);

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    typeof (body as Record<string, unknown>).password !== "string"
  ) {
    throw new ApiError(422, "VALIDATION_ERROR", "Enter your password.");
  }

  const password = (body as { password: string }).password;
  const matches = await verifyPassword(password, configuration.passwordHash);

  if (!matches) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "The password is incorrect.");
  }

  const token = createSessionToken(configuration.sessionSecret);

  return jsonResponse(
    { authenticated: true },
    200,
    { "Set-Cookie": sessionCookie(token) },
  );
}

export default { fetch: withApiErrors(handler) };
