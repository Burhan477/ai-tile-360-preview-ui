import { connection } from "next/server";

import { apiSuccess, handleRouteError } from "@/lib/server/api";
import { getStorageEnv, getSupabaseEnv, getSupabaseSecretKey } from "@/lib/server/env";
import type { HealthData } from "@/types/api";

/**
 * GET /api/health — the app is up and its required configuration is present
 * and well-formed. Contacts nothing; see /api/health/database and
 * /api/health/storage.
 */
export async function GET() {
  // Always run at request time, never at build.
  await connection();

  try {
    getSupabaseEnv();
    getSupabaseSecretKey();
    getStorageEnv();
    return apiSuccess<HealthData>({
      status: "ok",
      checks: { config: "ok" },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return handleRouteError("api/health", err);
  }
}
