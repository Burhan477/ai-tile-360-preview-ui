"use client";

import type { Texture } from "three";

import TileSurfaceLayer from "@/components/viewer/TileSurfaceLayer";
import type { FloorMapping, TileRenderConfig } from "@/types/viewer";

interface FloorTileRendererProps {
  tileTexture: Texture;
  config: TileRenderConfig;
  floor: FloorMapping;
}

/** Intersects the view ray with the floor plane, `uCameraHeight` below the camera. */
const surfaceShader = /* glsl */ `
  uniform float uCameraHeight;
  uniform vec2 uGridOffset;
  uniform float uGridRotation;

  bool surfacePosition(vec3 dir, out vec2 pos) {
    // Only rays pointing down can hit the floor; the guard also avoids the
    // distant, heavily aliased area just below the horizon.
    if (dir.y > -0.02) return false;

    float c = cos(uGridRotation);
    float s = sin(uGridRotation);
    pos = mat2(c, s, -s, c) * (dir.xz * (uCameraHeight / -dir.y)) + uGridOffset;
    return true;
  }
`;

/** Lays the tile flat on the floor: at 0° its width runs along X and its height along Z. */
export default function FloorTileRenderer({ tileTexture, config, floor }: FloorTileRendererProps) {
  return (
    <TileSurfaceLayer
      tileTexture={tileTexture}
      config={config}
      mask={floor.mask}
      surfaceShader={surfaceShader}
      uniforms={{
        uCameraHeight: floor.cameraHeight,
        uGridOffset: floor.gridOffset,
        uGridRotation: floor.gridRotation,
      }}
      renderOrder={1}
    />
  );
}
