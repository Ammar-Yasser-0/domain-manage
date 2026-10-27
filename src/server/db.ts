import { neon } from "@neondatabase/serverless";
import { ApiError } from "./http";

type NeonHttpClient = ReturnType<typeof neon>;

let cachedConnectionString: string | undefined;
let cachedClient: NeonHttpClient | undefined;

export function getSql(): NeonHttpClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new ApiError(
      503,
      "DATABASE_NOT_CONFIGURED",
      "The database is not configured yet. Add DATABASE_URL and run the migration.",
    );
  }

  if (!cachedClient || cachedConnectionString !== connectionString) {
    cachedConnectionString = connectionString;
    cachedClient = neon(connectionString);
  }

  return cachedClient;
}
