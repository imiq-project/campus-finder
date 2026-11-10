import type { Language } from "../i18n.ts";
import { loadPois } from "./Poi.ts";

export default class Building {
    public readonly nameDe: string;
    public readonly nameEn: string;
    public readonly descriptionDe: string;
    public readonly descriptionEn: string;
    public readonly lat: number;
    public readonly lon: number;

    public constructor(
        name: string,
        nameEn: string,
        description: string,
        descriptionEn: string,
        lat: number,
        lon: number,
    ) {
        this.nameDe = name;
        this.nameEn = nameEn;
        this.descriptionDe = description;
        this.descriptionEn = descriptionEn;
        this.lat = lat;
        this.lon = lon;
    }

    public localizedName(language: Language): string {
        return language === "en" ? this.nameEn : this.nameDe;
    }

    public localizedDescription(language: Language): string {
        return language === "en" ? this.descriptionEn : this.descriptionDe;
    }
}

export async function loadBuildings(): Promise<Array<Building>> {
    const pois = await loadPois();
    return pois.map(({ name_de, name_en, description_de, description_en: description_en, lat, lon }) =>
        new Building(
            name_de,
            name_en || name_de,
            description_de,
            description_en || description_de,
            lat,
            lon,
        ));
}
