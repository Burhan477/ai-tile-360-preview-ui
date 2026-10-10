"use client";

import Image from "next/image";
import { CircleAlert, ImageUp, LoaderCircle, RefreshCw, Trash2 } from "lucide-react";
import { useId, useRef, useState, type ChangeEvent, type DragEvent } from "react";

import { ACCEPTED_TILE_IMAGE_EXTENSIONS, ACCEPTED_TILE_IMAGE_TYPES } from "@/constants/tiles";
import { formatFileSize, readImageSize, validateTileFile } from "@/lib/tile";
import type { TileImage } from "@/types/tile";

interface TileUploadProps {
  image: TileImage | null;
  /**
   * Receives a new image (owning a fresh object URL) or `null` on remove.
   * The receiver is responsible for revoking the previous image's URL.
   */
  onChange: (image: TileImage | null) => void;
  /** Caption shown under the preview, e.g. the tile name. */
  title?: string;
  /** Secondary caption, e.g. the tile dimensions. */
  subtitle?: string;
}

const ACCEPT = [...ACCEPTED_TILE_IMAGE_TYPES, ...ACCEPTED_TILE_IMAGE_EXTENSIONS].join(",");

/** `crypto.randomUUID` needs a secure context, which LAN testing over http lacks. */
function createId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** "386 KB · 1000 × 1000 px", leaving out what the catalog does not record. */
function imageMeta(image: TileImage): string {
  const parts = [
    image.fileSize !== null && formatFileSize(image.fileSize),
    image.pixelWidth !== null && image.pixelHeight !== null && `${image.pixelWidth} × ${image.pixelHeight} px`,
  ];
  return parts.filter(Boolean).join(" · ");
}

const BUTTON =
  "inline-flex h-10 items-center justify-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

export default function TileUpload({ image, onChange, title, subtitle }: TileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  /** Counts nested dragenter/dragleave pairs so child elements don't cause flicker. */
  const dragDepth = useRef(0);
  /** Identifies the latest file so a slow decode can't overwrite a newer pick. */
  const latestRequest = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hintId = useId();
  const errorId = useId();

  const openPicker = () => inputRef.current?.click();

  const handleFile = async (file: File) => {
    const request = ++latestRequest.current;
    const validationError = validateTileFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsProcessing(true);
    const url = URL.createObjectURL(file);

    try {
      // Confirms the bytes are a real image (not just a renamed file).
      const size = await readImageSize(url);
      if (request !== latestRequest.current) {
        URL.revokeObjectURL(url);
        return;
      }
      onChange({
        id: createId(),
        url,
        fileName: file.name,
        fileSize: file.size,
        pixelWidth: size.width,
        pixelHeight: size.height,
        source: "upload",
      });
    } catch {
      URL.revokeObjectURL(url);
      if (request === latestRequest.current) {
        setError("We couldn't read this image. Please try a different file.");
      }
    } finally {
      if (request === latestRequest.current) setIsProcessing(false);
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so choosing the same file again still fires `change`.
    event.target.value = "";
    if (file) void handleFile(file);
  };

  const handleDragEnter = (event: DragEvent) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  };

  const handleDragOver = (event: DragEvent) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  const handleRemove = () => {
    latestRequest.current += 1;
    setError(null);
    setIsProcessing(false);
    onChange(null);
  };

  const dropHandlers = {
    onDragEnter: handleDragEnter,
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={handleInputChange}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      {image ? (
        <div
          {...dropHandlers}
          className={`relative grid gap-5 rounded-2xl border bg-white p-4 transition-colors duration-200 sm:grid-cols-[minmax(0,240px)_1fr] sm:p-5 ${
            isDragging ? "border-accent bg-accent-soft" : "border-stone-200"
          }`}
        >
          <div className="relative aspect-square overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
            <Image
              key={image.id}
              src={image.url}
              alt={`Uploaded tile design${title ? `: ${title}` : ""}`}
              fill
              sizes="(min-width: 640px) 240px, 100vw"
              className="object-contain"
            />
            {(isDragging || isProcessing) && (
              <div className="absolute inset-0 flex items-center justify-center bg-stone-950/45 text-sm font-medium text-white backdrop-blur-[2px]">
                {isProcessing ? (
                  <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
                ) : (
                  "Drop to replace"
                )}
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col">
            <p className="text-xs tracking-wider text-stone-500 uppercase">Tile preview</p>
            <p className="font-display mt-1 truncate text-xl text-ink">
              {title || "Untitled tile"}
            </p>
            <p className="mt-0.5 text-sm text-stone-600 tabular-nums">
              {subtitle || "Size not set"}
            </p>

            <dl className="mt-4 space-y-1.5 text-xs text-stone-500">
              <div className="flex gap-2">
                <dt className="sr-only">File name</dt>
                <dd className="truncate font-medium text-stone-700" title={image.fileName}>
                  {image.fileName}
                </dd>
              </div>
              {imageMeta(image) && (
                <div className="flex gap-2 tabular-nums">
                  <dt className="sr-only">File size and resolution</dt>
                  <dd>{imageMeta(image)}</dd>
                </div>
              )}
            </dl>

            <div className="mt-5 flex flex-wrap gap-2 sm:mt-auto sm:pt-5">
              <button
                type="button"
                onClick={openPicker}
                disabled={isProcessing}
                className={`${BUTTON} border-stone-300 bg-white text-ink hover:border-stone-400 hover:bg-stone-50`}
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                Replace
              </button>
              <button
                type="button"
                onClick={handleRemove}
                className={`${BUTTON} border-transparent text-stone-600 hover:bg-red-50 hover:text-red-700`}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          {...dropHandlers}
          onClick={openPicker}
          disabled={isProcessing}
          aria-describedby={`${hintId} ${error ? errorId : ""}`.trim()}
          className={`group flex min-h-56 w-full flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all duration-200 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-wait ${
            isDragging
              ? "scale-[1.01] border-accent bg-accent-soft"
              : error
                ? "border-red-300 bg-white hover:border-red-400"
                : "border-stone-300 bg-white hover:border-accent hover:bg-accent-soft/50"
          }`}
        >
          <span
            className={`flex size-14 items-center justify-center rounded-full transition-colors ${
              isDragging
                ? "bg-accent text-white"
                : "bg-accent-soft text-accent group-hover:bg-accent-muted"
            }`}
          >
            {isProcessing ? (
              <LoaderCircle className="size-6 animate-spin" aria-hidden="true" />
            ) : (
              <ImageUp className="size-6" strokeWidth={1.5} aria-hidden="true" />
            )}
          </span>
          <span>
            <span className="block text-base font-medium text-ink">
              {isProcessing
                ? "Checking image…"
                : isDragging
                  ? "Drop your tile image"
                  : "Drag & drop your tile design"}
            </span>
            <span className="mt-1 block text-sm text-stone-500">
              or <span className="font-medium text-accent underline-offset-2 group-hover:underline">click to browse</span>
            </span>
          </span>
          <span id={hintId} className="text-xs text-stone-400">
            JPG, PNG or WEBP · up to 10 MB
          </span>
        </button>
      )}

      <div>
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
    </div>
  );
}
