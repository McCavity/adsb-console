#!/usr/bin/env python3
"""Flugplatz- und Bahngeometrie aus OurAirports (gemeinfrei) einfrieren.

Laeuft auf dem Entwicklungsrechner, nicht auf dem Geraet: Das Ergebnis wird
committet, damit die Konsole zur Laufzeit keine Fremdquelle braucht.

Der Ausschnitt ist eine grobe Region (Rhein-Main), nicht die Umgebung der
Empfaengerposition -- die gehoert nicht ins Repo, auch nicht als Mittelpunkt
eines Suchfensters.
"""
import csv
import io
import json
import urllib.request
from datetime import date

BASE = "https://davidmegginson.github.io/ourairports-data/"
LAT_MIN, LAT_MAX = 49.2, 51.2
LON_MIN, LON_MAX = 7.6, 9.9
KEEP_TYPES = {"large_airport", "medium_airport", "small_airport"}


def fetch(name):
    with urllib.request.urlopen(BASE + name, timeout=60) as r:
        return list(csv.DictReader(io.StringIO(r.read().decode("utf-8"))))


def main():
    airports = {}
    for a in fetch("airports.csv"):
        try:
            lat, lon = float(a["latitude_deg"]), float(a["longitude_deg"])
        except (ValueError, KeyError):
            continue
        if not (LAT_MIN <= lat <= LAT_MAX and LON_MIN <= lon <= LON_MAX):
            continue
        if a["type"] not in KEEP_TYPES or not a["ident"].startswith("ED"):
            continue
        airports[a["id"]] = {"icao": a["ident"], "name": a["name"],
                             "lat": round(lat, 5), "lon": round(lon, 5),
                             "type": a["type"], "runways": []}
    for r in fetch("runways.csv"):
        ap = airports.get(r["airport_ref"])
        if ap is None or r.get("closed") == "1":
            continue
        try:
            rw = {"le_ident": r["le_ident"], "he_ident": r["he_ident"],
                  "le_lat": float(r["le_latitude_deg"]),
                  "le_lon": float(r["le_longitude_deg"]),
                  "he_lat": float(r["he_latitude_deg"]),
                  "he_lon": float(r["he_longitude_deg"]),
                  "length_ft": int(r["length_ft"] or 0)}
        except (ValueError, KeyError):
            continue        # Bahn ohne Schwellenkoordinaten -- unbrauchbar
        ap["runways"].append(rw)

    out = {"generated": date.today().isoformat(),
           "source": "OurAirports (public domain), davidmegginson.github.io/ourairports-data",
           "bbox": [LAT_MIN, LON_MIN, LAT_MAX, LON_MAX],
           "airports": sorted(airports.values(), key=lambda a: a["icao"])}
    with open("console/data/airports.json", "w") as f:
        json.dump(out, f, indent=1)
    print(f"{len(out['airports'])} Plaetze, "
          f"{sum(len(a['runways']) for a in out['airports'])} Bahnen geschrieben")


if __name__ == "__main__":
    main()
