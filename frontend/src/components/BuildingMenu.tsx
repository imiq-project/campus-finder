import { House, X } from "lucide-react";
import type Building from "../models/Building.ts";
import { translate, type Language } from "../i18n.ts";
import "./BuildingMenu.css";

interface BuildingMenuProps {
  buildings: Building[];
  selectedBuilding: string | null;
  language: Language;
  onSelect: (building: Building) => void;
  onClose: () => void;
}

export default function BuildingMenu({
  buildings,
  selectedBuilding,
  language,
  onSelect,
  onClose,
}: BuildingMenuProps) {
  return (
    <section
      className="building-menu glass-panel"
      role="dialog"
      aria-label={translate(language, "allBuildings")}
      lang={language}
    >
      <div className="building-menu-header">
        <h2>{translate(language, "allBuildings")}</h2>
        <button
          className="building-menu-close"
          type="button"
          aria-label={translate(language, "closeBuildingList")}
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
              <span>{building.localizedName(language)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
