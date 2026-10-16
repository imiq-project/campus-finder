import { useEffect, useRef, useState } from "react";
import Map, { Layer, Source, type MapRef } from "react-map-gl/maplibre";
import Panel from './components/Panel.tsx'
import WeatherPanel from "./components/WeatherPanel.tsx";
import Building, { loadBuildings } from "./models/Building.ts";
import { loadRoute, type RouteFeature } from "./models/Route.ts";
import {House} from "lucide-react"
import './App.css'

export default function App() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [route, setRoute] = useState<RouteFeature | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const mapRef = useRef<MapRef>(null);
  const routeRequestId = useRef(0);
  const routeController = useRef<AbortController | null>(null);

  useEffect(() => {
    void loadBuildings()
      .then(setBuildings)
      .catch((error: unknown) => {
        console.error("Failed to load buildings:", error);
      });
  }, []);

  useEffect(() => () => {
    routeRequestId.current += 1;
    routeController.current?.abort();
  }, []);

  const selectBuilding = (building: Building) => {
    const requestId = ++routeRequestId.current;
    routeController.current?.abort();
    setSelectedBuilding(building.name);
    setRoute(null);
    setRouteError(null);
    setRouteLoading(true);

    const fail = (message: string) => {
      if (routeRequestId.current === requestId) {
        setRouteLoading(false);
        setRouteError(message);
      }
    };

    if (!navigator.geolocation) {
      fail("Your browser does not support location access.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        if (routeRequestId.current !== requestId) return;

        const controller = new AbortController();
        routeController.current = controller;

        try {
          const feature = await loadRoute(
            { lat: coords.latitude, lon: coords.longitude },
            { lat: building.lat, lon: building.lon },
            controller.signal,
          );
          if (routeRequestId.current !== requestId) return;

          setRoute(feature);
          setRouteLoading(false);
          const coordinates = feature.geometry.coordinates;
          const longitudes = coordinates.map(([longitude]) => longitude);
          const latitudes = coordinates.map(([, latitude]) => latitude);
          mapRef.current?.fitBounds(
            [
              [Math.min(...longitudes), Math.min(...latitudes)],
              [Math.max(...longitudes), Math.max(...latitudes)],
            ],
            { padding: 64, duration: 1000, maxZoom: 17 },
          );
        } catch (error) {
          if (controller.signal.aborted) return;
          fail(error instanceof Error ? error.message : "Failed to load the route.");
        }
      },
      (error) => fail(`Could not get your location: ${error.message}`),
      { enableHighAccuracy: true },
    );
  };

  return (
    <>
      <WeatherPanel />
      <div style={{ width: "100%", height: "100vh" }}>
        <Map
          ref={mapRef}
          maxPitch={80}
          attributionControl={false}
          initialViewState={{
            longitude: 11.645297687180646,
            latitude: 52.13984623034621,
            zoom: 17,
            pitch: 60,
            bearing: -84,
          }}
          mapStyle="https://tiles.openfreemap.org/styles/liberty"
          onStyleData={({ target: map }) => {
            map.getStyle().layers.forEach(layer => {
              if (layer.type === "symbol") {
                map.removeLayer(layer.id);
              }
            });
          }}
        >
          {route && (
            <Source id="building-route" type="geojson" data={route}>
              <Layer
                id="building-route-line"
                type="line"
                layout={{ "line-cap": "round", "line-join": "round" }}
                paint={{ "line-color": "#e11d48", "line-width": 5, "line-opacity": 0.9 }}
              />
            </Source>
          )}
        </Map>
      </div>
    <div style={{position: "absolute", left: "0", top: "0"}} className="flex">
      {buildings.slice(0, 5).map((building) => (
        <Panel
          key={building.name}
          className={`m-2 cursor-pointer${selectedBuilding === building.name ? " is-selected" : ""}`}
          onClick={() => selectBuilding(building)}
        >
          <div className="building-title">
            <House aria-hidden="true" />
            <span>{building.name}</span>
          </div>
        </Panel>
      ))}
    </div>
    {(routeLoading || routeError) && (
      <div style={{ position: "absolute", left: "0", bottom: "0" }}>
        <Panel className="m-2">
          {routeLoading ? "Loading route..." : routeError}
        </Panel>
      </div>
    )}
    </>
  )
}
