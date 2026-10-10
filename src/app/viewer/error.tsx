"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Catches viewer crashes, e.g. when WebGL is unavailable on the device. */
export default function ViewerError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-4 bg-stone-950 px-6 text-center">
      <p className="font-display text-xl text-stone-100">The 360° viewer couldn&apos;t start</p>
      <p className="max-w-sm text-sm text-stone-400">
        Your browser or device may not support WebGL. Try again, or use a recent version of
        Chrome, Safari, Edge or Firefox.
      </p>
      <div className="mt-2 flex gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="h-11 rounded-full bg-accent px-5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          Try again
        </button>
        <Link
          href="/"
          className="flex h-11 items-center rounded-full border border-white/20 px-5 text-sm text-stone-200 transition-colors hover:bg-white/10"
        >
          Back to selection
        </Link>
      </div>
    </main>
  );
}
