import type { NextRequest } from "next/server";

import { apiError, apiSuccess, handleRouteError } from "@/lib/server/api";
import { GenerationServiceError, getGenerationJob, isGenerationId } from "@/lib/server/generation";

const ROUTE = "api/generations/[id]";

/**
 * GET /api/generations/[id] — a generation job's status, and once it has
 * succeeded, its stored image with a fresh signed URL.
 *
 * No auth in the POC: job ids are random UUIDs, so knowing one is what
 * grants access to its result.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/generations/[id]">) {
  const { id } = await ctx.params;
  if (!isGenerationId(id)) {
    return apiError(400, "INVALID_REQUEST", "Generation id must be a UUID.");
  }

  try {
    const job = await getGenerationJob(id);
    if (!job) return apiError(404, "NOT_FOUND", "Generation not found.");
    return apiSuccess(job);
  } catch (err) {
    if (err instanceof GenerationServiceError) return apiError(err.status, err.code, err.message);
    return handleRouteError(ROUTE, err);
  }
}
