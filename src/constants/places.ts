import {
  Bath,
  BedDouble,
  CookingPot,
  DoorOpen,
  Sofa,
  UtensilsCrossed,
} from "lucide-react";

import type { Place, PlaceId, RoomType } from "@/types/tile";

/**
 * Places the app has an icon and a panorama for. The `room_types` table
 * decides which of them are offered, in what order and with what text; this
 * list is the fallback when the database cannot be read.
 */
export const PLACES: Place[] = [
  { id: "hall", name: "Hall", description: "Entrance & passage", icon: DoorOpen },
  { id: "living-room", name: "Living Room", description: "Open lounge space", icon: Sofa },
  { id: "bedroom", name: "Bedroom", description: "Calm & private", icon: BedDouble },
  { id: "bathroom", name: "Bathroom", description: "Wet-area finish", icon: Bath },
  { id: "kitchen", name: "Kitchen", description: "High-traffic floor", icon: CookingPot },
  { id: "dining-room", name: "Dining Room", description: "Gathering space", icon: UtensilsCrossed },
];

export function isPlaceId(value: unknown): value is PlaceId {
  return PLACES.some((place) => place.id === value);
}

/** Database room types as selectable places, with the app's icons. */
export function placesFromRoomTypes(roomTypes: RoomType[]): Place[] {
  return roomTypes.flatMap((room) => {
    const place = PLACES.find((p) => p.id === room.id);
    return place ? [{ ...place, name: room.name, description: room.description }] : [];
  });
}
