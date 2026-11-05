import { useCallback, useEffect, useRef, useState } from "react";
import Map, { Layer, Marker, Source, type MapRef } from "react-map-gl/maplibre";
import Panel from './components/Panel.tsx'
import BuildingMenu from "./components/BuildingMenu.tsx";
import WeatherPanel from "./components/WeatherPanel.tsx";
import Building, { loadBuildings } from "./models/Building.ts";
import { findNearestRestroom, findNearestRoomByTypePrefix, loadRooms, type Room } from "./models/Room.ts";
import { loadRoute, type RouteFeature } from "./models/Route.ts";
import { Baby, Droplets, Ellipsis, House, Toilet, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  getInitialLanguage,
  localizeDestination,
  translate,
  type Language,
  type TranslationKey,
} from "./i18n.ts";
import './App.css'
import configs from "./assets/configs.json"

type MapConfig = typeof configs.main;
type LocalizedMessage = { key: TranslationKey; values?: { name?: string } };
const KIOSK_RESET_DELAY = 60 * 1000;

declare global {
  interface Window {
    dumpConfig?: () => MapConfig | undefined;
  }
}

const isConfigName = (name: string): name is keyof typeof configs =>
  Object.prototype.hasOwnProperty.call(configs, name);

export default function App() {
  const requestedConfigName = new URLSearchParams(window.location.search).get("config");
  const config = requestedConfigName && isConfigName(requestedConfigName)
    ? configs[requestedConfigName]
    : configs.main;
  const initialDestination = useRef(
    new URLSearchParams(window.location.search).get("destination"),
  );
  const destinationRestored = useRef(false);
  const [language, setLanguage] = useState<Language>(getInitialLanguage);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [buildingsLoaded, setBuildingsLoaded] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomsLoaded, setRoomsLoaded] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [route, setRoute] = useState<RouteFeature | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<LocalizedMessage | null>(null);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [buildingsError, setBuildingsError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = useRef<MapRef>(null);
  const routeRequestId = useRef(0);
  const routeController = useRef<AbortController | null>(null);

  const changeLanguage = (nextLanguage: Language) => {
    const url = new URL(window.location.href);
    url.searchParams.set("lang", nextLanguage);
    window.history.replaceState(window.history.state, "", url);
    setLanguage(nextLanguage);
  };

  const showRouteError = useCallback((key: TranslationKey, values?: { name?: string }) => {
    setRouteError({ key, values });
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    void loadBuildings()
      .then((loadedBuildings) => {
        setBuildings(loadedBuildings);
      })
      .catch((error: unknown) => {
        console.error("Failed to load buildings:", error);
        setBuildingsError(error instanceof Error ? error.message : "Failed to load buildings.");
      })
      .finally(() => {
        setBuildingsLoaded(true);
      });
  }, []);

  useEffect(() => {
    void loadRooms()
      .then(setRooms)
      .catch((error: unknown) => {
        console.error("Failed to load rooms:", error);
        setRoomsError(error instanceof Error ? error.message : "Failed to load rooms.");
      })
      .finally(() => {
        setRoomsLoaded(true);
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
        center: [center.lng, center.lat],
        location: config.location,
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

  const navigateTo = useCallback((
    destination: { lat: number; lon: number },
    destinationName: string,
    buildingName: string | null,
    destinationParam: string,
  ) => {
    const url = new URL(window.location.href);
    url.searchParams.set("destination", destinationParam);
    window.history.replaceState(window.history.state, "", url);

    const requestId = ++routeRequestId.current;
    routeController.current?.abort();
    setSelectedBuilding(buildingName);
    setSelectedDestination(destinationName);
    setRoute(null);
    setRouteError(null);
    setRouteLoading(true);

    const fail = (message: LocalizedMessage) => {
      if (routeRequestId.current === requestId) {
        setRouteLoading(false);
        setRouteError(message);
      }
    };

    if (routeRequestId.current !== requestId) return;

    const controller = new AbortController();
    routeController.current = controller;

    void loadRoute(
      { lat: config.location[1], lon: config.location[0] },
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
            maxZoom: 20,
            bearing: mapRef.current?.getMap().getBearing() ?? config.bearing,
          },
        );
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("Failed to load the route:", error);
        fail({ key: "routeLoadError" });
      });
  }, [config]);

  const clearRoute = () => {
    routeRequestId.current += 1;
    routeController.current?.abort();
    routeController.current = null;

    const url = new URL(window.location.href);
    url.searchParams.delete("destination");
    window.history.replaceState(window.history.state, "", url);

    setRoute(null);
    setSelectedBuilding(null);
    setSelectedDestination(null);
    setRouteLoading(false);
    setRouteError(null);
  };

  const resetKioskView = useCallback(() => {
    routeRequestId.current += 1;
    routeController.current?.abort();
    routeController.current = null;
    destinationRestored.current = true;

    const url = new URL(window.location.href);
    url.searchParams.delete("destination");
    window.history.replaceState(window.history.state, "", url);

    setSelectedBuilding(null);
    setSelectedDestination(null);
    setIsMenuOpen(false);
    setRoute(null);
    setRouteLoading(false);
    setRouteError(null);
    mapRef.current?.getMap().easeTo({
      center: config.center,
      zoom: config.zoom,
      pitch: config.pitch,
      bearing: config.bearing,
      duration: 1000,
    });
  }, [config]);

  useEffect(() => {
    let timeoutId = 0;
    const resetTimeout = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(resetKioskView, KIOSK_RESET_DELAY);
    };
    const activityEvents: Array<keyof WindowEventMap> = [
      "pointerdown",
      "pointermove",
      "keydown",
      "touchstart",
      "wheel",
    ];

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, resetTimeout, { passive: true });
    });
    resetTimeout();

    return () => {
      window.clearTimeout(timeoutId);
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, resetTimeout);
      });
    };
  }, [resetKioskView]);

  const selectBuilding = (building: Building) => {
    navigateTo(
      { lat: building.lat, lon: building.lon },
      building.name,
      building.name,
      building.name,
    );
  };

  const selectNearestRestroom = () => {
    if (roomsError) {
      showRouteError("roomsLoadError");
      return;
    }

    const restroom = findNearestRestroom(rooms, {
      lat: config.location[1],
      lon: config.location[0],
    });
    if (!restroom || restroom.lat === null || restroom.lon === null) {
      showRouteError("restroomLocationsUnavailable");
      return;
    }

    navigateTo(
      { lat: restroom.lat, lon: restroom.lon },
      `Restroom: ${restroom.building}, room ${restroom.room}`,
      null,
      "restroom",
    );
  };

  const selectNearestPeriodProduct = () => {
    if (roomsError) {
      showRouteError("roomsLoadError");
      return;
    }

    const room = findNearestRoomByTypePrefix(rooms, {
      lat: config.location[1],
      lon: config.location[0],
    }, "menstrual-product");
    if (!room || room.lat === null || room.lon === null) {
      showRouteError("periodProductsLocationsUnavailable");
      return;
    }

    navigateTo(
      { lat: room.lat, lon: room.lon },
      `Period products: ${room.building}, room ${room.room}`,
      null,
      "period-products",
    );
  };

  const selectNearestChangingTable = () => {
    if (roomsError) {
      showRouteError("roomsLoadError");
      return;
    }

    const room = findNearestRoomByTypePrefix(rooms, {
      lat: config.location[1],
      lon: config.location[0],
    }, "changing-table");
    if (!room || room.lat === null || room.lon === null) {
      showRouteError("changingTableLocationsUnavailable");
      return;
    }

    navigateTo(
      { lat: room.lat, lon: room.lon },
      `Changing table: ${room.building}, room ${room.room}`,
      null,
      "changing-table",
    );
  };

  useEffect(() => {
    const destinationParam = initialDestination.current;
    if (!destinationParam || destinationRestored.current || !mapLoaded) return;

    if (!["restroom", "period-products", "changing-table"].includes(destinationParam)) {
      if (!buildingsLoaded) return;
      destinationRestored.current = true;
      if (buildingsError) {
        showRouteError("buildingLoadError");
        return;
      }

      const building = buildings.find(({ name }) => name === destinationParam);
      if (!building) {
        showRouteError("buildingNotFound", { name: destinationParam });
        return;
      }
      navigateTo(
        { lat: building.lat, lon: building.lon },
        building.name,
        building.name,
        destinationParam,
      );
      return;
    }

    if (!roomsLoaded) return;
    destinationRestored.current = true;

    if (roomsError) {
      showRouteError("roomsLoadError");
      return;
    }

    if (destinationParam === "restroom") {
      const room = findNearestRestroom(rooms, {
        lat: config.location[1],
        lon: config.location[0],
      });
      if (!room || room.lat === null || room.lon === null) {
        showRouteError("restroomLocationsUnavailable");
        return;
      }
      navigateTo(
        { lat: room.lat, lon: room.lon },
        `Restroom: ${room.building}, room ${room.room}`,
        null,
        destinationParam,
      );
    } else if (destinationParam === "period-products") {
      const room = findNearestRoomByTypePrefix(rooms, {
        lat: config.location[1],
        lon: config.location[0],
      }, "menstrual-product");
      if (!room || room.lat === null || room.lon === null) {
        showRouteError("periodProductsLocationsUnavailable");
        return;
      }
      navigateTo(
        { lat: room.lat, lon: room.lon },
        `Period products: ${room.building}, room ${room.room}`,
        null,
        destinationParam,
      );
    } else {
      const room = findNearestRoomByTypePrefix(rooms, {
        lat: config.location[1],
        lon: config.location[0],
      }, "changing-table");
      if (!room || room.lat === null || room.lon === null) {
        showRouteError("changingTableLocationsUnavailable");
        return;
      }
      navigateTo(
        { lat: room.lat, lon: room.lon },
        `Changing table: ${room.building}, room ${room.room}`,
        null,
        destinationParam,
      );
    }
  }, [buildings, buildingsError, buildingsLoaded, config, language, mapLoaded, navigateTo, rooms, roomsError, roomsLoaded, showRouteError]);

  const openMenu = () => setIsMenuOpen((isOpen) => !isOpen);
  const routeEnd = route?.geometry.coordinates.at(-1);
  const routeLabelPosition = (() => {
    const coordinates = route?.geometry.coordinates;
    const map = mapRef.current?.getMap();
    if (!coordinates || coordinates.length < 2 || !map || !routeEnd) return "above";

    const previousCoordinates = coordinates[coordinates.length - 2];
    const previousPoint = map.project([previousCoordinates[0], previousCoordinates[1]]);
    const destinationPoint = map.project([routeEnd[0], routeEnd[1]]);
    const longitudeDirection = destinationPoint.x - previousPoint.x;
    const latitudeDirection = destinationPoint.y - previousPoint.y;

    if (Math.abs(longitudeDirection) > Math.abs(latitudeDirection)) {
      return longitudeDirection > 0 ? "right" : "left";
    }
    return latitudeDirection > 0 ? "below" : "above";
  })();

  return (
    <div lang={language}>
      <WeatherPanel language={language} onLanguageChange={changeLanguage} />
      <div style={{ width: "100%", height: "100vh" }}>
        <Map
          ref={mapRef}
          maxPitch={config.maxPitch}
          attributionControl={false}
          initialViewState={{
            longitude: config.center[0],
            latitude: config.center[1],
            zoom: config.zoom,
            pitch: config.pitch,
            bearing: config.bearing,
          }}
          mapStyle="https://tiles.openfreemap.org/styles/liberty"
          onIdle={() => setMapLoaded(true)}
          onStyleData={({ target: map }) => {
            map.getStyle().layers.forEach(layer => {
              if (layer.type === "symbol") {
                map.removeLayer(layer.id);
              }
            });
          }}
        >
          {buildings.map((building) => (
            <Marker
              key={building.name}
              longitude={building.lon}
              latitude={building.lat}
              anchor="center"
            >
              <div className="building-map-label">
                {building.localizedName(language)}
              </div>
            </Marker>
          ))}
          <Marker
            longitude={config.location[0]}
            latitude={config.location[1]}
            anchor="center"
          >
            <div
              role="img"
              aria-label={translate(language, "routeStart")}
              title={translate(language, "routeStart")}
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
                <div className="destination-marker">
                  <Panel className={`destination-marker-label destination-marker-label-${routeLabelPosition}`}>
                    <div className="destination-qr">
                      <div className="destination-qr-heading">
                        <span className="destination-qr-destination">
                          {selectedDestination ? localizeDestination(selectedDestination, language, buildings) : translate(language, "routeEnd")}
                        </span>
                        <button
                          type="button"
                          className="destination-popup-close"
                          aria-label={translate(language, "closeRoute")}
                          onClick={clearRoute}
                        >
                          <X aria-hidden="true" />
                        </button>
                      </div>
                      <QRCodeSVG
                        value={window.location.href}
                        size={128}
                        level="M"
                        bgColor="transparent"
                        fgColor="white"
                        title={translate(language, "qrTitle")}
                      />
                    </div>
                  </Panel>
                  <div
                    role="img"
                    aria-label={selectedDestination ? localizeDestination(selectedDestination, language, buildings) : translate(language, "routeEnd")}
                    title={selectedDestination ? localizeDestination(selectedDestination, language, buildings) : translate(language, "routeEnd")}
                    className="destination-marker-dot"
                  />
                </div>
              </Marker>
            </>
          )}
        </Map>
      </div>
    <div className="building-panels">
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
          <span>{translate(language, "periodProducts")}</span>
        </div>
      </Panel>
      <Panel
        className={`m-2 cursor-pointer${selectedBuilding === null && selectedDestination?.startsWith("Changing table:") ? " is-selected" : ""}`}
        onClick={selectNearestChangingTable}
      >
        <div className="building-title">
          <Baby aria-hidden="true" />
          <span>{translate(language, "changingTable")}</span>
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
            <span>{building.localizedName(language)}</span>
          </div>
        </Panel>
      ))}
      <Panel className="m-2 cursor-pointer" onClick={openMenu}>
        <Ellipsis aria-hidden="true" />
        <span className="sr-only">{translate(language, "openBuildingList")}</span>
      </Panel>
    </div>
    {isMenuOpen && (
      <BuildingMenu
        buildings={buildings}
        selectedBuilding={selectedBuilding}
        language={language}
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
          {routeLoading
            ? translate(language, "loadingRoute")
            : routeError && translate(language, routeError.key, routeError.values)}
        </Panel>
      </div>
    )}
    </div>
  )
}
