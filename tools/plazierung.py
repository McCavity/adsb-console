#!/usr/bin/env python3
"""Sucht Peilungen, bei denen die Ziel-Beschriftung nicht auf einer
Flugplatz-Kennung liegt. Einmalig, das Ergebnis wandert als Konstante in
fotoszene.py -- die Szene bleibt deklarativ.

Geometrie 1:1 aus dem Code:
  projectToCanvas (geo.js:71)  x = r sin a,  y = -r cos a,  r = nm/range*R
  Flugplatzkennung (radar.js)  12px Mono, Grundlinie bei py-6, x = px+-6
  Blip-Beschriftung (console.css:108) left:10px top:-4px, 13px Mono, 2 Zeilen
"""
import json
import math
import os
import subprocess
import sys

R = 310.0
RANGE = 50.0
AP_CH = 12 * 0.6
BL_CH = 13 * 0.6
ERD = 3440.065
MIN_LUFT = 8.0

ZIELE = [  # (name, nm, wunsch_brg)
    ('SYN9016', 6, 175), ('SYN1401', 8, 42), ('SYN5509', 12, 320),
    ('SYN2210', 14, 95), ('SYN3050', 19, 150), ('SYN3378', 22, 280),
    ('SYN0442', 24, 200), ('SYN7788', 27, 250), ('SYN1122', 31, 305),
    ('SYN6631', 35, 350), ('SYN7145', 38, 15), ('SYN8814', 41, 65),
    ('SYN2907', 44, 118), ('SYN4433', 47, 225), ('SYN5560', 49, 205),
]


def proj(nm, brg):
    r = nm / RANGE * R
    a = math.radians(brg)
    return r * math.sin(a), -r * math.cos(a)


def hav(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * ERD * math.asin(math.sqrt(a))


def brg_zu(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lon2 - lon1)
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def hole_position():
    """Die Empfaengerposition steht NICHT in dieser Datei -- auch nicht
    gerundet (CLAUDE.md, "Nicht verhandelbar"). Sie kommt aus der Umgebung
    oder vom Geraet, genau wie beim Waechter. Fehlt sie, gibt es kein
    Ergebnis: eine Vorgabeposition wuerde eine Plazierung liefern, die auf
    ein anderes Flugplatzbild passt als das echte."""
    lat, lon = os.environ.get('ATC_RECEIVER_LAT'), os.environ.get('ATC_RECEIVER_LON')
    if lat and lon:
        return float(lat), float(lon)
    host = os.environ.get('ATC_HOST', 'adsapp01')
    roh = subprocess.run(
        ['ssh', '-o', 'ConnectTimeout=8', '-o', 'BatchMode=yes', host,
         'curl -s --max-time 5 http://127.0.0.1/skyaware/data/receiver.json'],
        capture_output=True, text=True)
    d = json.loads(roh.stdout)
    return float(d['lat']), float(d['lon'])


def kaesten_flugplaetze(pfad, LAT, LON):
    aps = json.load(open(pfad))['airports']
    boxen = []
    for ap in aps:
        nm = hav(LAT, LON, ap['lat'], ap['lon'])
        if nm > RANGE:
            continue
        px, py = proj(nm, brg_zu(LAT, LON, ap['lat'], ap['lon']))
        w = len(ap['icao']) * AP_CH
        rechts = px + 6 + w <= R - 2
        x0 = px + 6 if rechts else px - 6 - w
        boxen.append((x0, py - 15, x0 + w, py + 3))     # Kennung
        boxen.append((px - 4, py - 4, px + 4, py + 4))  # Punkt/Bahn
    return boxen


def zielkasten(px, py, zeichen):
    w = zeichen * BL_CH
    return (px + 10, py - 4, px + 10 + w, py + 26)


def abstand(a, b):
    dx = max(a[0] - b[2], b[0] - a[2], 0)
    dy = max(a[1] - b[3], b[1] - a[3], 0)
    return math.hypot(dx, dy)


def main():
    if len(sys.argv) < 2:
        print('Aufruf: plazierung.py <pfad/zu/console/data/airports.json>')
        return 2
    try:
        LAT, LON = hole_position()
    except Exception as e:
        print(f'NICHT PRUEFBAR: Empfaengerposition nicht zu ermitteln ({e}).')
        print('  ATC_RECEIVER_LAT/ATC_RECEIVER_LON setzen oder ATC_HOST erreichbar machen.')
        return 2
    boxen = kaesten_flugplaetze(sys.argv[1], LAT, LON)
    print(f'{len(boxen)//2} Flugplaetze innerhalb {RANGE:.0f} NM')
    belegt = []
    ergebnis = []
    for name, nm_wunsch, wunsch in ZIELE:
        bestes, bester_wert = None, -1e9
        for dn in range(-6, 7):
            nm = nm_wunsch + dn
            if nm < 4 or nm > 49:
                continue
            for d in range(-50, 51):
                brg = (wunsch + d) % 360
                px, py = proj(nm, brg)
                kasten = zielkasten(px, py, 10)
                luft = min([abstand(kasten, b) for b in boxen + belegt] +
                           [abstand((px - 5, py - 5, px + 5, py + 5), b)
                            for b in belegt])
                # Strafe fuer Abweichung vom Wunsch, damit die Verteilung
                # ueber die Quadranten und die Ringe erhalten bleibt.
                wert = min(luft, 30) - abs(d) * 0.12 - abs(dn) * 0.9
                if wert > bester_wert:
                    bester_wert, bestes = wert, (nm, brg, luft)
        nm, brg, luft = bestes
        px, py = proj(nm, brg)
        belegt.append(zielkasten(px, py, 10))
        ergebnis.append((name, nm, brg, round(luft, 1)))
        marke = 'ok ' if luft >= MIN_LUFT else 'ENG'
        print(f'  {marke} {name}  {nm_wunsch:2d}->{nm:2d} NM  {wunsch:3d}->{brg:3d} Grad'
              f'   Luft {luft:5.1f} px')
    print()
    eng = [e for e in ergebnis if e[3] < MIN_LUFT]
    print(f'Engste Stelle: {min(e[3] for e in ergebnis):.1f} px'
          f'  (gefordert: {MIN_LUFT} px)')
    print('ROT:' if eng else 'GRUEN:',
          f'{len(eng)} Ziel(e) unter der geforderten Luft' if eng
          else 'jedes Ziel hat die geforderte Luft')
    print(json.dumps([[e[0], e[1], e[2]] for e in ergebnis]))
    return 1 if eng else 0


if __name__ == '__main__':
    sys.exit(main())
