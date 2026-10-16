export default class Building {
    public readonly name: string;
    public readonly lat: number;
    public readonly lon: number;

    public constructor(
        name: string,
        lat: number,
        lon: number,
    ) {
        this.name = name;
        this.lat = lat;
        this.lon = lon;
    }
}

export async function loadBuildings(): Promise<Array<Building>>{
    const response = await fetch(`${import.meta.env.BASE_URL}buildings.json`)
    if (!response.ok) {
        throw new Error(`Failed to load buildings: ${response.status} ${response.statusText}`)
    }
    const data = await response.json()
    return data
}
