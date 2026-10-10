"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { EMPTY_TILE_DRAFT } from "@/lib/tile";
import type { RoomImage, TileDraft, TileImage } from "@/types/tile";

interface TileDraftContextValue {
  draft: TileDraft;
  updateDraft: (patch: Partial<Omit<TileDraft, "image">>) => void;
  /** Replaces (or clears) the image, releasing the previous object URL. */
  setImage: (image: TileImage | null) => void;
  /** Room photo stored in the `room-images` bucket, kept for the AI preview step. */
  roomImage: RoomImage | null;
  /** Replaces (or clears) the room photo, releasing the previous preview URL. */
  setRoomImage: (image: RoomImage | null) => void;
}

const TileDraftContext = createContext<TileDraftContextValue | null>(null);

function releaseImage(image: TileImage | null) {
  if (image?.source === "upload") URL.revokeObjectURL(image.url);
}

/**
 * Holds the tile being configured and the uploaded room photo. It lives in
 * the root layout so the uploaded images (in-memory object URLs) survive
 * client-side navigation between the selection page and the viewer without
 * being serialised into the URL. A full page reload starts a fresh draft.
 */
export default function TileDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<TileDraft>(EMPTY_TILE_DRAFT);
  // Mirrors `draft.image` so URLs can be revoked outside of state updaters.
  const imageRef = useRef<TileImage | null>(null);
  const [roomImage, setRoomImageState] = useState<RoomImage | null>(null);
  const roomImageRef = useRef<RoomImage | null>(null);

  const setImage = useCallback((image: TileImage | null) => {
    const previous = imageRef.current;
    imageRef.current = image;
    if (previous && previous.url !== image?.url) releaseImage(previous);
    setDraft((prev) => ({ ...prev, image }));
  }, []);

  const setRoomImage = useCallback((image: RoomImage | null) => {
    const previous = roomImageRef.current;
    roomImageRef.current = image;
    if (previous && previous.previewUrl !== image?.previewUrl) URL.revokeObjectURL(previous.previewUrl);
    setRoomImageState(image);
  }, []);

  const updateDraft = useCallback((patch: Partial<Omit<TileDraft, "image">>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  useEffect(
    () => () => {
      releaseImage(imageRef.current);
      if (roomImageRef.current) URL.revokeObjectURL(roomImageRef.current.previewUrl);
    },
    [],
  );

  const value = useMemo(
    () => ({ draft, updateDraft, setImage, roomImage, setRoomImage }),
    [draft, updateDraft, setImage, roomImage, setRoomImage],
  );

  return <TileDraftContext value={value}>{children}</TileDraftContext>;
}

export function useTileDraft(): TileDraftContextValue {
  const context = useContext(TileDraftContext);
  if (!context) throw new Error("useTileDraft must be used inside <TileDraftProvider>");
  return context;
}
