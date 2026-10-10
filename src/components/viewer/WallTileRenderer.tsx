"use client";

import type { Texture } from "three";

import TileSurfaceLayer from "@/components/viewer/TileSurfaceLayer";
import type { TileRenderConfig, WallMapping } from "@/types/viewer";

interface WallTileRendererProps {
  tileTexture: Texture;
  config: TileRenderConfig;
  wall: WallMapping;
}

/**
 * Intersects the view ray with the four walls of a box room around the
 * camera. The result is a position on the unrolled walls: `x` runs clockwise
 * around the room seen from above (front, right, back, left), so it always
 * increases to the viewer's right, and `y` is the height above the floor.
 */
const surfaceShader = /* glsl */ `
  uniform vec2 uRoomMin; // (minX, minZ)
  uniform vec2 uRoomMax; // (maxX, maxZ)
  uniform float uCameraHeight;
  uniform float uWallHeight;
  uniform float uYaw;
  uniform vec2 uGridOffset;

  bool surfacePosition(vec3 dir, out vec2 pos) {
    float c = cos(uYaw);
    float s = sin(uYaw);
    vec2 d = mat2(c, s, -s, c) * dir.xz;

    // Distance along the ray to the wall it faces on each axis.
    float tx = d.x > 0.0 ? uRoomMax.x / d.x : (d.x < 0.0 ? uRoomMin.x / d.x : 1e9);
    float tz = d.y > 0.0 ? uRoomMax.y / d.y : (d.y < 0.0 ? uRoomMin.y / d.y : 1e9);
    float t = min(tx, tz);
    vec2 hit = d * t;
    float height = uCameraHeight + dir.y * t;
    if (height < 0.0 || height > uWallHeight) return false;

    vec2 size = uRoomMax - uRoomMin;
    float along;
    if (tz <= tx) {
      along = d.y < 0.0
        ? hit.x - uRoomMin.x                           // front (-Z)
        : size.x + size.y + (uRoomMax.x - hit.x);      // back (+Z)
    } else {
      along = d.x > 0.0
        ? size.x + (hit.y - uRoomMin.y)                // right (+X)
        : 2.0 * size.x + size.y + (uRoomMax.y - hit.y); // left (-X)
    }

    // The unrolled coordinate wraps in the front-left corner. Pick whichever
    // of the two equivalent values changes smoothly across this pixel, so the
    // texture's mip level does not jump there and draw a seam line.
    float perimeter = 2.0 * (size.x + size.y);
    float wrapped = along > 0.5 * perimeter ? along - perimeter : along;
    along = fwidth(along) <= fwidth(wrapped) ? along : wrapped;

    pos = vec2(along, height) + uGridOffset;
    return true;
  }
`;

/**
 * Stands the tile on the walls: at 0° its width runs horizontally along each
 * wall and its height vertically; rows start at the floor line.
 */
export default function WallTileRenderer({ tileTexture, config, wall }: WallTileRendererProps) {
  const { room } = wall;

  return (
    <TileSurfaceLayer
      tileTexture={tileTexture}
      config={config}
      mask={wall.mask}
      surfaceShader={surfaceShader}
      uniforms={{
        uRoomMin: [room.minX, room.minZ],
        uRoomMax: [room.maxX, room.maxZ],
        uCameraHeight: wall.cameraHeight,
        uWallHeight: wall.wallHeight,
        uYaw: wall.yaw,
        uGridOffset: wall.gridOffset,
      }}
      renderOrder={2}
    />
  );
}
