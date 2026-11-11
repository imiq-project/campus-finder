export type Language = "de" | "en";

const translations = {
  en: {
    allBuildings: "All buildings",
    buildingNotFound: 'Building "{name}" was not found.',
    buildingLoadError: "Building data could not be loaded.",
    closeBuildingList: "Close building list",
    closeFacilityMenu: "Close facility menu",
    closeRoute: "Close route",
    changingTable: "Changing table",
    changingTableDestination: "Changing table:",
    changingTableLocationsUnavailable: "No changing-table locations with coordinates are available.",
    dry: "No rain",
    language: "Language",
    loadingRoute: "Loading route...",
    loadingWeather: "Loading weather...",
    maleRestroom: "WC male",
    maleRestroomDestination: "Male restroom:",
    maleRestroomLocationsUnavailable: "No male restroom locations with coordinates are available.",
    openBuildingList: "Show all buildings",
    periodProducts: "Period products",
    periodProductsDestination: "Period products:",
    periodProductsLocationsUnavailable: "No period-product locations with coordinates are available.",
    qrTitle: "Scan to open this destination on your phone",
    rain: "Rain",
    femaleRestroom: "WC female",
    femaleRestroomDestination: "Female restroom:",
    femaleRestroomLocationsUnavailable: "No female restroom locations with coordinates are available.",
    restroomDestination: "Restroom:",
    restroomLocationsUnavailable: "No restroom locations with coordinates are available.",
    routeEnd: "Route end",
    routeLoadError: "Could not load the route.",
    routeStart: "Route start",
    roomsLoadError: "Room data could not be loaded.",
    room: "room",
    weatherLoadError: "Weather could not be loaded.",
    restroomMenu: "WC",
  },
  de: {
    allBuildings: "Alle Gebäude",
    buildingNotFound: 'Gebäude "{name}" wurde nicht gefunden.',
    buildingLoadError: "Gebäudedaten konnten nicht geladen werden.",
    closeBuildingList: "Gebäudeliste schließen",
    closeFacilityMenu: "Einrichtungsmenü schließen",
    closeRoute: "Route schließen",
    changingTable: "Wickeltisch",
    changingTableDestination: "Wickeltisch:",
    changingTableLocationsUnavailable: "Es sind keine Wickeltische mit Koordinaten verfügbar.",
    dry: "Kein Regen",
    language: "Sprache",
    loadingRoute: "Route wird geladen...",
    loadingWeather: "Wetter wird geladen...",
    maleRestroom: "WC Herren",
    maleRestroomDestination: "Herrentoilette:",
    maleRestroomLocationsUnavailable: "Es sind keine Herrentoiletten mit Koordinaten verfügbar.",
    openBuildingList: "Alle Gebäude anzeigen",
    periodProducts: "Menstruationsprodukte",
    periodProductsDestination: "Menstruationsprodukte:",
    periodProductsLocationsUnavailable: "Es sind keine Standorte für Menstruationsprodukte mit Koordinaten verfügbar.",
    qrTitle: "Scannen, um dieses Ziel auf dem Smartphone zu öffnen",
    rain: "Regen",
    femaleRestroom: "WC Damen",
    femaleRestroomDestination: "Damentoilette:",
    femaleRestroomLocationsUnavailable: "Es sind keine Damentoiletten mit Koordinaten verfügbar.",
    restroomDestination: "Toilette:",
    restroomLocationsUnavailable: "Es sind keine Toiletten mit Koordinaten verfügbar.",
    routeEnd: "Routenende",
    routeLoadError: "Route konnte nicht geladen werden.",
    routeStart: "Routenstart",
    roomsLoadError: "Raumdaten konnten nicht geladen werden.",
    room: "Raum",
    weatherLoadError: "Wetter konnte nicht geladen werden.",
    restroomMenu: "WC",
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

export function getInitialLanguage(): Language {
  const requestedLanguage = new URLSearchParams(window.location.search).get("lang");
  if (requestedLanguage === "de" || requestedLanguage === "en") {
    return requestedLanguage;
  }

  const browserLanguage = navigator.languages[0] ?? navigator.language;
  return browserLanguage.toLowerCase().startsWith("de") ? "de" : "en";
}

export function translate(
  language: Language,
  key: TranslationKey,
  values?: { name?: string },
): string {
  const message: string = translations[language][key];
  return values?.name ? message.replace("{name}", values.name) : message;
}

export function localizeDestination(
  destination: string,
  language: Language,
  buildings: Array<{ nameDe: string; nameEn: string }> = [],
): string {
  const localizedBuilding = (name: string): string => {
    const building = buildings.find(({ nameDe, nameEn }) =>
      name === nameDe || name === nameEn,
    );
    return building ? (language === "en" ? building.nameEn : building.nameDe) : name;
  };

  const building = buildings.find(({ nameDe, nameEn }) =>
    destination === nameDe || destination === nameEn,
  );
  if (building) return language === "en" ? building.nameEn : building.nameDe;

  const destinationPrefixes: Array<[string, TranslationKey]> = [
    ["Male restroom:", "maleRestroomDestination"],
    ["Female restroom:", "femaleRestroomDestination"],
    ["Restroom:", "restroomDestination"],
    ["Period products:", "periodProductsDestination"],
    ["Changing table:", "changingTableDestination"],
  ];

  for (const [prefix, key] of destinationPrefixes) {
    if (destination.startsWith(prefix)) {
      const details = destination.slice(prefix.length).trim();
      const roomSeparator = details.lastIndexOf(", room ");
      const buildingName = (roomSeparator < 0 ? details : details.slice(0, roomSeparator)).trim();
      const roomDetails = roomSeparator < 0
        ? ""
        : details.slice(roomSeparator).replace(", room ", `, ${translate(language, "room")} `);
      const localizedDetails = `${localizedBuilding(buildingName)}${roomDetails}`;
      return `${translate(language, key)} ${localizedDetails}`;
    }
  }

  return destination;
}
