import "server-only";

import { ApiError, FinishReason, GoogleGenAI, type GenerateContentResponse } from "@google/genai";

import type { GeminiEnv } from "@/lib/server/env";
import type { GenerationErrorCode } from "@/types/api";

/**
 * Longest wait for one image. Gemini image models usually answer in well
 * under a minute; the route's `maxDuration` (300 s) must cover this plus the
 * upload.
 */
export const PROVIDER_TIMEOUT_MS = 180_000;

let client: GoogleGenAI | undefined;
let clientKey: string | undefined;

function getGemini(apiKey: string): GoogleGenAI {
  if (!client || clientKey !== apiKey) {
    // No `retryOptions`, so the SDK makes a single attempt: a retried slow
    // generation could outlive the function. A failed job is retried by the user.
    client = new GoogleGenAI({ apiKey });
    clientKey = apiKey;
  }
  return client;
}

/** Thrown for failures with a client-safe code and message; details go to the server log. */
export class GenerationError extends Error {
  constructor(
    readonly code: GenerationErrorCode,
    readonly safeMessage: string,
  ) {
    super(safeMessage);
    this.name = "GenerationError";
  }
}

/** Finish reasons that mean the request or the image was blocked. */
const BLOCKED_FINISH = /SAFETY|PROHIBITED|BLOCKLIST|SPII|RECITATION/;

/**
 * Generates one image with `generateContent` and returns its bytes (PNG or
 * JPEG, whatever the model returns). Throws `GenerationError` on any provider
 * failure or when the response holds no image.
 */
export async function generateImage(env: GeminiEnv, model: string, prompt: string): Promise<Uint8Array> {
  const timeout = AbortSignal.timeout(PROVIDER_TIMEOUT_MS);
  let response: GenerateContentResponse;
  try {
    response = await getGemini(env.apiKey).models.generateContent({
      model,
      contents: prompt,
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: {
          aspectRatio: env.imageAspectRatio,
          // Only sent when configured: not every image model accepts it.
          ...(env.imageSize ? { imageSize: env.imageSize } : {}),
        },
        abortSignal: timeout,
      },
    });
  } catch (err) {
    throw classifyProviderError(err, timeout.aborted);
  }

  const blockReason = response.promptFeedback?.blockReason;
  const candidate = response.candidates?.[0];
  const finishReason = candidate?.finishReason;
  const image = candidate?.content?.parts?.find((part) => part.inlineData?.mimeType?.startsWith("image/"))?.inlineData;
  if (image?.data) return new Uint8Array(Buffer.from(image.data, "base64"));

  console.error(
    `[gemini] Response had no image (model ${response.modelVersion ?? model}, block ${blockReason ?? "-"}, ` +
      `finish ${finishReason ?? "-"}, response ${response.responseId ?? "-"}).`,
  );
  if (blockReason || (finishReason && BLOCKED_FINISH.test(finishReason))) {
    throw new GenerationError("PROVIDER_REJECTED", "The image service declined to generate this room.");
  }
  if (finishReason && finishReason !== FinishReason.STOP) {
    throw new GenerationError("PROVIDER_INVALID_RESPONSE", "The image service could not produce an image. Please try again.");
  }
  throw new GenerationError("PROVIDER_INVALID_RESPONSE", "The image service returned no image. Please try again.");
}

/** The JSON body the Gemini API sends with an error; the SDK puts it in `ApiError.message`. */
interface GoogleErrorBody {
  error?: {
    status?: string;
    message?: string;
    details?: { reason?: string; violations?: { quotaId?: string }[] }[];
  };
}

function parseErrorBody(message: string): GoogleErrorBody["error"] {
  try {
    return (JSON.parse(message) as GoogleErrorBody).error;
  } catch {
    return undefined;
  }
}

/** Maps SDK errors to a stable code and a message that never includes provider text or secrets. */
function classifyProviderError(err: unknown, timedOut: boolean): GenerationError {
  if (timedOut) {
    console.error(`[gemini] Image generation timed out after ${PROVIDER_TIMEOUT_MS} ms.`);
    return new GenerationError("PROVIDER_TIMEOUT", "The image service took too long to respond. Please try again.");
  }
  if (!(err instanceof ApiError)) {
    // fetch() rejects with a TypeError when the network or DNS fails.
    console.error("[gemini] Image generation failed:", err);
    return err instanceof TypeError
      ? new GenerationError("PROVIDER_UNAVAILABLE", "Couldn't reach the image service. Please try again later.")
      : new GenerationError("INTERNAL_ERROR", "Image generation failed.");
  }

  const body = parseErrorBody(err.message);
  const reasons = body?.details?.flatMap((d) => (d.reason ? [d.reason] : [])) ?? [];
  const quotaIds = body?.details?.flatMap((d) => d.violations?.flatMap((v) => (v.quotaId ? [v.quotaId] : [])) ?? []) ?? [];
  // Google's message names the quota or argument; it never echoes the API key.
  console.error(
    `[gemini] Image generation failed (HTTP ${err.status}, ${body?.status ?? "-"}, ${[...reasons, ...quotaIds].join(" ") || "-"}):`,
    body?.message ?? err.message,
  );

  if (reasons.some((r) => r.startsWith("API_KEY")) || err.status === 401 || err.status === 403) {
    return new GenerationError("PROVIDER_AUTH_FAILED", "The image service rejected the server's API key.");
  }
  if (err.status === 404) {
    return new GenerationError(
      "PROVIDER_MODEL_UNAVAILABLE",
      "The configured image model isn't available to this Gemini API key. Check GEMINI_IMAGE_MODEL.",
    );
  }
  if (err.status === 429) {
    // A per-day quota, or a limit of 0 (no free tier for the model), will not
    // clear by waiting a minute; per-minute limits will.
    const exhausted = quotaIds.some((id) => /PerDay/i.test(id)) || /limit: 0\b/.test(body?.message ?? "");
    return exhausted
      ? new GenerationError("PROVIDER_QUOTA_EXCEEDED", "The image service quota is used up. Check the Gemini API billing and quota.")
      : new GenerationError("PROVIDER_RATE_LIMITED", "The image service is busy. Please wait a minute and try again.");
  }
  if (err.status === 504 || body?.status === "DEADLINE_EXCEEDED") {
    return new GenerationError("PROVIDER_TIMEOUT", "The image service took too long to respond. Please try again.");
  }
  if (err.status >= 500) {
    return new GenerationError("PROVIDER_UNAVAILABLE", "The image service had a problem. Please try again later.");
  }
  if (body?.status === "FAILED_PRECONDITION") {
    // E.g. the model is not offered in the server's region, or needs billing.
    return new GenerationError(
      "PROVIDER_MODEL_UNAVAILABLE",
      "The configured image model can't be used with this Gemini API key. Check GEMINI_IMAGE_MODEL and billing.",
    );
  }
  return new GenerationError("PROVIDER_REJECTED", "The image service rejected the request.");
}
