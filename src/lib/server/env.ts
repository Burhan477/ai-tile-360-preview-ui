import "server-only";

/**
 * Supabase configuration. These two values are public by design (the
 * publishable key only has the access RLS grants it), so the `NEXT_PUBLIC_`
 * prefix is safe. Privileged keys must never use that prefix; see
 * `getSupabaseSecretKey()`.
 */
const SUPABASE_ENV = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] as const;

/**
 * Thrown when server configuration is missing or malformed. The message names
 * the variables only, never their values, so it is safe to return to clients.
 */
export class ServerConfigError extends Error {
  constructor(message: string) {
    super(`${message} Configure .env.local (local) or the Vercel project settings; see .env.example.`);
    this.name = "ServerConfigError";
  }
}

export interface SupabaseEnv {
  url: string;
  publishableKey: string;
}

export function getSupabaseEnv(): SupabaseEnv {
  // Read each name literally: Next.js only inlines NEXT_PUBLIC_ values for
  // direct `process.env.NAME` access.
  const values = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
  };
  const missing = SUPABASE_ENV.filter((name) => !values[name]);
  if (missing.length > 0) {
    throw new ServerConfigError(
      `Missing required environment variable${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`,
    );
  }

  const url = values.NEXT_PUBLIC_SUPABASE_URL!;
  const publishableKey = values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

  const parsed = URL.canParse(url) ? new URL(url) : null;
  // The dashboard shows the REST endpoint (…/rest/v1/), but supabase-js adds
  // that path itself, so accept it and keep the origin. Any other path (e.g. a
  // dashboard link) still answers HTTP requests, so reject it.
  const path = parsed?.pathname.replace(/\/+$/, "");
  if (!parsed || !/^https?:$/.test(parsed.protocol) || !(path === "" || path === "/rest/v1") || parsed.search) {
    throw new ServerConfigError(
      "NEXT_PUBLIC_SUPABASE_URL must be the bare project URL, e.g. https://<ref>.supabase.co (no path; not the dashboard link).",
    );
  }
  if (publishableKey.startsWith("sb_secret_")) {
    throw new ServerConfigError(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is a secret key, which must never be NEXT_PUBLIC_; use the publishable key.",
    );
  }

  return { url: parsed.origin, publishableKey };
}

/**
 * The Supabase secret key. It bypasses RLS, so it is server-only (never a
 * `NEXT_PUBLIC_` variable) and only Route Handlers that validate their input
 * may use it, via `getSupabaseAdmin()`.
 */
export function getSupabaseSecretKey(): string {
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!key) {
    throw new ServerConfigError("Missing required environment variable: SUPABASE_SECRET_KEY.");
  }
  // sb_secret_… (current format) or the legacy service_role JWT.
  if (!key.startsWith("sb_secret_") && key.split(".").length !== 3) {
    throw new ServerConfigError(
      "SUPABASE_SECRET_KEY must be the secret key (sb_secret_…) or the legacy service_role key.",
    );
  }
  return key;
}

const MiB = 1024 * 1024;

/** Per-object limit set on every bucket by the storage migration; keep in sync. */
export const BUCKET_FILE_SIZE_LIMIT_BYTES = 10 * MiB;

export interface StorageEnv {
  /** Largest image `POST /api/uploads` accepts. */
  maxUploadBytes: number;
  /** Lifetime of signed URLs for private images. */
  signedUrlTtlSeconds: number;
}

export function getStorageEnv(): StorageEnv {
  return {
    // Vercel rejects Route Handler request bodies over 4.5 MB, so the default
    // stays below that; raising it only helps outside Vercel.
    maxUploadBytes: readIntEnv("UPLOAD_MAX_BYTES", 4 * MiB, 1, BUCKET_FILE_SIZE_LIMIT_BYTES),
    signedUrlTtlSeconds: readIntEnv("SIGNED_URL_TTL_SECONDS", 60 * 60, 60, 7 * 24 * 60 * 60),
  };
}

/** Aspect ratios offered for room images: the widest every Gemini image model accepts. */
const IMAGE_ASPECT_RATIOS = ["21:9", "16:9"] as const;
export type ImageAspectRatio = (typeof IMAGE_ASPECT_RATIOS)[number];

const IMAGE_SIZES = ["1K", "2K", "4K"] as const;
export type ImageSize = (typeof IMAGE_SIZES)[number];

export interface GeminiEnv {
  apiKey: string;
  /** Gemini image model id, e.g. `gemini-3.1-flash-image`. */
  imageModel: string;
  /** Not 2:1: Gemini cannot produce an equirectangular panorama. */
  imageAspectRatio: ImageAspectRatio;
  /** `null` leaves the size to the model (1K); older models reject the field. */
  imageSize: ImageSize | null;
}

/**
 * Gemini configuration for room generation. The key is server-only: it must
 * never be a `NEXT_PUBLIC_` variable, and only `src/lib/server/` reads it.
 * The model has no default: image model ids are retired often, so the
 * deployment names the one it was verified with.
 */
export function getGeminiEnv(): GeminiEnv {
  if (process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
    throw new ServerConfigError(
      "NEXT_PUBLIC_GEMINI_API_KEY must not be set: it would be sent to browsers. Use GEMINI_API_KEY.",
    );
  }
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const imageModel = process.env.GEMINI_IMAGE_MODEL?.trim();
  const missing = [!apiKey && "GEMINI_API_KEY", !imageModel && "GEMINI_IMAGE_MODEL"].filter(Boolean);
  if (missing.length > 0) {
    throw new ServerConfigError(
      `Missing required environment variable${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`,
    );
  }
  if (!/^[a-z0-9][a-z0-9.-]{1,99}$/.test(imageModel!)) {
    throw new ServerConfigError("GEMINI_IMAGE_MODEL must be a model id, e.g. gemini-3.1-flash-image (no models/ prefix).");
  }

  const imageAspectRatio = (process.env.GEMINI_IMAGE_ASPECT_RATIO?.trim() || "21:9") as ImageAspectRatio;
  if (!IMAGE_ASPECT_RATIOS.includes(imageAspectRatio)) {
    throw new ServerConfigError(`GEMINI_IMAGE_ASPECT_RATIO must be one of: ${IMAGE_ASPECT_RATIOS.join(", ")}.`);
  }
  const rawSize = process.env.GEMINI_IMAGE_SIZE?.trim() || null;
  if (rawSize !== null && !IMAGE_SIZES.includes(rawSize as ImageSize)) {
    throw new ServerConfigError(`GEMINI_IMAGE_SIZE must be one of: ${IMAGE_SIZES.join(", ")}.`);
  }

  return { apiKey: apiKey!, imageModel: imageModel!, imageAspectRatio, imageSize: rawSize as ImageSize | null };
}

export interface GenerationLimitsEnv {
  /** Jobs allowed to be pending or processing at once, across all users. */
  maxActive: number;
  /** Jobs that may be created in any rolling 24 hours. */
  dailyLimit: number;
}

/**
 * Spend guards for the anonymous generation endpoint. There is no auth in the
 * POC, so these global caps are what stops a script from running up the
 * Gemini bill.
 */
export function getGenerationLimitsEnv(): GenerationLimitsEnv {
  return {
    maxActive: readIntEnv("GENERATION_MAX_ACTIVE", 2, 1, 50),
    dailyLimit: readIntEnv("GENERATION_DAILY_LIMIT", 25, 1, 10_000),
  };
}

function readIntEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ServerConfigError(`${name} must be a whole number between ${min} and ${max}.`);
  }
  return value;
}
