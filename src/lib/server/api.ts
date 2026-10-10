import "server-only";

import { ServerConfigError } from "@/lib/server/env";
import type { ApiErrorCode, ApiFailure, ApiSuccess } from "@/types/api";

// API responses describe live server state; never let a CDN or browser reuse them.
const NO_STORE = { "Cache-Control": "no-store" };

export function apiSuccess<T>(data: T, status = 200): Response {
  return Response.json({ ok: true, data } satisfies ApiSuccess<T>, { status, headers: NO_STORE });
}

/** `message` is sent to the client as-is: never pass raw database errors, env values or stack traces. */
export function apiError(status: number, code: ApiErrorCode, message: string): Response {
  return Response.json({ ok: false, error: { code, message } } satisfies ApiFailure, {
    status,
    headers: NO_STORE,
  });
}

/**
 * Last-resort handler for a Route Handler's `catch`. Config errors name the
 * missing/invalid variables (never their values); anything else is logged
 * server-side and returned as a generic 500.
 */
export function handleRouteError(route: string, err: unknown): Response {
  if (err instanceof ServerConfigError) {
    console.error(`[${route}]`, err.message);
    return apiError(500, "CONFIG_INVALID", err.message);
  }
  console.error(`[${route}] Unexpected error:`, err);
  return apiError(500, "INTERNAL_ERROR", "Internal server error.");
}
