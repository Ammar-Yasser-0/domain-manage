import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Pool } from "@neondatabase/serverless";

async function main(): Promise<void> {
  const envPath = fileURLToPath(new URL("../.env", import.meta.url));

  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to run migrations.");
  }

  const migration = await readFile(
    new URL("../migrations/001_create_domainflow_tables.sql", import.meta.url),
    "utf8",
  );
  const pool = new Pool({ connectionString, max: 1 });
  let transactionStarted = false;

  try {
    await pool.query("BEGIN");
    transactionStarted = true;
    await pool.query(migration);
    await pool.query("COMMIT");
    transactionStarted = false;
    console.log("Applied migration 001_create_domainflow_tables.sql.");
  } catch (error) {
    if (transactionStarted) {
      await pool.query("ROLLBACK").catch(() => undefined);
    }

    const errorCode =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "unknown";
    console.error("Database migration failed.", { errorCode });
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const errorName = error instanceof Error ? error.name : "UnknownError";
  console.error("Database migration could not start.", { errorName });
  process.exitCode = 1;
});
