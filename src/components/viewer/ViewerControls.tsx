import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ArrowLeft, Maximize, Minimize, Minus, Plus, RotateCcw } from "lucide-react";

interface ViewerControlsProps {
  title: string;
  backHref: string;
  /** Extra content under the title, e.g. the tile info panel. */
  info?: ReactNode;
  /** Extra buttons placed before the fullscreen toggle. */
  actions?: ReactNode;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  isFullscreen: boolean;
  /** Hide fullscreen where the API is unavailable (e.g. iPhone Safari). */
  canFullscreen: boolean;
  onToggleFullscreen: () => void;
}

const GLASS =
  "border border-white/15 bg-stone-950/40 text-white shadow-lg shadow-black/20 backdrop-blur-md";

export const ICON_BUTTON = `${GLASS} flex size-11 items-center justify-center rounded-full transition-colors hover:bg-stone-950/60 focus-visible:ring-2 focus-visible:ring-accent-muted focus-visible:outline-none`;

function IconButton({
  label,
  children,
  className = "",
  ...props
}: { label: string; children: ReactNode } & ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`${ICON_BUTTON} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export default function ViewerControls({
  title,
  backHref,
  info,
  actions,
  onZoomIn,
  onZoomOut,
  onReset,
  isFullscreen,
  canFullscreen,
  onToggleFullscreen,
}: ViewerControlsProps) {
  const iconProps = { className: "size-[18px]", strokeWidth: 1.75, "aria-hidden": true } as const;

  return (
    <>
      {/* Fixed height so the shading doesn't grow with the info panel. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-gradient-to-b from-black/35 to-transparent"
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 sm:pt-6">
        <div className="pointer-events-auto flex min-w-0 flex-col items-start gap-3">
          <div className="flex min-w-0 max-w-full items-center gap-3">
            <Link href={backHref} aria-label="Back to selection" title="Back to selection" className={ICON_BUTTON}>
              <ArrowLeft {...iconProps} />
            </Link>
            <h1 className="font-display min-w-0 truncate text-lg leading-tight text-white drop-shadow sm:text-xl">
              {title}
            </h1>
          </div>
          {info}
        </div>

        <div className="pointer-events-auto flex shrink-0 items-center gap-2">
          {actions}
          {canFullscreen && (
            <IconButton
              label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              onClick={onToggleFullscreen}
            >
              {isFullscreen ? <Minimize {...iconProps} /> : <Maximize {...iconProps} />}
            </IconButton>
          )}
        </div>
      </div>

      <div
        role="toolbar"
        aria-label="View controls"
        className="absolute right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 flex flex-col items-center gap-3 sm:right-6 sm:bottom-6"
      >
        <div className={`${GLASS} flex flex-col overflow-hidden rounded-full`}>
          <button
            type="button"
            onClick={onZoomIn}
            aria-label="Zoom in"
            title="Zoom in"
            className="flex size-11 items-center justify-center transition-colors hover:bg-white/10 focus-visible:bg-white/15 focus-visible:outline-none"
          >
            <Plus {...iconProps} />
          </button>
          <span aria-hidden="true" className="mx-auto h-px w-5 bg-white/20" />
          <button
            type="button"
            onClick={onZoomOut}
            aria-label="Zoom out"
            title="Zoom out"
            className="flex size-11 items-center justify-center transition-colors hover:bg-white/10 focus-visible:bg-white/15 focus-visible:outline-none"
          >
            <Minus {...iconProps} />
          </button>
        </div>
        <IconButton label="Reset view" onClick={onReset}>
          <RotateCcw {...iconProps} />
        </IconButton>
      </div>
    </>
  );
}
