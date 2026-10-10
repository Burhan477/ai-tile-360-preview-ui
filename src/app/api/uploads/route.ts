import { apiError, apiSuccess, handleRouteError } from "@/lib/server/api";
import { getStorageEnv } from "@/lib/server/env";
import {
  UPLOAD_BUCKETS,
  detectImageType,
  getImageUrl,
  newObjectPath,
  storageErrorResponse,
} from "@/lib/server/storage";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import type { UploadKind, UploadedImageData } from "@/types/api";

const ROUTE = "api/uploads";

/** Room for multipart boundaries and the `kind` field on top of the file itself. */
const MULTIPART_OVERHEAD_BYTES = 16 * 1024;

const SUPPORTED = "Only JPEG, PNG and WebP images are supported.";

/**
 * POST /api/uploads — stores one image in a private bucket.
 *
 * multipart/form-data fields:
 * - `kind`: "room" (→ room-images) or "tile" (→ tile-uploads)
 * - `file`: the image; JPEG, PNG or WebP, identified by its bytes
 *
 * No auth in the POC: the endpoint is anonymous, so it only writes to private
 * buckets, under server-generated paths, never overwriting.
 */
export async function POST(request: Request) {
  try {
    // Fail on missing config before reading a possibly large body.
    const { maxUploadBytes } = getStorageEnv();
    const storageClient = getSupabaseAdmin().storage;

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
      return apiError(415, "UNSUPPORTED_MEDIA_TYPE", "Send the image as multipart/form-data.");
    }

    // Reject oversized bodies from the header alone, before buffering them.
    // Browsers always send Content-Length for FormData bodies.
    const lengthHeader = request.headers.get("content-length");
    const length = Number(lengthHeader);
    if (!lengthHeader || !Number.isInteger(length) || length < 0) {
      return apiError(411, "LENGTH_REQUIRED", "A Content-Length header is required.");
    }
    if (length > maxUploadBytes + MULTIPART_OVERHEAD_BYTES) {
      return apiError(413, "PAYLOAD_TOO_LARGE", `Image must be at most ${formatMb(maxUploadBytes)}.`);
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return apiError(400, "INVALID_REQUEST", "Malformed multipart/form-data body.");
    }

    const kind = form.get("kind");
    if (kind !== "room" && kind !== "tile") {
      return apiError(400, "INVALID_REQUEST", 'Field "kind" must be "room" or "tile".');
    }

    const files = form.getAll("file");
    const file = files[0];
    if (files.length !== 1 || !(file instanceof File)) {
      return apiError(400, "INVALID_REQUEST", 'Attach exactly one image in the "file" field.');
    }
    if (file.size === 0) {
      return apiError(400, "INVALID_REQUEST", "The file is empty.");
    }
    if (file.size > maxUploadBytes) {
      return apiError(413, "PAYLOAD_TOO_LARGE", `Image must be at most ${formatMb(maxUploadBytes)}.`);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const image = detectImageType(bytes);
    if (!image) {
      return apiError(415, "UNSUPPORTED_MEDIA_TYPE", SUPPORTED);
    }

    const bucket = UPLOAD_BUCKETS[kind satisfies UploadKind];
    const path = newObjectPath(image.extension);
    const { error: uploadError } = await storageClient.from(bucket).upload(path, bytes, {
      contentType: image.type,
      cacheControl: "3600",
      upsert: false,
    });
    if (uploadError) return storageErrorResponse(ROUTE, uploadError);

    const stored: UploadedImageData = {
      bucket,
      path,
      visibility: "private",
      contentType: image.type,
      size: bytes.byteLength,
      url: null,
      expiresAt: null,
    };

    // The object is stored either way; if signing fails the client can
    // fetch a URL later with GET /api/images.
    const { data: signed, error: signError } = await getImageUrl(bucket, path);
    if (signError) {
      console.error(`[${ROUTE}] Signing the new object failed:`, signError.message);
    } else {
      stored.url = signed.url;
      stored.expiresAt = signed.expiresAt;
    }

    return apiSuccess(stored, 201);
  } catch (err) {
    return handleRouteError(ROUTE, err);
  }
}

function formatMb(bytes: number): string {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}
