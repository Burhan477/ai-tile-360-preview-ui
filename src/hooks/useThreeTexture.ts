import { useEffect, useState } from "react";
import {
  NoColorSpace,
  RepeatWrapping,
  TextureLoader,
  type ColorSpace,
  type Texture,
} from "three";

export type TextureStatus = "loading" | "ready" | "error";

interface TextureOptions {
  /** `SRGBColorSpace` for colour images; the default suits data such as masks. */
  colorSpace?: ColorSpace;
  /** Tile the texture instead of clamping at its edges. */
  repeat?: boolean;
  anisotropy?: number;
  /** Bump to retry a failed load of the same URL. */
  attempt?: number;
}

interface LoadState {
  /** Which load attempt this result belongs to. */
  key: string;
  status: "ready" | "error";
}

/**
 * Loads a Three.js texture outside the R3F tree so HTML UI can react to its
 * status. The previous texture stays available while a new `src` loads (so
 * swaps are seamless) and is disposed once replaced or on unmount.
 */
export function useThreeTexture(
  src: string,
  { colorSpace = NoColorSpace, repeat = false, anisotropy = 1, attempt = 0 }: TextureOptions = {},
) {
  const key = `${src}#${attempt}`;
  const [state, setState] = useState<LoadState | null>(null);
  const [texture, setTexture] = useState<Texture | null>(null);

  useEffect(() => {
    let cancelled = false;

    new TextureLoader().load(
      src,
      (loaded) => {
        if (cancelled) {
          loaded.dispose();
          return;
        }
        loaded.colorSpace = colorSpace;
        loaded.anisotropy = anisotropy;
        if (repeat) loaded.wrapS = loaded.wrapT = RepeatWrapping;
        setTexture(loaded);
        setState({ key, status: "ready" });
      },
      undefined,
      () => {
        if (!cancelled) setState({ key, status: "error" });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [src, key, colorSpace, repeat, anisotropy]);

  // Free GPU memory for a texture once it has been replaced or unmounted.
  useEffect(() => () => texture?.dispose(), [texture]);

  const status: TextureStatus = state?.key === key ? state.status : "loading";
  return { status, texture };
}
