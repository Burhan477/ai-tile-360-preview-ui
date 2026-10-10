"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { RotateCcw } from "lucide-react";
import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentRef,
  type RefObject,
} from "react";
import {
  BackSide,
  MathUtils,
  PerspectiveCamera,
  SRGBColorSpace,
  Spherical,
  Vector3,
  type Texture,
} from "three";

import {
  PANORAMA_MESH_TRANSFORM,
  SPHERE_RADIUS,
  SPHERE_SEGMENTS,
} from "@/components/viewer/panoramaSphere";
import TileRenderer from "@/components/viewer/TileRenderer";
import ViewerLoading from "@/components/viewer/ViewerLoading";
import { useThreeTexture, type TextureStatus } from "@/hooks/useThreeTexture";
import type { TileSurface } from "@/types/tile";
import type { SurfaceMappings, TileRenderConfig, ViewerTileData } from "@/types/viewer";

/** Imperative API used by the HTML controls rendered outside the canvas. */
export interface PanoramaViewerHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
}

interface PanoramaViewerProps {
  /** Equirectangular (2:1) image URL. Changing it swaps the panorama in place. */
  src: string;
  /** Tile to render; each selected surface needs a mapping in `surfaces`. */
  tile?: ViewerTileData | null;
  /** Size, grout and orientation; required to render `tile`. */
  tileConfig?: TileRenderConfig | null;
  surface?: TileSurface | null;
  surfaces?: SurfaceMappings;
  onTileTextureStatus?: (imageUrl: string, status: TextureStatus) => void;
  controllerRef?: RefObject<PanoramaViewerHandle | null>;
  /** Called on the first pointer/wheel interaction with the canvas. */
  onInteract?: () => void;
}

/** The camera orbits a tiny radius around the centre, so it effectively stays put. */
const CAMERA_DISTANCE = 0.1;

const DEFAULT_FOV = 75;
/** Portrait screens need a taller vertical FOV to show a comparable slice of the room. */
const PORTRAIT_FOV = 95;
const MIN_FOV = 30;
const MAX_FOV = 100;
const ZOOM_STEP = 12;

/** Negative so dragging "grabs" the room rather than orbiting the camera. */
const BASE_ROTATE_SPEED = -0.35;
/** Higher is snappier; used for frame-rate independent easing. */
const EASING = 10;

const INITIAL_THETA = 0;
const INITIAL_PHI = Math.PI / 2;

const clampFov = (fov: number) => MathUtils.clamp(fov, MIN_FOV, MAX_FOV);
const defaultFov = (isPortrait: boolean) => (isPortrait ? PORTRAIT_FOV : DEFAULT_FOV);

// Reused every frame to avoid allocations in the render loop.
const resetOffset = new Vector3();
const resetSpherical = new Spherical();

function PanoramaSphere({ texture }: { texture: Texture }) {
  return (
    <mesh scale={[...PANORAMA_MESH_TRANSFORM.scale]} rotation={[...PANORAMA_MESH_TRANSFORM.rotation]}>
      <sphereGeometry args={[SPHERE_RADIUS, ...SPHERE_SEGMENTS]} />
      <meshBasicMaterial map={texture} side={BackSide} toneMapped={false} />
    </mesh>
  );
}

interface CameraRigProps {
  controllerRef?: RefObject<PanoramaViewerHandle | null>;
  onInteract?: () => void;
}

/** Look-around controls plus FOV-based zoom (wheel, pinch, buttons) and reset. */
function CameraRig({ controllerRef, onInteract }: CameraRigProps) {
  const domElement = useThree((state) => state.gl.domElement);
  const isPortrait = useThree((state) => state.size.width < state.size.height);
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);
  const targetFov = useRef(defaultFov(isPortrait));
  const isResetting = useRef(false);

  useImperativeHandle(
    controllerRef,
    () => ({
      zoomIn: () => {
        targetFov.current = clampFov(targetFov.current - ZOOM_STEP);
      },
      zoomOut: () => {
        targetFov.current = clampFov(targetFov.current + ZOOM_STEP);
      },
      resetView: () => {
        targetFov.current = defaultFov(isPortrait);
        isResetting.current = true;
      },
    }),
    [isPortrait],
  );

  // Re-frame when the device is rotated between portrait and landscape.
  useEffect(() => {
    targetFov.current = defaultFov(isPortrait);
  }, [isPortrait]);

  // Wheel and two-finger pinch zoom adjust the field of view instead of
  // dollying, so the camera never leaves the centre of the sphere.
  useEffect(() => {
    const touches = new Map<number, { x: number; y: number }>();
    let pinch: { distance: number; fov: number } | null = null;

    const touchDistance = () => {
      const [a, b] = Array.from(touches.values());
      return Math.hypot(a.x - b.x, a.y - b.y);
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      onInteract?.();
      const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * 16 : event.deltaY;
      targetFov.current = clampFov(targetFov.current + MathUtils.clamp(delta, -100, 100) * 0.05);
    };

    const handlePointerDown = (event: PointerEvent) => {
      onInteract?.();
      isResetting.current = false;
      if (event.pointerType !== "touch") return;
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touches.size === 2) pinch = { distance: touchDistance(), fov: targetFov.current };
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!touches.has(event.pointerId)) return;
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pinch && touches.size === 2) {
        const distance = touchDistance();
        if (distance > 0) targetFov.current = clampFov((pinch.fov * pinch.distance) / distance);
      }
    };

    const handlePointerEnd = (event: PointerEvent) => {
      touches.delete(event.pointerId);
      if (touches.size < 2) pinch = null;
    };

    domElement.addEventListener("wheel", handleWheel, { passive: false });
    domElement.addEventListener("pointerdown", handlePointerDown);
    domElement.addEventListener("pointermove", handlePointerMove);
    domElement.addEventListener("pointerup", handlePointerEnd);
    domElement.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      domElement.removeEventListener("wheel", handleWheel);
      domElement.removeEventListener("pointerdown", handlePointerDown);
      domElement.removeEventListener("pointermove", handlePointerMove);
      domElement.removeEventListener("pointerup", handlePointerEnd);
      domElement.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [domElement, onInteract]);

  useFrame((state, delta) => {
    const camera = state.camera as PerspectiveCamera;
    const ease = 1 - Math.exp(-delta * EASING);
    const controls = controlsRef.current;

    if (Math.abs(camera.fov - targetFov.current) > 0.01) {
      camera.fov = MathUtils.lerp(camera.fov, targetFov.current, ease);
      camera.updateProjectionMatrix();
    }

    if (!controls) return;

    // Slower look-around when zoomed in keeps dragging precise.
    controls.rotateSpeed = BASE_ROTATE_SPEED * (camera.fov / DEFAULT_FOV);

    if (isResetting.current) {
      const offset = resetOffset;
      const spherical = resetSpherical;
      spherical.setFromVector3(offset.copy(camera.position).sub(controls.target));

      // Shortest angular path back to the initial heading.
      const dTheta =
        MathUtils.euclideanModulo(INITIAL_THETA - spherical.theta + Math.PI, Math.PI * 2) - Math.PI;
      const dPhi = INITIAL_PHI - spherical.phi;

      spherical.theta += dTheta * ease;
      spherical.phi += dPhi * ease;
      camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
      controls.update();

      if (Math.abs(dTheta) < 1e-3 && Math.abs(dPhi) < 1e-3) isResetting.current = false;
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableZoom={false}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      minPolarAngle={0.1}
      maxPolarAngle={Math.PI - 0.1}
    />
  );
}

export default function PanoramaViewer({
  src,
  tile,
  tileConfig,
  surface,
  surfaces,
  onTileTextureStatus,
  controllerRef,
  onInteract,
}: PanoramaViewerProps) {
  const [attempt, setAttempt] = useState(0);
  const { status, texture } = useThreeTexture(src, { colorSpace: SRGBColorSpace, attempt });

  return (
    <div className="absolute inset-0">
      <Canvas
        flat
        dpr={[1, 2]}
        camera={{ fov: DEFAULT_FOV, near: 0.01, far: SPHERE_RADIUS * 2, position: [0, 0, CAMERA_DISTANCE] }}
        className="cursor-grab touch-none active:cursor-grabbing"
        aria-label="Interactive 360° room view. Drag to look around."
      >
        <color attach="background" args={["#0c0a09"]} />
        {texture && <PanoramaSphere texture={texture} />}
        {/* Separate layer: swapping the tile never reloads the panorama. */}
        {texture && tile && tileConfig && surface && (
          <TileRenderer
            tile={tile}
            config={tileConfig}
            surface={surface}
            floor={surfaces?.floor}
            wall={surfaces?.wall}
            onTextureStatus={onTileTextureStatus}
          />
        )}
        <CameraRig controllerRef={controllerRef} onInteract={onInteract} />
      </Canvas>

      <ViewerLoading visible={status === "loading"} />

      {status === "error" && (
        <div
          role="alert"
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-stone-950 px-6 text-center"
        >
          <p className="font-display text-xl text-stone-100">We couldn&apos;t load this room</p>
          <p className="max-w-xs text-sm text-stone-400">
            The 360° panorama failed to load. Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="mt-2 flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-accent-muted focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950 focus-visible:outline-none"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
