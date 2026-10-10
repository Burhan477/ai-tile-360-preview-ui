import type { ApiResponse, UploadedImageData } from "@/types/api";

/**
 * Client-side limit for room photos. Matches the server's default
 * `UPLOAD_MAX_BYTES` (4 MiB, kept under Vercel's 4.5 MB body limit); the
 * server still enforces its own configured limit.
 */
export const MAX_ROOM_IMAGE_BYTES = 4 * 1024 * 1024;

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

/**
 * Stores a room photo via `POST /api/uploads` (private `room-images` bucket).
 * Throws `UploadError` with a user-facing message on failure.
 */
export async function uploadRoomImage(file: File, signal?: AbortSignal): Promise<UploadedImageData> {
  const body = new FormData();
  body.append("kind", "room");
  body.append("file", file);

  let response: Response;
  try {
    response = await fetch("/api/uploads", { method: "POST", body, signal });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new UploadError("Couldn't reach the server. Check your connection and try again.");
  }

  // Platform limits (e.g. Vercel's body size) can answer before the app, without JSON.
  const result = (await response.json().catch(() => null)) as ApiResponse<UploadedImageData> | null;
  if (result?.ok) return result.data;

  switch (result?.error.code) {
    // These messages are written for users (see src/app/api/uploads/route.ts).
    case "PAYLOAD_TOO_LARGE":
    case "UNSUPPORTED_MEDIA_TYPE":
    case "INVALID_REQUEST":
      throw new UploadError(result.error.message);
    default:
      if (response.status === 413) throw new UploadError("This image is too large to upload.");
      throw new UploadError("Upload failed. Please try again later.");
  }
}
