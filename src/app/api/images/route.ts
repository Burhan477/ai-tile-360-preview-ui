import type { NextRequest } from "next/server";

import { apiError, apiSuccess, handleRouteError } from "@/lib/server/api";
import { getImageUrl, isNotFound, isObjectPath, isStorageBucket, storageErrorResponse } from "@/lib/server/storage";

const ROUTE = "api/images";

/**
 * GET /api/images?bucket=<bucket>&path=<object path> — a URL for one stored
 * image: the public URL for `tile-images`, or a short-lived signed URL for
 * the private buckets (404 if the object does not exist).
 *
 * No auth in the POC: object paths are random UUIDs, so knowing a path is
 * what grants access to a private image.
 */
export async function GET(request: NextRequest) {
  const bucket = request.nextUrl.searchParams.get("bucket");
  const path = request.nextUrl.searchParams.get("path");

  if (!isStorageBucket(bucket)) {
    return apiError(400, "INVALID_REQUEST", 'Query "bucket" must be a known storage bucket.');
  }
  if (!isObjectPath(path)) {
    return apiError(400, "INVALID_REQUEST", 'Query "path" must be an image object path, e.g. 2026/10/<id>.jpg.');
  }

  try {
    const { data, error } = await getImageUrl(bucket, path);
    if (error) {
      if (isNotFound(error) && !/bucket/i.test(error.message)) {
        return apiError(404, "NOT_FOUND", "Image not found.");
      }
      return storageErrorResponse(ROUTE, error);
    }
    return apiSuccess(data);
  } catch (err) {
    return handleRouteError(ROUTE, err);
  }
}
