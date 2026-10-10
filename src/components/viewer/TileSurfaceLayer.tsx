"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import {
  BackSide,
  Color,
  MathUtils,
  Vector2,
  Vector3,
  Vector4,
  type ShaderMaterial,
  type Texture,
} from "three";

import {
  PANORAMA_MESH_TRANSFORM,
  SPHERE_RADIUS,
  SPHERE_SEGMENTS,
} from "@/components/viewer/panoramaSphere";
import { useThreeTexture } from "@/hooks/useThreeTexture";
import type { TileRenderConfig } from "@/types/viewer";

/** A float, or a vec2–vec4 given as a tuple. */
export type SurfaceUniformInput = number | readonly number[];

interface TileSurfaceLayerProps {
  tileTexture: Texture;
  config: TileRenderConfig;
  /** Equirectangular mask URL; white = this surface. */
  mask: string;
  /**
   * GLSL defining `bool surfacePosition(vec3 dir, out vec2 pos)`: maps a view
   * direction (panorama frame, camera at the origin) to a position in metres
   * on the surface's tile grid, or returns false where the ray misses it.
   */
  surfaceShader: string;
  /** Uniforms used by `surfaceShader`; the set of names must not change. */
  uniforms: Record<string, SurfaceUniformInput>;
  renderOrder: number;
}

/** Just inside the panorama sphere, so surface layers draw over it. */
const LAYER_RADIUS = SPHERE_RADIUS * 0.98;
const FADE_EASING = 6;
const MM_TO_METRES = 0.001;

const VECTORS = [Vector2, Vector3, Vector4] as const;
type UniformVector = Vector2 | Vector3 | Vector4;

const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * For each pixel: rebuild the view direction from the equirectangular UV,
 * let the surface map it to a position on its plane(s), and lay out tiles and
 * grout joints there. The mask decides where the tile shows.
 */
const fragmentShader = (surfaceShader: string) => /* glsl */ `
  #define PI 3.141592653589793

  uniform sampler2D uTile;
  uniform sampler2D uMask;
  uniform vec2 uTileSize;    // metres, as the image is drawn
  uniform float uGroutWidth; // metres
  uniform vec3 uGroutColor;
  uniform float uRotated;    // 1.0 for a quarter turn
  uniform float uOpacity;

  varying vec2 vUv;

  ${surfaceShader}

  void main() {
    float mask = texture2D(uMask, vUv).r;
    if (mask < 0.004) discard;

    // Same convention as the panorama: u = 0.5 looks down -Z, v = 1 is straight up.
    float lon = (vUv.x - 0.5) * 2.0 * PI;
    float lat = (vUv.y - 0.5) * PI;
    vec3 dir = vec3(cos(lat) * sin(lon), sin(lat), -cos(lat) * cos(lon));

    vec2 pos;
    if (!surfacePosition(dir, pos)) discard;

    bool rotated = uRotated > 0.5;
    // Footprint of one tile on the surface, and the grid pitch including one joint.
    vec2 footprint = rotated ? uTileSize.yx : uTileSize;
    vec2 pitch = footprint + uGroutWidth;

    // Position inside the current cell. Joints are centred on cell edges, so
    // the grid origin (a room corner, the floor line) falls mid-joint.
    vec2 inCell = mod(pos, pitch);
    vec2 local = clamp((inCell - 0.5 * uGroutWidth) / footprint, 0.0, 1.0);
    // Quarter turn: the image's width runs up the cell, its height across.
    vec2 uv = rotated ? vec2(local.y, 1.0 - local.x) : local;

    // Gradients from the continuous position, so the mip level does not jump
    // at cell edges and draw a seam line around every tile.
    vec2 dx = dFdx(pos) / footprint;
    vec2 dy = dFdy(pos) / footprint;
    if (rotated) {
      dx = vec2(dx.y, -dx.x);
      dy = vec2(dy.y, -dy.x);
    }
    vec3 tile = textureGrad(uTile, uv, dx, dy).rgb;

    // Anti-aliased joints: approximate pixel coverage of the joint band,
    // fading out when it is thinner than a pixel instead of shimmering.
    vec2 edgeDistance = min(inCell, pitch - inCell);
    vec2 pixel = max(fwidth(pos), vec2(1e-6));
    vec2 joint = clamp((0.5 * uGroutWidth - edgeDistance) / pixel + 0.5, 0.0, 1.0)
      * clamp(uGroutWidth / pixel, 0.0, 1.0);
    float grout = max(joint.x, joint.y);

    gl_FragColor = vec4(mix(tile, uGroutColor, grout), mask * uOpacity);
    #include <colorspace_fragment>
  }
`;

function toUniformValue(input: SurfaceUniformInput): number | UniformVector {
  if (typeof input === "number") return input;
  const Vector = VECTORS[input.length - 2];
  if (!Vector) throw new Error(`Unsupported uniform size: ${input.length}`);
  return new Vector().fromArray(input);
}

/**
 * Draws the tile on one surface of the panorama as a separate layer over the
 * untouched panorama sphere. Changing the tile image, layout or mapping only
 * swaps a texture or updates uniforms; the panorama and scene are never rebuilt.
 */
export default function TileSurfaceLayer({
  tileTexture,
  config,
  mask,
  surfaceShader,
  uniforms,
  renderOrder,
}: TileSurfaceLayerProps) {
  const maskTexture = useThreeTexture(mask).texture;
  const materialRef = useRef<ShaderMaterial>(null);

  // Created once; values are pushed in every frame below (via the material,
  // which owns this object), so updates never recompile the shader.
  const [initialUniforms] = useState(() => ({
    uTile: { value: null as Texture | null },
    uMask: { value: null as Texture | null },
    uTileSize: { value: new Vector2(1, 1) },
    uGroutWidth: { value: 0 },
    // Converts the sRGB hex value to the linear working space the shader blends in.
    uGroutColor: { value: new Color() },
    uRotated: { value: 0 },
    uOpacity: { value: 0 },
    ...Object.fromEntries(
      Object.entries(uniforms).map(([name, input]) => [name, { value: toUniformValue(input) }]),
    ),
  }));
  const shader = useMemo(() => fragmentShader(surfaceShader), [surfaceShader]);

  const isReady = maskTexture !== null;

  useFrame((_, delta) => {
    const material = materialRef.current;
    if (!material) return;
    const current = material.uniforms;

    current.uTile.value = tileTexture;
    current.uMask.value = maskTexture;
    (current.uTileSize.value as Vector2).set(
      config.width * MM_TO_METRES,
      config.height * MM_TO_METRES,
    );
    current.uGroutWidth.value = config.groutWidth * MM_TO_METRES;
    (current.uGroutColor.value as Color).set(config.groutColor);
    current.uRotated.value = config.rotation === 90 ? 1 : 0;
    for (const [name, input] of Object.entries(uniforms)) {
      if (typeof input === "number") current[name].value = input;
      else (current[name].value as UniformVector).fromArray(input);
    }
    // Fade the layer in once the mask is available.
    current.uOpacity.value = MathUtils.lerp(
      current.uOpacity.value as number,
      isReady ? 1 : 0,
      1 - Math.exp(-delta * FADE_EASING),
    );
  });

  if (!isReady) return null;

  return (
    <mesh
      scale={[...PANORAMA_MESH_TRANSFORM.scale]}
      rotation={[...PANORAMA_MESH_TRANSFORM.rotation]}
      renderOrder={renderOrder}
    >
      <sphereGeometry args={[LAYER_RADIUS, ...SPHERE_SEGMENTS]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={initialUniforms}
        vertexShader={vertexShader}
        fragmentShader={shader}
        side={BackSide}
        transparent
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
      />
    </mesh>
  );
}
