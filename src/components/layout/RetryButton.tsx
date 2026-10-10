"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** Re-renders the current route on the server, e.g. to re-read the catalog after a failure. */
export default function RetryButton({ label = "Try again" }: { label?: string }) {
  const router = useRouter();
  const [isRetrying, startRetry] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startRetry(() => router.refresh())}
      disabled={isRetrying}
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 text-xs font-medium text-ink transition-colors hover:border-stone-400 hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
    >
      <RotateCcw className={`size-3.5 ${isRetrying ? "animate-spin" : ""}`} aria-hidden="true" />
      {isRetrying ? "Retrying…" : label}
    </button>
  );
}
