import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { ApiError } from "./http";
import { getSql } from "./db";

export const LOGIN_RATE_LIMIT = 10;
export const LOGIN_RATE_WINDOW_SECONDS = 15 * 60;
export const LOGIN_RATE_BLOCK_SECONDS = 15 * 60;

interface RateLimitRow {
  limited: boolean;
  retry_after_seconds: number | string | null;
}

export interface RateLimitResult {
  limited: boolean;
  retryAfterSeconds: number;
}

export async function recordLoginAttempt(
  request: Request,
  sessionSecret: Buffer,
): Promise<RateLimitResult> {
  const sql = getSql();
  const ipAddress = getClientIp(request);
  const bucketKey = createHmac("sha256", sessionSecret)
    .update("domainflow-login-ip:")
    .update(ipAddress)
    .digest("hex");
  const rows = (await sql.query(
    [
      "INSERT INTO auth_login_attempts",
      "  (bucket_key, window_started_at, attempt_count, blocked_until, updated_at)",
      "VALUES ($1, now(), 1, NULL, now())",
      "ON CONFLICT (bucket_key) DO UPDATE SET",
      "  window_started_at = CASE",
      "    WHEN auth_login_attempts.blocked_until > now()",
      "      THEN auth_login_attempts.window_started_at",
      "    WHEN auth_login_attempts.window_started_at <= now() - ($2::integer * interval '1 second')",
      "      THEN now()",
      "    ELSE auth_login_attempts.window_started_at",
      "  END,",
      "  attempt_count = CASE",
      "    WHEN auth_login_attempts.blocked_until > now()",
      "      THEN auth_login_attempts.attempt_count",
      "    WHEN auth_login_attempts.window_started_at <= now() - ($2::integer * interval '1 second')",
      "      THEN 1",
      "    ELSE auth_login_attempts.attempt_count + 1",
      "  END,",
      "  blocked_until = CASE",
      "    WHEN auth_login_attempts.blocked_until > now()",
      "      THEN auth_login_attempts.blocked_until",
      "    WHEN auth_login_attempts.window_started_at <= now() - ($2::integer * interval '1 second')",
      "      THEN NULL",
      "    WHEN auth_login_attempts.attempt_count + 1 > $4::integer",
      "      THEN now() + ($3::integer * interval '1 second')",
      "    ELSE NULL",
      "  END,",
      "  updated_at = now()",
      "RETURNING",
      "  blocked_until > now() AS limited,",
      "  CASE WHEN blocked_until > now() THEN",
      "    GREATEST(1, CEIL(EXTRACT(EPOCH FROM (blocked_until - now()))))::integer",
      "  ELSE 0 END AS retry_after_seconds",
    ].join("\n"),
    [
      bucketKey,
      LOGIN_RATE_WINDOW_SECONDS,
      LOGIN_RATE_BLOCK_SECONDS,
      LOGIN_RATE_LIMIT,
    ],
  )) as RateLimitRow[];

  if (!rows[0]) {
    throw new ApiError(
      503,
      "LOGIN_THROTTLE_UNAVAILABLE",
      "Sign-in is temporarily unavailable.",
    );
  }

  await sql
    .query(
      "DELETE FROM auth_login_attempts WHERE updated_at < now() - interval '24 hours'",
    )
    .catch(() => undefined);

  return {
    limited: Boolean(rows[0]?.limited),
    retryAfterSeconds: Number(rows[0]?.retry_after_seconds ?? 0),
  };
}

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const candidate = forwardedFor?.split(",", 1)[0]?.trim() ?? "";

  // Vercel overwrites X-Forwarded-For at its edge before invoking functions.
  // Invalid or missing values share one bounded fallback bucket.
  return isIP(candidate) ? candidate : "unknown";
}
