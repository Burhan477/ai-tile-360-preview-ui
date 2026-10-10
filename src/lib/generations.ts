import type { ApiResponse, GenerationJobData, GenerationRequestBody } from "@/types/api";

export class GenerationRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationRequestError";
  }
}

/** How often the client asks for a job's status while it runs. */
export const GENERATION_POLL_MS = 4000;

/** Starts an AI room generation via `POST /api/generations`. Throws `GenerationRequestError` with a user-facing message. */
export function startGeneration(body: GenerationRequestBody, signal?: AbortSignal): Promise<GenerationJobData> {
  return request("/api/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
}

/** Reads a job via `GET /api/generations/[id]`. */
export function fetchGeneration(id: string, signal?: AbortSignal): Promise<GenerationJobData> {
  return request(`/api/generations/${encodeURIComponent(id)}`, { signal });
}

async function request(url: string, init: RequestInit): Promise<GenerationJobData> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (err) {
    if (init.signal?.aborted) throw err;
    throw new GenerationRequestError("Couldn't reach the server. Check your connection and try again.");
  }

  const result = (await response.json().catch(() => null)) as ApiResponse<GenerationJobData> | null;
  if (result?.ok) return result.data;

  switch (result?.error.code) {
    // Written for users (see src/lib/server/generation.ts).
    case "RATE_LIMITED":
    case "INVALID_REQUEST":
    case "NOT_FOUND":
      throw new GenerationRequestError(result.error.message);
    case "CONFIG_INVALID":
    case "DATABASE_SCHEMA_MISSING":
      throw new GenerationRequestError("AI room generation isn't set up on this server yet.");
    default:
      throw new GenerationRequestError("AI room generation is unavailable right now. Please try again later.");
  }
}
