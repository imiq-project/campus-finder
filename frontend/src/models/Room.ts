export interface Room {
  building: string | number;
  room: string | number;
  type: string;
  lat: number | null;
  lon: number | null;
}

function isRoom(value: unknown): value is Room {
  if (typeof value !== "object" || value === null) return false;

  return "building" in value &&
    (typeof value.building === "string" || typeof value.building === "number") &&
    "room" in value &&
    (typeof value.room === "string" || typeof value.room === "number") &&
    "type" in value &&
    typeof value.type === "string" &&
    "lat" in value &&
    (value.lat === null || (typeof value.lat === "number" && Number.isFinite(value.lat))) &&
    "lon" in value &&
    (value.lon === null || (typeof value.lon === "number" && Number.isFinite(value.lon)));
}

export async function loadRooms(): Promise<Room[]> {
  const response = await fetch(`${import.meta.env.BASE_URL}rooms.json`);
  if (!response.ok) {
    throw new Error(`Failed to load rooms: ${response.status} ${response.statusText}`);
  }

  const data: unknown = await response.json();
  if (!Array.isArray(data) || !data.every(isRoom)) {
    throw new Error("The rooms data is invalid.");
  }

  return data;
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
