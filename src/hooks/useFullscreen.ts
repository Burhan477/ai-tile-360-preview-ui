import { useCallback, useSyncExternalStore, type RefObject } from "react";

function subscribe(onChange: () => void) {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
}

const noopSubscribe = () => () => {};

/**
 * Fullscreen state for an element. Server snapshots are `false`, so the first
 * client render matches the server HTML and there is no hydration mismatch.
 */
export function useFullscreen(targetRef: RefObject<HTMLElement | null>) {
  const isFullscreen = useSyncExternalStore(
    subscribe,
    () => document.fullscreenElement !== null,
    () => false,
  );

  const isSupported = useSyncExternalStore(
    noopSubscribe,
    () => document.fullscreenEnabled === true,
    () => false,
  );

  const toggle = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await targetRef.current?.requestFullscreen();
      }
    } catch {
      // The browser may refuse (e.g. permissions policy); the UI simply stays as is.
    }
  }, [targetRef]);

  return { isFullscreen, isSupported, toggle };
}
