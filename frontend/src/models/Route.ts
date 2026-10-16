import type { Feature, LineString } from "geojson";

const routeEndpoint = "https://imiq-app.et.uni-magdeburg.de/api/graphhopper/route";

export type RouteFeature = Feature<LineString>;

function parseRoute(payload: unknown): RouteFeature {
  if (typeof payload !== "object" || payload === null || !("paths" in payload) ||
      !Array.isArray(payload.paths) || payload.paths.length === 0) {
    throw new Error("The routing service returned no route.");
  }

  const points: unknown = payload.paths[0]?.points;
  if (typeof points !== "object" || points === null ||
      !("coordinates" in points) || !Array.isArray(points.coordinates)) {
    throw new Error("The routing service returned an invalid route geometry.");
  }

  const coordinates: [number, number][] = [];
  for (const coordinate of points.coordinates) {
    if (!Array.isArray(coordinate) || coordinate.length < 2 ||
        typeof coordinate[0] !== "number" || typeof coordinate[1] !== "number") {
      throw new Error("The routing service returned invalid route coordinates.");
    }
    coordinates.push([coordinate[0], coordinate[1]]);
  }
  if (coordinates.length < 2) {
    throw new Error("The routing service returned an incomplete route.");
  }

  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates,
    },
  };
}

export async function loadRoute(
  origin: { lat: number; lon: number },
  destination: { lat: number; lon: number },
  signal: AbortSignal,
): Promise<RouteFeature> {
  const url = new URL(routeEndpoint);
  url.searchParams.append("point", `${origin.lat},${origin.lon}`);
  url.searchParams.append("point", `${destination.lat},${destination.lon}`);
  url.searchParams.set("profile", "foot");
  url.searchParams.set("points_encoded", "false");

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Routing request failed: ${response.status} ${response.statusText}`);
  }
  return parseRoute(await response.json());
}
