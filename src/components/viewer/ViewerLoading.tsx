import { Rotate3d } from "lucide-react";

interface ViewerLoadingProps {
  /** Fades the overlay out instead of unmounting it abruptly. */
  visible?: boolean;
  label?: string;
}

export default function ViewerLoading({
  visible = true,
  label = "Preparing your room",
}: ViewerLoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
      className={`absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 bg-stone-950 transition-opacity duration-500 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <span className="relative flex size-14 items-center justify-center">
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-spin rounded-full border-2 border-white/10 border-t-accent-muted"
        />
        <Rotate3d className="size-5 text-accent-muted" strokeWidth={1.5} aria-hidden="true" />
      </span>
      <div className="text-center">
        <p className="font-display text-lg text-stone-100">{label}</p>
        <p className="mt-1 text-xs tracking-[0.2em] text-stone-500 uppercase">
          Loading 360° view
        </p>
      </div>
    </div>
  );
}
