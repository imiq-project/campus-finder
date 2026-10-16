import { useEffect, useState } from "react";
import Map from "react-map-gl/maplibre";
import Panel from './components/Panel.tsx'
import Building, { loadBuildings } from "./models/Building.ts";
import {House} from "lucide-react"
import './App.css'

export default function App() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);

  useEffect(() => {
    void loadBuildings()
      .then(setBuildings)
      .catch((error: unknown) => {
        console.error("Failed to load buildings:", error);
      });
  }, []);

  return (
    <>
      <div style={{ width: "100%", height: "100vh" }}>
        <Map
          initialViewState={{
            longitude: 11.645297687180646,
            latitude: 52.13984623034621,
            zoom: 17,
            pitch: 60,
            maxPitch: 80,
            bearing: -84,
            antialias: true,
            attributionControl: false
          }}
          mapStyle="https://tiles.openfreemap.org/styles/liberty"
          onStyleData={({ target: map }) => {
            map.getStyle().layers.forEach(layer => {
              if (layer.type === "symbol") {
                map.removeLayer(layer.id);
              }
            });
          }}
        />
      </div>
    <div style={{position: "absolute", left: "0", top: "0"}} className="flex">
      {buildings.slice(0, 5).map((building) => (
        <Panel
          key={building.name}
          className={`m-2 cursor-pointer`}
          onClick={() => setSelectedBuilding(building.name)}
        >
          <div className="building-title">
            <House aria-hidden="true" />
            <span>{building.name}</span>
          </div>
        </Panel>
      ))}
    </div>
    </>
  )
}
