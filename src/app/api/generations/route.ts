import { after } from "next/server";

import { apiError, apiSuccess, handleRouteError } from "@/lib/server/api";
import {
  createGenerationJob,
  GenerationServiceError,
  parseGenerationRequest,
  processGenerationJob,
} from "@/lib/server/generation";

const ROUTE = "api/generations";

/** The request is a few small fields; anything larger is not a generation request. */
const MAX_BODY_BYTES = 4 * 1024;

/**
 * Covers the provider timeout (180 s) plus storage, for the work scheduled
 * with `after()`. Vercel caps this by plan; see README "AI generation".
 */
export const maxDuration = 300;

/**
 * POST /api/generations — creates a room-image generation job (Gemini).
 *
 * JSON body (`GenerationRequestBody`): `placeId`, `surface`,
 * `tile: { catalogId, width, height }`. The prompt is built on the server.
 *
 * Responds 202 with the pending job, then generates it after the response
 * (`after()`); poll GET /api/generations/[id] for the result. A future worker
 * takes over by consuming pending jobs instead of this `after()` call.
 */
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("application/json")) {
      return apiError(415, "UNSUPPORTED_MEDIA_TYPE", "Send the request as application/json.");
    }

    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return apiError(413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
    }
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return apiError(400, "INVALID_REQUEST", "Malformed JSON body.");
    }

    const parsed = parseGenerationRequest(body);
    if ("error" in parsed) return apiError(400, "INVALID_REQUEST", parsed.error);

    const job = await createGenerationJob(parsed.data);
    after(() => processGenerationJob(job.id));
    return apiSuccess(job, 202);
  } catch (err) {
    if (err instanceof GenerationServiceError) return apiError(err.status, err.code, err.message);
    return handleRouteError(ROUTE, err);
  }
}
