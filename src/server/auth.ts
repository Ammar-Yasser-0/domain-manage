import {
  createHmac,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { ApiError, withApiErrors } from "./http";

export const SESSION_LIFETIME_SECONDS = 7 * 24 * 60 * 60;

const SCRYPT_N = 32_768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;
const SCRYPT_SALT_LENGTH = 16;
const MAX_PASSWORD_BYTES = 1024;
const CLOCK_SKEW_SECONDS = 60;

interface PasswordHash {
  salt: Buffer;
  derivedKey: Buffer;
}

export interface AuthConfiguration {
  passwordHash: PasswordHash;
  sessionSecret: Buffer;
}

interface SessionPayload {
  v: 1;
  sub: "domainflow";
  iat: number;
  exp: number;
}

export function getAuthConfiguration(): AuthConfiguration {
  const encodedPasswordHash = process.env.APP_PASSWORD_HASH;
  const encodedSessionSecret = process.env.SESSION_SECRET;
  const passwordHash = encodedPasswordHash
    ? parsePasswordHash(encodedPasswordHash)
    : null;
  const sessionSecret = encodedSessionSecret
    ? parseSessionSecret(encodedSessionSecret)
    : null;

  if (!passwordHash || !sessionSecret) {
    throw new ApiError(
      503,
      "AUTH_NOT_CONFIGURED",
      "Authentication is not configured yet.",
    );
  }

  return { passwordHash, sessionSecret };
}

export function hasAuthConfiguration(): boolean {
  try {
    getAuthConfiguration();
    return true;
  } catch {
    return false;
  }
}

export async function createPasswordHash(password: string): Promise<string> {
  const passwordBytes = Buffer.from(password, "utf8");

  if (passwordBytes.byteLength < 12 || passwordBytes.byteLength > MAX_PASSWORD_BYTES) {
    throw new Error("The password must be at least 12 bytes and at most 1024 bytes.");
  }

  const salt = randomBytes(SCRYPT_SALT_LENGTH);
  const derivedKey = await deriveScryptKey(passwordBytes, salt);

  return [
    "scrypt",
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt.toString("base64url"),
    derivedKey.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  passwordHash: PasswordHash,
): Promise<boolean> {
  const passwordBytes = Buffer.from(password, "utf8");

  if (passwordBytes.byteLength > MAX_PASSWORD_BYTES) {
    return false;
  }

  const candidate = await deriveScryptKey(passwordBytes, passwordHash.salt);

  return timingSafeEqual(candidate, passwordHash.derivedKey);
}

export function createSessionToken(
  sessionSecret: Buffer,
  now = Date.now(),
): string {
  const issuedAt = Math.floor(now / 1000);
  const payload: SessionPayload = {
    v: 1,
    sub: "domainflow",
    iat: issuedAt,
    exp: issuedAt + SESSION_LIFETIME_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signPayload(encodedPayload, sessionSecret).toString("base64url");

  return encodedPayload + "." + signature;
}

export function verifySessionToken(
  token: string | null,
  sessionSecret: Buffer,
  now = Date.now(),
): boolean {
  if (!token || token.length > 512) {
    return false;
  }

  const parts = token.split(".");

  if (
    parts.length !== 2 ||
    !isBase64Url(parts[0]) ||
    !isBase64Url(parts[1])
  ) {
    return false;
  }

  const suppliedSignature = Buffer.from(parts[1], "base64url");
  const expectedSignature = signPayload(parts[0], sessionSecret);

  if (
    suppliedSignature.byteLength !== expectedSignature.byteLength ||
    !timingSafeEqual(suppliedSignature, expectedSignature)
  ) {
    return false;
  }

  let payload: unknown;

  try {
    payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as unknown;
  } catch {
    return false;
  }

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return false;
  }

  const candidate = payload as Partial<SessionPayload>;
  const nowSeconds = Math.floor(now / 1000);

  return (
    candidate.v === 1 &&
    candidate.sub === "domainflow" &&
    Number.isSafeInteger(candidate.iat) &&
    Number.isSafeInteger(candidate.exp) &&
    candidate.exp! - candidate.iat! === SESSION_LIFETIME_SECONDS &&
    candidate.iat! <= nowSeconds + CLOCK_SKEW_SECONDS &&
    candidate.exp! > nowSeconds
  );
}

export function getSessionCookieName(): string {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1"
    ? "__Host-domainflow_session"
    : "domainflow_session";
}

export function getSessionCookie(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");

  if (!cookieHeader) {
    return null;
  }

  const name = getSessionCookieName();

  for (const cookie of cookieHeader.split(";")) {
    const separator = cookie.indexOf("=");

    if (separator < 0 || cookie.slice(0, separator).trim() !== name) {
      continue;
    }

    return cookie.slice(separator + 1).trim();
  }

  return null;
}

export function sessionCookie(token: string): string {
  return [
    getSessionCookieName() + "=" + token,
    "Path=/",
    "Max-Age=" + SESSION_LIFETIME_SECONDS,
    "HttpOnly",
    "SameSite=Strict",
    ...(usesSecureCookie() ? ["Secure"] : []),
  ].join("; ");
}

export function clearSessionCookie(): string {
  return [
    getSessionCookieName() + "=",
    "Path=/",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "HttpOnly",
    "SameSite=Strict",
    ...(usesSecureCookie() ? ["Secure"] : []),
  ].join("; ");
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const requestOrigin = new URL(request.url).origin;
  const fetchSite = request.headers.get("sec-fetch-site");

  if (
    !origin ||
    origin !== requestOrigin ||
    (fetchSite !== null && fetchSite !== "same-origin")
  ) {
    throw new ApiError(
      403,
      "CSRF_REJECTED",
      "The request origin could not be verified.",
    );
  }
}

export function withAuthenticatedApi(
  handler: (request: Request) => Promise<Response>,
  stateChangingMethods: string[] = [],
): (request: Request) => Promise<Response> {
  return withApiErrors(async (request) => {
    const configuration = getAuthConfiguration();
    const token = getSessionCookie(request);

    if (!verifySessionToken(token, configuration.sessionSecret)) {
      throw new ApiError(401, "UNAUTHENTICATED", "Log in to continue.");
    }

    if (stateChangingMethods.includes(request.method)) {
      assertSameOrigin(request);
    }

    return handler(request);
  });
}

function parsePasswordHash(value: string): PasswordHash | null {
  const parts = value.split("$");

  if (
    parts.length !== 6 ||
    parts[0] !== "scrypt" ||
    parts[1] !== String(SCRYPT_N) ||
    parts[2] !== String(SCRYPT_R) ||
    parts[3] !== String(SCRYPT_P) ||
    !isBase64Url(parts[4]) ||
    !isBase64Url(parts[5])
  ) {
    return null;
  }

  const salt = Buffer.from(parts[4], "base64url");
  const derivedKey = Buffer.from(parts[5], "base64url");

  if (
    salt.byteLength !== SCRYPT_SALT_LENGTH ||
    derivedKey.byteLength !== SCRYPT_KEY_LENGTH ||
    salt.toString("base64url") !== parts[4] ||
    derivedKey.toString("base64url") !== parts[5]
  ) {
    return null;
  }

  return { salt, derivedKey };
}

function parseSessionSecret(value: string): Buffer | null {
  if (!isBase64Url(value)) {
    return null;
  }

  const secret = Buffer.from(value, "base64url");

  return secret.byteLength >= 32 && secret.toString("base64url") === value
    ? secret
    : null;
}

function signPayload(payload: string, secret: Buffer): Buffer {
  return createHmac("sha256", secret).update(payload).digest();
}

function deriveScryptKey(password: Buffer, salt: Buffer): Promise<Buffer> {
  return new Promise((resolveKey, rejectKey) => {
    scrypt(
      password,
      salt,
      SCRYPT_KEY_LENGTH,
      {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
        maxmem: SCRYPT_MAX_MEMORY,
      },
      (error, derivedKey) => {
        if (error) {
          rejectKey(error);
        } else {
          resolveKey(derivedKey);
        }
      },
    );
  });
}

function isBase64Url(value: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(value);
}

function usesSecureCookie(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}
