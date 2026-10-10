"use client";

import Image from "next/image";
import { CircleAlert, CircleCheck, ImagePlus, LoaderCircle, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";

import { ACCEPTED_TILE_IMAGE_EXTENSIONS, ACCEPTED_TILE_IMAGE_TYPES } from "@/constants/tiles";
import { formatFileSize, formatMegabytes, readImageSize, validateImageFile } from "@/lib/tile";
import { MAX_ROOM_IMAGE_BYTES, UploadError, uploadRoomImage } from "@/lib/uploads";
import type { RoomImage } from "@/types/tile";

interface RoomImageUploadProps {
  image: RoomImage | null;
  /**
   * Receives the stored photo (owning a fresh preview URL) or `null` on
   * remove. The receiver is responsible for revoking the previous preview URL.
   */
  onChange: (image: RoomImage | null) => void;
}

const ACCEPT = [...ACCEPTED_TILE_IMAGE_TYPES, ...ACCEPTED_TILE_IMAGE_EXTENSIONS].join(",");

const BUTTON =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Optional room photo, uploaded to the private `room-images` bucket through
 * `POST /api/uploads`. It is kept for AI previews in a later milestone; the
 * 360° viewer cannot show an ordinary photo, so it is not used there.
 */
export default function RoomImageUpload({ image, onChange }: RoomImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<AbortController | null>(null);
  /** The file being uploaded, shown until the upload settles. */
  const [pending, setPending] = useState<{ previewUrl: string; fileName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hintId = useId();
  const errorId = useId();

  // Abandon an in-flight upload when leaving the page.
  useEffect(() => () => uploadRef.current?.abort(), []);

  const openPicker = () => inputRef.current?.click();

  const handleFile = async (file: File) => {
    uploadRef.current?.abort();
    const validationError = validateImageFile(file, MAX_ROOM_IMAGE_BYTES);
    if (validationError) {
      setError(validationError);
      return;
    }

    const controller = new AbortController();
    uploadRef.current = controller;
    const previewUrl = URL.createObjectURL(file);
    setError(null);
    setPending({ previewUrl, fileName: file.name });

    try {
      // Confirms the bytes decode as an image before sending them.
      await readImageSize(previewUrl);
      const stored = await uploadRoomImage(file, controller.signal);
      if (controller.signal.aborted) throw controller.signal.reason;
      onChange({
        bucket: stored.bucket,
        path: stored.path,
        contentType: stored.contentType,
        size: stored.size,
        fileName: file.name,
        previewUrl,
      });
    } catch (err) {
      URL.revokeObjectURL(previewUrl);
      if (controller.signal.aborted) return;
      setError(
        err instanceof UploadError ? err.message : "We couldn't read this image. Please try a different file.",
      );
    } finally {
      if (uploadRef.current === controller) {
        uploadRef.current = null;
        setPending(null);
      }
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so choosing the same file again still fires `change`.
    event.target.value = "";
    if (file) void handleFile(file);
  };

  const handleRemove = () => {
    uploadRef.current?.abort();
    uploadRef.current = null;
    setPending(null);
    setError(null);
    onChange(null);
  };

  const isUploading = pending !== null;
  const previewUrl = pending?.previewUrl ?? image?.previewUrl ?? null;

  return (
    <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={handleInputChange}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      <div className="flex items-start gap-4">
        <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-stone-100 text-stone-400">
          {previewUrl ? (
            <Image key={previewUrl} src={previewUrl} alt="" fill sizes="64px" className="object-cover" />
          ) : (
            <ImagePlus className="size-6" strokeWidth={1.5} aria-hidden="true" />
          )}
          {isUploading && (
            <span className="absolute inset-0 flex items-center justify-center bg-stone-950/45 text-white">
              <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">
            Room photo <span className="font-normal text-stone-500">(optional)</span>
          </p>
          <div aria-live="polite">
            {isUploading ? (
              <p className="mt-0.5 truncate text-xs text-stone-600">Uploading {pending.fileName}…</p>
            ) : image ? (
              <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-stone-600">
                <CircleCheck className="size-3.5 shrink-0 text-accent" aria-hidden="true" />
                <span className="truncate" title={image.fileName}>
                  Uploaded {image.fileName}
                </span>
                <span className="shrink-0 tabular-nums">· {formatFileSize(image.size)}</span>
              </p>
            ) : null}
          </div>
          <p id={hintId} className="mt-1 text-xs leading-relaxed text-stone-500">
            Stored privately for AI room previews, coming in a later version. The 360° viewer uses a prepared
            sample room for now. JPG, PNG or WEBP · up to {formatMegabytes(MAX_ROOM_IMAGE_BYTES)}.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openPicker}
              disabled={isUploading}
              aria-describedby={`${hintId} ${error ? errorId : ""}`.trim()}
              className={`${BUTTON} border-stone-300 bg-white text-ink hover:border-stone-400 hover:bg-stone-50`}
            >
              {image ? (
                <RefreshCw className="size-3.5" aria-hidden="true" />
              ) : (
                <ImagePlus className="size-3.5" aria-hidden="true" />
              )}
              {image ? "Replace photo" : "Upload room photo"}
            </button>
            {(image || isUploading) && (
              <button
                type="button"
                onClick={handleRemove}
                className={`${BUTTON} border-transparent text-stone-600 hover:bg-red-50 hover:text-red-700`}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                {isUploading ? "Cancel" : "Remove"}
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
