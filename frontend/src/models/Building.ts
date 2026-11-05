import type { Language } from "../i18n.ts";
import { loadPois } from "./Poi.ts";

export default class Building {
    public readonly name: string;
    public readonly nameEn: string;
    public readonly lat: number;
    public readonly lon: number;

    public constructor(
        name: string,
        nameEn: string,
        lat: number,
        lon: number,
    ) {
        this.name = name;
        this.nameEn = nameEn;
        this.lat = lat;
        this.lon = lon;
    }

    public localizedName(language: Language): string {
        return language === "en" ? this.nameEn : this.name;
    }
}

export async function loadBuildings(): Promise<Array<Building>> {
    const pois = await loadPois();
    return pois.map(({ name, name_en, lat, lon }) => new Building(name, name_en, lat, lon));
}
