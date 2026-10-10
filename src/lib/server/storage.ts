import "server-only";

import { apiError } from "@/lib/server/api";
import { getStorageEnv } from "@/lib/server/env";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import type { ImageContentType, StorageBucket, StoredImageData, UploadKind } from "@/types/api";

/** The fields this module reads from supabase-js Storage errors (`StorageError` / `StorageApiError`). */
export interface StorageError extends Error {
  status?: number;
  statusCode?: string;
}

/** Visibility of each bucket; must match supabase/migrations/…_storage.sql. */
export const STORAGE_BUCKETS: Record<StorageBucket, { public: boolean }> = {
  "tile-images": { public: true },
  "tile-uploads": { public: false },
  "room-images": { public: false },
  "generated-previews": { public: false },
};

/** Anonymous uploads only ever land in private buckets. */
export const UPLOAD_BUCKETS: Record<UploadKind, StorageBucket> = {
  room: "room-images",
  tile: "tile-uploads",
};

export function isStorageBucket(value: unknown): value is StorageBucket {
  return typeof value === "string" && Object.hasOwn(STORAGE_BUCKETS, value);
}

/**
 * Object paths this app reads: slash-separated segments of letters, digits,
 * `_` and `-`, ending in an image extension. Rejects `..`, empty segments and
 * leading slashes.
 */
const OBJECT_PATH = /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\.(?:jpe?g|png|webp)$/;

export function isObjectPath(value: unknown): value is string {
  return typeof value === "string" && value.length <= 256 && OBJECT_PATH.test(value);
}

const IMAGE_TYPES: { type: ImageContentType; extension: string; matches: (b: Uint8Array) => boolean }[] = [
  { type: "image/jpeg", extension: "jpg", matches: (b) => startsWith(b, [0xff, 0xd8, 0xff]) },
  {
    type: "image/png",
    extension: "png",
    matches: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  {
    type: "image/webp",
    extension: "webp",
    // "RIFF" <size> "WEBP"
    matches: (b) => startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b.subarray(8), [0x57, 0x45, 0x42, 0x50]),
  },
];

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return bytes.length >= signature.length && signature.every((byte, i) => bytes[i] === byte);
}

/** Identifies the image format from its magic bytes; the client's declared type and filename are ignored. */
export function detectImageType(bytes: Uint8Array): { type: ImageContentType; extension: string } | null {
  const match = IMAGE_TYPES.find((t) => t.matches(bytes));
  return match ? { type: match.type, extension: match.extension } : null;
}

/**
 * Pixel size from a PNG IHDR or JPEG SOF header, or `null` when it cannot be
 * read (including WebP, which no caller needs yet).
 */
export function readImageDimensions(bytes: Uint8Array, type: ImageContentType): { width: number; height: number } | null {
  const u16 = (i: number) => (bytes[i] << 8) | bytes[i + 1];
  if (type === "image/png") {
    if (bytes.length < 24) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (type === "image/jpeg") {
    // Walk the segments after SOI until a start-of-frame marker.
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) return null;
      const marker = bytes[i + 1];
      if (marker === 0xff) {
        i += 1; // fill byte
        continue;
      }
      const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isStartOfFrame) return { height: u16(i + 5), width: u16(i + 7) };
      i += 2 + u16(i + 2);
    }
  }
  return null;
}

/** `2026/10/<uuid>.jpg`: unguessable, and never derived from the client's filename. */
export function newObjectPath(extension: string): string {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}/${month}/${crypto.randomUUID()}.${extension}`;
}

/**
 * A URL for an object: the permanent public URL for public buckets, or a
 * short-lived signed URL for private ones. Signing fails with a 404-type
 * `StorageError` when the object does not exist.
 */
export async function getImageUrl(
  bucket: StorageBucket,
  path: string,
): Promise<{ data: StoredImageData; error: null } | { data: null; error: StorageError }> {
  const storage = getSupabaseAdmin().storage.from(bucket);

  if (STORAGE_BUCKETS[bucket].public) {
    const { data } = storage.getPublicUrl(path);
    return {
      data: { bucket, path, visibility: "public", url: data.publicUrl, expiresAt: null },
      error: null,
    };
  }

  const { signedUrlTtlSeconds } = getStorageEnv();
  const { data, error } = await storage.createSignedUrl(path, signedUrlTtlSeconds);
  if (error) return { data: null, error };
  return {
    data: {
      bucket,
      path,
      visibility: "private",
      url: data.signedUrl,
      expiresAt: new Date(Date.now() + signedUrlTtlSeconds * 1000).toISOString(),
    },
    error: null,
  };
}

/** Storage reports a missing object or bucket as HTTP 400 with statusCode "404", or as a 404. */
export function isNotFound(error: StorageError): boolean {
  return error.status === 404 || error.statusCode === "404" || /not found/i.test(error.message);
}

/**
 * Maps a Storage error to a client-safe response. The Storage message (which
 * holds no secrets or file contents) goes to the server log only.
 */
export function storageErrorResponse(route: string, error: StorageError): Response {
  console.error(`[${route}] Storage error (HTTP ${error.status ?? "-"}, ${error.statusCode ?? "-"}):`, error.message);

  if (error.status === undefined || error.status === 0 || error.name === "StorageUnknownError") {
    return apiError(503, "STORAGE_UNAVAILABLE", "Could not reach Supabase Storage.");
  }
  if (/bucket not found/i.test(error.message)) {
    return apiError(503, "STORAGE_NOT_CONFIGURED", "Storage bucket not found. Run the storage migration.");
  }
  if (error.statusCode === "403" || error.statusCode === "401" || error.status === 401 || error.status === 403) {
    return apiError(503, "STORAGE_NOT_CONFIGURED", "Supabase Storage rejected the server key. Check SUPABASE_SECRET_KEY.");
  }
  if (error.statusCode === "413" || error.status === 413) {
    return apiError(413, "PAYLOAD_TOO_LARGE", "Image exceeds the storage size limit.");
  }
  if (error.statusCode === "415" || error.status === 415) {
    return apiError(415, "UNSUPPORTED_MEDIA_TYPE", "Only JPEG, PNG and WebP images are supported.");
  }
  return apiError(502, "STORAGE_FAILED", "Storage request failed.");
}
