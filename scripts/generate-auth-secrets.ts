import { chmod, readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { StringDecoder } from "node:string_decoder";
import { resolve } from "node:path";
import { createPasswordHash } from "../src/server/auth";

async function main(): Promise<void> {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    throw new Error("Run `npm run auth:setup` in an interactive terminal.");
  }

  const envPath = resolve(process.cwd(), ".env");
  let existing = "";

  try {
    existing = await readFile(envPath, "utf8");
  } catch (error) {
    if (!isMissingFile(error)) {
      throw error;
    }
  }

  if (/^\s*(APP_PASSWORD_HASH|SESSION_SECRET)\s*=/m.test(existing)) {
    throw new Error(
      ".env already contains authentication values. Remove those two entries before generating replacements.",
    );
  }

  let password = await readHidden("Choose the DomainFlow password (12+ characters): ");

  if ([...password].length < 12 || Buffer.byteLength(password, "utf8") > 1024) {
    password = "";
    throw new Error("Use a password with at least 12 characters and no more than 1024 UTF-8 bytes.");
  }

  const confirmation = await readHidden("Confirm the password: ");

  if (password !== confirmation) {
    password = "";
    throw new Error("The passwords did not match. No values were written.");
  }

  const passwordHash = await createPasswordHash(password);
  password = "";
  const sessionSecret = randomBytes(32).toString("base64url");
  const separator = existing.length === 0 || existing.endsWith("\n") ? "" : "\n";
  const nextContents =
    existing +
    separator +
    "# DomainFlow server-side authentication secrets. Do not commit this file.\n" +
    "APP_PASSWORD_HASH=" +
    passwordHash +
    "\nSESSION_SECRET=" +
    sessionSecret +
    "\n";

  await writeFile(envPath, nextContents, { encoding: "utf8", mode: 0o600 });

  if (process.platform !== "win32") {
    await chmod(envPath, 0o600);
  }

  console.log("Generated APP_PASSWORD_HASH and SESSION_SECRET in the ignored .env file.");
  console.log("Copy only those two values to Vercel Environment Variables; do not commit .env.");
}

function readHidden(prompt: string): Promise<string> {
  return new Promise((resolvePrompt, rejectPrompt) => {
    const input = process.stdin;
    const decoder = new StringDecoder("utf8");
    let value = "";
    let settled = false;

    function cleanup(): void {
      if (settled) {
        return;
      }

      settled = true;
      input.off("data", onData);
      input.setRawMode(false);
      process.stdout.write("\n");
    }

    function onData(chunk: Buffer): void {
      for (const character of decoder.write(chunk)) {
        if (character === "\u0003" || character === "\u0004") {
          cleanup();
          rejectPrompt(new Error("Password setup cancelled."));
          return;
        }

        if (character === "\r" || character === "\n") {
          cleanup();
          resolvePrompt(value);
          return;
        }

        if (character === "\u007f" || character === "\b") {
          value = [...value].slice(0, -1).join("");
        } else if (character >= " ") {
          value += character;
        }
      }
    }

    process.stdout.write(prompt);
    input.setRawMode(true);
    input.resume();
    input.on("data", onData);
  });
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown setup error.";
  console.error(message);
  process.exitCode = 1;
});
