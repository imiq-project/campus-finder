import { useEffect, useRef, useState } from "react";
import Map, { Layer, Marker, Source, type MapRef } from "react-map-gl/maplibre";
import Panel from './components/Panel.tsx'
import BuildingMenu from "./components/BuildingMenu.tsx";
import WeatherPanel from "./components/WeatherPanel.tsx";
import Building, { loadBuildings } from "./models/Building.ts";
import { findNearestRestroom, findNearestRoomByTypePrefix, loadRooms, type Room } from "./models/Room.ts";
import { loadRoute, type RouteFeature } from "./models/Route.ts";
import { Droplets, Ellipsis, House, Toilet } from "lucide-react";
import './App.css'
import configs from "./assets/configs.json"

type MapConfig = typeof configs.main;

declare global {
  interface Window {
    dumpConfig?: () => MapConfig | undefined;
  }
}

const isConfigName = (name: string): name is keyof typeof configs =>
  Object.prototype.hasOwnProperty.call(configs, name);

export default function App() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [route, setRoute] = useState<RouteFeature | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [roomsError, setRoomsError] = useState<string | null>(null);
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

  useEffect(() => {
    void loadRooms()
      .then(setRooms)
      .catch((error: unknown) => {
        console.error("Failed to load rooms:", error);
        setRoomsError(error instanceof Error ? error.message : "Failed to load rooms.");
      });
  }, []);

  useEffect(() => () => {
    routeRequestId.current += 1;
    routeController.current?.abort();
  }, []);

  useEffect(() => {
    window.dumpConfig = () => {
      const map = mapRef.current?.getMap();
      if (!map) {
        console.warn("Map is not ready; cannot dump its settings.");
        return undefined;
      }

      const center = map.getCenter();
      const mapConfig: MapConfig = {
        maxPitch: map.getMaxPitch(),
        longitude: center.lng,
        latitude: center.lat,
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing(),
      };

      console.log(JSON.stringify(mapConfig, null, 2));
      return mapConfig;
    };

    return () => {
      delete window.dumpConfig;
    };
  }, []);

  const navigateTo = (
    destination: { lat: number; lon: number },
    destinationName: string,
    buildingName: string | null,
  ) => {
    const requestId = ++routeRequestId.current;
    routeController.current?.abort();
    setSelectedBuilding(buildingName);
    setSelectedDestination(destinationName);
    setRoute(null);
    setRouteError(null);
    setRouteLoading(true);

    const fail = (message: string) => {
      if (routeRequestId.current === requestId) {
        setRouteLoading(false);
        setRouteError(message);
      }
    };

    if (routeRequestId.current !== requestId) return;

    const controller = new AbortController();
    routeController.current = controller;

    void loadRoute(
      { lat: config.latitude, lon: config.longitude },
      destination,
      controller.signal,
    )
      .then((feature) => {
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
          {
            padding: 64,
            duration: 1000,
            maxZoom: 17,
            bearing: mapRef.current?.getMap().getBearing() ?? config.bearing,
          },
        );
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        fail(error instanceof Error ? error.message : "Failed to load the route.");
      });
  };

  const selectBuilding = (building: Building) => {
    navigateTo(
      { lat: building.lat, lon: building.lon },
      building.name,
      building.name,
    );
  };

  const selectNearestRestroom = () => {
    if (roomsError) {
      setRouteError(roomsError);
      return;
    }

    const restroom = findNearestRestroom(rooms, {
      lat: config.latitude,
      lon: config.longitude,
    });
    if (!restroom || restroom.lat === null || restroom.lon === null) {
      setRouteError("No restroom locations with coordinates are available.");
      return;
    }

    navigateTo(
      { lat: restroom.lat, lon: restroom.lon },
      `Restroom: ${restroom.building}, room ${restroom.room}`,
      null,
    );
  };

  const selectNearestPeriodProduct = () => {
    if (roomsError) {
      setRouteError(roomsError);
      return;
    }

    const room = findNearestRoomByTypePrefix(rooms, {
      lat: config.latitude,
      lon: config.longitude,
    }, "menstrual-product");
    if (!room || room.lat === null || room.lon === null) {
      setRouteError("No period-product locations with coordinates are available.");
      return;
    }

    navigateTo(
      { lat: room.lat, lon: room.lon },
      `Period products: ${room.building}, room ${room.room}`,
      null,
    );
  };

  const openMenu = () => setIsMenuOpen((isOpen) => !isOpen);
  const requestedConfigName = new URLSearchParams(window.location.search).get("configName");
  const config = requestedConfigName && isConfigName(requestedConfigName)
    ? configs[requestedConfigName]
    : configs.main;
  const routeEnd = route?.geometry.coordinates.at(-1);

  return (
    <>
      <WeatherPanel />
      <div style={{ width: "100%", height: "100vh" }}>
        <Map
          ref={mapRef}
          maxPitch={config.maxPitch}
          attributionControl={false}
          initialViewState={{
            longitude: config.longitude,
            latitude: config.latitude,
            zoom: config.zoom,
            pitch: config.pitch,
            bearing: config.bearing,
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
          <Marker
            longitude={config.longitude}
            latitude={config.latitude}
            anchor="center"
          >
            <div
              role="img"
              aria-label="Route start"
              title="Route start"
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                border: "3px solid white",
                backgroundColor: "#16a34a",
                boxShadow: "0 1px 4px #0008",
              }}
            />
          </Marker>
          {route && routeEnd && (
            <>
              <Source id="building-route" type="geojson" data={route}>
                <Layer
                  id="building-route-line"
                  type="line"
                  layout={{ "line-cap": "round", "line-join": "round" }}
                  paint={{ "line-color": "#e11d48", "line-width": 5, "line-opacity": 0.9 }}
                />
              </Source>
              <Marker
                longitude={routeEnd[0]}
                latitude={routeEnd[1]}
                anchor="center"
              >
                <div
                  role="img"
                  aria-label={selectedDestination ?? "Route end"}
                  title={selectedDestination ?? "Route end"}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    border: "3px solid white",
                    backgroundColor: "#e11d48",
                    boxShadow: "0 1px 4px #0008",
                  }}
                />
              </Marker>
            </>
          )}
        </Map>
      </div>
    <div style={{position: "absolute", left: "0", top: "0"}} className="flex">
      <Panel
        className={`m-2 cursor-pointer${selectedBuilding === null && selectedDestination?.startsWith("Restroom:") ? " is-selected" : ""}`}
        onClick={selectNearestRestroom}
      >
        <div className="building-title">
          <Toilet aria-hidden="true" />
          <span>WC</span>
        </div>
      </Panel>
      <Panel
        className={`m-2 cursor-pointer${selectedBuilding === null && selectedDestination?.startsWith("Period products:") ? " is-selected" : ""}`}
        onClick={selectNearestPeriodProduct}
      >
        <div className="building-title">
          <Droplets aria-hidden="true" />
          <span>Period products</span>
        </div>
      </Panel>
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
      <Panel className="m-2 cursor-pointer" onClick={openMenu}>
        <Ellipsis aria-hidden="true" />
        <span className="sr-only">Show all buildings</span>
      </Panel>
    </div>
    {isMenuOpen && (
      <BuildingMenu
        buildings={buildings}
        selectedBuilding={selectedBuilding}
        onSelect={(building) => {
          setIsMenuOpen(false);
          selectBuilding(building);
        }}
        onClose={() => setIsMenuOpen(false)}
      />
    )}
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
