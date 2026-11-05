import { loadPois } from "./Poi.ts";

export interface Room {
  building: string | number;
  buildingEn: string;
  room: string | number;
  type: string;
  lat: number | null;
  lon: number | null;
}

export async function loadRooms(): Promise<Room[]> {
  const pois = await loadPois();
  return pois.flatMap(({ name, name_en, lat, lon, rooms = [] }) =>
    rooms.map(({ room, type }) => ({
      building: name,
      buildingEn: name_en,
      room,
      type,
      lat,
      lon,
    })),
  );
}

function distanceInMeters(
  first: { lat: number; lon: number },
  second: { lat: number; lon: number },
): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDifference = radians(second.lat - first.lat);
  const longitudeDifference = radians(second.lon - first.lon);
  const haversine =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(radians(first.lat)) * Math.cos(radians(second.lat)) *
    Math.sin(longitudeDifference / 2) ** 2;

  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function findNearestRestroom(
  rooms: Room[],
  origin: { lat: number; lon: number },
): Room | null {
  return findNearestRoomByTypePrefix(rooms, origin, "restroom");
}

export function findNearestRoomByTypePrefix(
  rooms: Room[],
  origin: { lat: number; lon: number },
  typePrefix: string,
): Room | null {
  let nearest: Room | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const room of rooms) {
    if (!room.type.startsWith(typePrefix) || room.lat === null || room.lon === null) continue;

    const distance = distanceInMeters(origin, { lat: room.lat, lon: room.lon });
    if (distance < nearestDistance) {
      nearest = room;
      nearestDistance = distance;
    }
  }

  return nearest;
}
