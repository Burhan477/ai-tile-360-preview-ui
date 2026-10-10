/** Geometry shared by the panorama sphere and the surface layers drawn over it. */
export const SPHERE_RADIUS = 500;
export const SPHERE_SEGMENTS = [64, 32] as const;

/**
 * Mirror on X so the image reads correctly from inside, and rotate so the
 * centre of the panorama faces the initial camera direction (-Z). Layers
 * using the same transform and UVs line up with the panorama pixel for pixel.
 */
export const PANORAMA_MESH_TRANSFORM = {
  scale: [-1, 1, 1],
  rotation: [0, -Math.PI / 2, 0],
} as const;
