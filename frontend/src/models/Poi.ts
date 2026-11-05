export interface PoiRoom {
  room: string | number;
  type: string;
}

export interface Poi {
  name: string;
  name_en: string;
  lat: number;
  lon: number;
  rooms?: PoiRoom[];
}

function isPoiRoom(value: unknown): value is PoiRoom {
  if (typeof value !== "object" || value === null) return false;

  return "room" in value &&
    (typeof value.room === "string" ||
      (typeof value.room === "number" && Number.isFinite(value.room))) &&
    "type" in value &&
    typeof value.type === "string";
}

function isPoi(value: unknown): value is Poi {
  if (typeof value !== "object" || value === null) return false;

  return "name" in value &&
    typeof value.name === "string" &&
    "name_en" in value &&
    typeof value.name_en === "string" &&
    "lat" in value &&
    typeof value.lat === "number" &&
    Number.isFinite(value.lat) &&
    "lon" in value &&
    typeof value.lon === "number" &&
    Number.isFinite(value.lon) &&
    (!("rooms" in value) ||
      (Array.isArray(value.rooms) && value.rooms.every(isPoiRoom)));
}

export async function loadPois(): Promise<Poi[]> {
  const response = await fetch(`${import.meta.env.BASE_URL}pois.json`);
  if (!response.ok) {
    throw new Error(`Failed to load points of interest: ${response.status} ${response.statusText}`);
  }

  const data: unknown = await response.json();
  if (!Array.isArray(data) || !data.every(isPoi)) {
    throw new Error("The points of interest data is invalid.");
  }

  return data;
}
