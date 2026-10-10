import { connection } from "next/server";

import { apiError, apiSuccess, handleRouteError } from "@/lib/server/api";
import { STORAGE_BUCKETS, isNotFound, storageErrorResponse } from "@/lib/server/storage";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import type { StorageBucket, StorageHealthData } from "@/types/api";

const ROUTE = "api/health/storage";

/**
 * GET /api/health/storage — the secret key works and every bucket exists with
 * the expected visibility. Read-only: it never creates or changes buckets.
 */
export async function GET() {
  // Always run at request time, never at build.
  await connection();

  try {
    const storage = getSupabaseAdmin().storage;
    const problems: string[] = [];

    for (const [id, expected] of Object.entries(STORAGE_BUCKETS) as [StorageBucket, { public: boolean }][]) {
      const { data, error } = await storage.getBucket(id);
      if (error) {
        if (isNotFound(error)) {
          problems.push(`${id} is missing`);
          continue;
        }
        return storageErrorResponse(ROUTE, error);
      }
      if (data.public !== expected.public) {
        problems.push(`${id} should be ${expected.public ? "public" : "private"}`);
      }
    }

    if (problems.length > 0) {
      console.error(`[${ROUTE}]`, problems.join("; "));
      return apiError(
        503,
        "STORAGE_NOT_CONFIGURED",
        `Storage buckets are not set up: ${problems.join("; ")}. Run the storage migration.`,
      );
    }

    const buckets = Object.fromEntries(
      Object.keys(STORAGE_BUCKETS).map((id) => [id, "ok"]),
    ) as StorageHealthData["buckets"];
    return apiSuccess<StorageHealthData>({ status: "ok", buckets, timestamp: new Date().toISOString() });
  } catch (err) {
    return handleRouteError(ROUTE, err);
  }
}
