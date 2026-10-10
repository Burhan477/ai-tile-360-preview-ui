"use client";

import { useThree } from "@react-three/fiber";
import { SRGBColorSpace } from "three";

import { useThreeTexture } from "@/hooks/useThreeTexture";

/**
 * The tile texture shared by every surface renderer, so showing floor and
 * wall together loads and uploads the image only once.
 *
 * It is clamped rather than set to repeat: the surface shader lays out one
 * cell per tile (with grout and rotation) and samples the image inside it, so
 * clamping keeps the opposite edge from bleeding into each tile's border.
 *
 * Switching `imageUrl` keeps the previous texture on screen until the new one
 * has loaded (or for good, if it fails), then disposes of it.
 */
export function useTileTexture(imageUrl: string) {
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  return useThreeTexture(imageUrl, {
    colorSpace: SRGBColorSpace,
    // Keeps the tile crisp at grazing angles towards the far walls and corners.
    anisotropy: maxAnisotropy,
  });
}
