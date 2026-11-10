import csv
import json
import re
from dataclasses import dataclass, field
from typing import Tuple, List, Dict

Coords = Tuple[float, float]


@dataclass
class Room:
    name: str
    types: List[str]


@dataclass
class Building:
    id: str
    name_de: str
    description_de: str
    name_en: str
    description_en: str
    location: Coords
    hidden: bool
    rooms: List[Room] = field(default_factory=list)


buildings: Dict[str, Building] = {}


def extract_coords(gps: str) -> Coords:
    tokens = gps.split(",")
    assert len(tokens) == 2, tokens
    return float(tokens[0]), float(tokens[1])


with open("Gebäude.csv", "r", newline="", encoding="utf-8") as file:
    reader = csv.DictReader(file, delimiter=";")
    for row in reader:
        building = Building(
            id=row["Geb"],
            name_de=row["Kurzname-De"],
            description_de=row["Langname-De"],
            name_en=row["Kurzname-En"],
            description_en=row["Langname-En"],
            location=extract_coords(row["GPS"]),
            hidden=True if row["Verbergen"] else False,
        )
        buildings[building.id] = building


def fix_excel_format(cell: str) -> str:
    return (
        cell.replace(". Jan", ".1")
        .replace(". Feb", ".2")
        .replace(". Mrz", ".3")
        .replace(". Apr", ".4")
    )


def room_types(row: dict[str, str]) -> list[str]:
    label = row["Raumbezeichnung"].strip().casefold()
    details = " ".join(
        (row["Raumbezeichnung"], row["Nutzungsbezeichnung"], row["Bemerkungen"])
    ).casefold()
    types: list[str] = []

    is_accessible = "barrierefrei" in label
    is_toilet = bool(
        re.search(r"\bwc\b|\btoilett\w*|\bsanitärraum\b|\bsanitaerraum\b", label)
    ) and not label.startswith("vorraum")
    if is_toilet:
        if is_accessible:
            types.append("restroom-accessible")
        elif re.search(r"\b(herren|männer|maenner)\b", label):
            types.append("restroom-male")
        elif re.search(r"\b(damen|frauen)\b", label):
            types.append("restroom-female")
        elif re.search(r"\b(all-gender|unisex)\b", label):
            types.append("restroom-all-gender")
        else:
            types.append("restroom")

    if any(
        keyword in details
        for keyword in ("wickeltisch", "wickelmöglichkeit", "wickelmoeglichkeit")
    ):
        types.append("changing-table")
    if any(
        keyword in details
        for keyword in ("periodenartikel", "menstruationsprodukt", "periodenprodukt")
    ):
        types.append("menstrual-product")
    return types


with open("Raumatlas.csv", "r", newline="", encoding="utf-8") as file:
    reader = csv.DictReader(file, delimiter=";")
    for row in reader:
        building_id = row["Geb"]
        building_id = fix_excel_format(building_id)
        types = room_types(row)
        if types:
            room = Room(name=row["Raum"], types=types)
            buildings[building_id].rooms.append(room)

output = [
    {
        "name_de": building.name_de,
        "description_de": building.description_de,
        "name_en": building.name_en,
        "description_en": building.description_en,
        "lat": building.location[0],
        "lon": building.location[1],
        "rooms": [{"name": room.name, "types": room.types} for room in building.rooms],
    }
    for building in buildings.values()
    if not building.hidden
]

with open("frontend/public/pois.json", "w") as f:
    json.dump(output, f, indent=4)
