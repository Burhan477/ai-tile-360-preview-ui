import { connection } from "next/server";

import { apiError, apiSuccess, handleRouteError } from "@/lib/server/api";
import { classifyDatabaseError } from "@/lib/server/database";
import { getSupabase } from "@/lib/server/supabase";
import type { DatabaseHealthData } from "@/types/api";

const ROUTE = "api/health/database";

/**
 * GET /api/health/database — confirms the server can reach Supabase and that
 * the catalog migration has been applied, with one read-only, single-row
 * query. Clients get a stable error code and a fixed message; the PostgREST
 * code/message go to the server log only.
 */
export async function GET() {
  // Always run at request time, never at build.
  await connection();

  try {
    const started = performance.now();
    // A GET, not `head: true`: HEAD responses have no body, so supabase-js
    // reports a missing table as success with a null count instead of PGRST205.
    const { count, error, status } = await getSupabase()
      .from("room_types")
      .select("id", { count: "exact" })
      .limit(1);
    const latencyMs = Math.round(performance.now() - started);

    if (error) {
      const failure = classifyDatabaseError(ROUTE, status, error);
      return apiError(failure.status, failure.code, failure.message);
    }

    // PostgREST always reports an exact count; without one the request
    // reached something else (e.g. a wrong project URL that still answers).
    if (count === null) {
      console.error(`[${ROUTE}] Response (HTTP ${status}) had no row count.`);
      return apiError(
        503,
        "DATABASE_UNEXPECTED_RESPONSE",
        "Unexpected response from Supabase. Check NEXT_PUBLIC_SUPABASE_URL.",
      );
    }

    return apiSuccess<DatabaseHealthData>({
      status: "ok",
      database: "reachable",
      roomTypes: count,
      latencyMs,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return handleRouteError(ROUTE, err);
  }
}
