import "server-only";

import type { ApiErrorCode } from "@/types/api";

/** The fields this module reads from a supabase-js `PostgrestError`. */
export interface DatabaseError {
  code: string;
  message: string;
}

export interface ClassifiedDatabaseError {
  status: number;
  code: ApiErrorCode;
  /** Fixed, client-safe text; never the PostgREST message. */
  message: string;
}

/**
 * Maps a failed PostgREST query to a client-safe error. The PostgREST
 * code/message go to the server log only.
 */
export function classifyDatabaseError(
  route: string,
  status: number,
  error: DatabaseError,
): ClassifiedDatabaseError {
  console.error(`[${route}] Supabase query failed (HTTP ${status}):`, error.code, error.message);
  // supabase-js reports network failures as status 0 rather than throwing.
  if (status === 0) {
    return { status: 503, code: "DATABASE_UNREACHABLE", message: "Could not reach Supabase." };
  }
  if (error.code === "PGRST205" || error.code === "42P01") {
    return {
      status: 503,
      code: "DATABASE_SCHEMA_MISSING",
      message: "Catalog tables not found. Run the catalog migration.",
    };
  }
  // Checked before the 401/403 case: PostgREST answers 42501 with 401.
  if (error.code === "42501") {
    return {
      status: 503,
      code: "DATABASE_PERMISSION_DENIED",
      message: "Read access denied. Re-run the catalog migration.",
    };
  }
  if (status === 401 || status === 403) {
    return {
      status: 503,
      code: "DATABASE_AUTH_FAILED",
      message: "Supabase rejected the API key. Check NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    };
  }
  return { status: 503, code: "DATABASE_QUERY_FAILED", message: "Database query failed." };
}
