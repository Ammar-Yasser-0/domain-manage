import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
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

  const migrationsUrl = new URL("../migrations/", import.meta.url);
  const migrationsPath = fileURLToPath(migrationsUrl);
  const migrationFiles = (await readdir(migrationsPath))
    .filter((file) => /^\d+_[a-z0-9_-]+\.sql$/i.test(file))
    .sort((left, right) => {
      const leftVersion = Number(left.split("_", 1)[0]);
      const rightVersion = Number(right.split("_", 1)[0]);
      return leftVersion - rightVersion || left.localeCompare(right);
    });
  const pool = new Pool({ connectionString, max: 1 });
  const client = await pool.connect();
  let lockAcquired = false;

  try {
    await client.query("SELECT pg_advisory_lock(31876, 2048)");
    lockAcquired = true;
    await client.query(
      "CREATE TABLE IF NOT EXISTS domainflow_schema_migrations (" +
        "version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
    );

    for (const migrationFile of migrationFiles) {
      await client.query("BEGIN");

      try {
        const alreadyApplied = await client.query(
          "SELECT version FROM domainflow_schema_migrations WHERE version = $1",
          [migrationFile],
        );

        if (alreadyApplied.rows.length > 0) {
          await client.query("COMMIT");
          console.log("Skipped applied migration " + migrationFile + ".");
          continue;
        }

        const migration = await readFile(
          new URL(migrationFile, migrationsUrl),
          "utf8",
        );
        await client.query(migration);
        await client.query(
          "INSERT INTO domainflow_schema_migrations (version) VALUES ($1)",
          [migrationFile],
        );
        await client.query("COMMIT");
        console.log("Applied migration " + migrationFile + ".");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      }
    }
  } catch (error) {
    const errorCode =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "unknown";
    console.error("Database migration failed.", { errorCode });
    process.exitCode = 1;
  } finally {
    if (lockAcquired) {
      await client.query("SELECT pg_advisory_unlock(31876, 2048)").catch(() => undefined);
    }
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const errorName = error instanceof Error ? error.name : "UnknownError";
  console.error("Database migration could not start.", { errorName });
  process.exitCode = 1;
});
