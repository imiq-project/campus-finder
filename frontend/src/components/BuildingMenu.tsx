import { House, X } from "lucide-react";
import type Building from "../models/Building.ts";
import "./BuildingMenu.css";

interface BuildingMenuProps {
  buildings: Building[];
  selectedBuilding: string | null;
  onSelect: (building: Building) => void;
  onClose: () => void;
}

export default function BuildingMenu({
  buildings,
  selectedBuilding,
  onSelect,
  onClose,
}: BuildingMenuProps) {
  return (
    <section className="building-menu glass-panel" role="dialog" aria-label="All buildings">
      <div className="building-menu-header">
        <h2>All buildings</h2>
        <button
          className="building-menu-close"
          type="button"
          aria-label="Close building list"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
      </div>
      <ul className="building-menu-list">
        {buildings.map((building) => (
          <li key={building.name}>
            <button
              className={`building-menu-item${selectedBuilding === building.name ? " is-selected" : ""}`}
              type="button"
              onClick={() => onSelect(building)}
            >
              <House aria-hidden="true" />
              <span>{building.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
