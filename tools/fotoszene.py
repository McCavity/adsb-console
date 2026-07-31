#!/usr/bin/env python3
"""Fotosession: synthetische Quelle bauen und die Konsole abbilden.

Die Konsole braucht dafuer KEINE Zeile Code: data.js liest Ziel- und
Reichweitenquelle ueber quellUrl() aus URL-Parametern, und was nicht
umlenkbar ist (receiver.json, stats.json -- data.js:69,88 lesen den
absoluten Pfad /skyaware/data/), bekommt einen eigenen Unterbaum neben der
eingefrorenen Kopie des Docroots.

Warum synthetisch und nicht "nachts mal schauen": Nachts fliegt nichts, und
tagsueber steht zufaellig da, was da steht. Ein Notfall-Squawk, ein HEAVY,
ein volles Board und ein satter Reichweitenrekord lassen sich nicht
abwarten -- und in den produktiven Datenpfad schreibt man dafuer nicht.

Die Ziele werden aus Peilung und Entfernung GERECHNET, nicht als Koordinaten
hingeschrieben: nur so laesst sich die Anzeige hinterher gegen die Absicht
pruefen ("SYN7788 soll auf 27 NM / 250 Grad stehen").

Alle Kennungen sind erfunden (Praefix SYN, hex im Block f0....). Das ist
nicht nur Datenschutz, sondern Ehrlichkeit: Wer das Bild sieht, soll nicht
glauben, er saehe einen realen Flug.

Aufruf (auf dem Geraet):
    python3 fotoszene.py --basis /var/tmp/foto-<stempel> --seite radar
"""

import argparse
import json
import math
import os
import shutil
import socketserver
import subprocess
import sys
import threading
import time
import http.server

ERDRADIUS_NM = 3440.065

# Die Empfaengerposition steht NICHT in dieser Datei -- auch nicht gerundet
# (CLAUDE.md, "Nicht verhandelbar"). Sie kommt zur Laufzeit vom Geraet, wie
# beim Waechter tests/keine-empfaengerposition.sh. Laesst sie sich nicht
# holen, bricht das Skript ab: eine stillschweigend eingesetzte Vorgabe
# wuerde eine Szene erzeugen, die auf gar nichts bezogen ist.
def hole_position():
    import urllib.request
    with urllib.request.urlopen(
            'http://127.0.0.1/skyaware/data/receiver.json', timeout=5) as r:
        d = json.load(r)
    lat, lon = d['lat'], d['lon']
    if not (isinstance(lat, (int, float)) and isinstance(lon, (int, float))):
        raise ValueError('receiver.json ohne brauchbare Position')
    return lat, lon

# Fahrplan aus console.json: Radar 45 s, sonst 15 s, Umlauf 135 s. Der
# Aufnahmezeitpunkt liegt bewusst MITTEN in der Standzeit, nicht am Rand --
# am Rand entscheidet eine Zehntelsekunde, welche Seite im Bild ist.
SEITEN = {
    'radar':   22,   # [0,45)   -- und >6 s, damit das Nachgluehen eingeschwungen ist
    'target':  53,   # [45,60)
    'profile': 68,   # [60,75)
    'polar':   83,   # [75,90)
    'board':   98,   # [90,105)
    'stats':  113,   # [105,120)
    'system': 128,   # [120,135)
}

# (callsign, nm, peilung, hoehe_ft, gs_kt, kurs, steigrate, squawk, kategorie)
# Gestellt, nicht gewuerfelt: Ziele in allen vier Quadranten und in allen
# drei Ringen, damit weder das Radar noch die Tafel eine leere Haelfte hat.
#
# Die Peilungen und Entfernungen stammen aus plazierung.py und sind KEINE
# Wunschwerte: In der Londoner Demo-Region liegen 50 Flugplaetze im Bild, und
# eine Zielbeschriftung, die auf einer ICAO-Kennung sitzt, sieht aus wie ein
# Renderfehler. Die Suche haelt jede Beschriftung mindestens 8 px von jeder
# Flugplatzkennung und von jeder anderen Zielbeschriftung frei; erreicht
# wurden 10,0 px an der engsten Stelle:
#
#   ATC_RECEIVER_LAT=51.51 ATC_RECEIVER_LON=-0.10 \
#     python3 tools/plazierung.py tools/demo-airports-london.json 90 10
#
# Wer die Szene aendert, laesst sie neu laufen -- sie meldet ROT, wenn die
# Luft nicht reicht.
SZENE = [
    ('SYN9016', 23,  50,  2400, 150, 355,  -704, '1000', 'A2'),
    ('SYN1401', 35,  94,  7000, 240, 210, -1216, '1000', 'A3'),
    ('SYN5509', 19, 150,  8500, 265, 145, -1408, '1000', 'A3'),
    ('SYN3050', 26, 171,  3200, 175, 320,  -896, '1000', 'A2'),
    ('SYN2210', 41,  79, 12000, 310, 275,  1600, '1000', 'A3'),
    ('SYN0442', 32, 204, 27000, 452,  25,     0, '2451', 'A5'),   # HEAVY
    ('SYN3378', 37, 138, 18000, 380, 100,  2048, '1000', 'A3'),
    ('SYN7788', 23, 234,  4500, 190,  70, -1088, '7700', 'A3'),   # Notfall
    ('SYN1122', 13, 242, 35000, 480, 130,     0, '1000', 'A3'),
    ('SYN6631', 44, 235, 38000, 495, 175,     0, '3624', 'A3'),
    ('SYN7145', 45, 180, 24000, 420, 195, -1792, '1000', 'A3'),
    ('SYN8814', 40, 314, 33000, 470, 250,     0, '1000', 'A3'),
    ('SYN2907', 20, 335, 30000, 465, 300,  1216, '1000', 'A5'),   # HEAVY
    ('SYN4433', 43,  29, 36000, 488,  45,     0, '1000', 'A3'),
    ('SYN5560', 49,  54, 39000, 500,  20,     0, '1000', 'A3'),
    # Ausserhalb der eingestellten 50 NM. Steht absichtlich drin: Radar,
    # Tafel und Einzelziel MUESSEN es wegfiltern -- ein Filter, den kein
    # Datensatz je erreicht, ist ungeprueft.
    ('SYN6702', 62,  80, 41000, 505, 260,     0, '1000', 'A3'),
]


def zielpunkt(lat, lon, brg_deg, nm):
    """Grosskreis-Zielpunkt. Nicht flach gerechnet, damit die Konsole beim
    Zurueckrechnen (haversineNm) wieder auf dieselbe Zahl kommt."""
    d = nm / ERDRADIUS_NM
    b = math.radians(brg_deg)
    p1 = math.radians(lat)
    l1 = math.radians(lon)
    p2 = math.asin(math.sin(p1) * math.cos(d) + math.cos(p1) * math.sin(d) * math.cos(b))
    l2 = l1 + math.atan2(math.sin(b) * math.sin(d) * math.cos(p1),
                         math.cos(d) - math.sin(p1) * math.sin(p2))
    return round(math.degrees(p2), 6), round(math.degrees(l2), 6)


def schallgeschwindigkeit_kt(alt_ft):
    """Standardatmosphaere. Oberhalb der Tropopause (36 089 ft) konstant."""
    t = 216.65 if alt_ft >= 36089 else 288.15 - 1.98 * alt_ft / 1000
    return 661.5 * math.sqrt(t / 288.15)


def aircraft_json(LAT, LON):
    ziele = []
    for i, (rufz, nm, brg, alt, gs, kurs, rate, squawk, kat) in enumerate(SZENE):
        lat, lon = zielpunkt(LAT, LON, brg, nm)
        # Die Einzelziel-Seite hat sechs Gruppen mit zusammen 23 Feldern.
        # Eine Quelle, die nur die Haelfte davon fuehrt, zeigt ein Datenblatt
        # voller Gedankenstriche -- und ein README-Bild, das die Konsole
        # schlechter aussehen laesst, als sie im Betrieb ist. Also alle
        # Felder, und die abgeleiteten GERECHNET statt geschaetzt:
        #
        # IAS aus der Dichteabnahme, rund 1,32 % je 1000 ft. An zwei echten
        # Datensaetzen vom 31.07. geeicht: FL370/490,5 kt -> 251 gegen
        # gemessene 252, FL039/178,7 kt -> 170 gegen gemessene 171.
        #
        # TAS unter GS, weil sonst der Mach nicht stimmt: mit tas = gs kaeme
        # FL350 auf 0,833, die echten Reiseflieger liegen bei 0,776. Ein
        # Rueckenwindanteil von 7 % in der Hoehe bringt 0,774 -- eine Zahl,
        # die im Bild niemandem als falsch auffiele, waere trotzdem falsch.
        tas = round(gs * (0.93 if alt >= 20000 else 0.98))
        ias = round(tas * (1 - alt / 1000 * 0.0132))
        ziele.append({
            'hex': 'f0%04x' % (0x1000 + i * 7),
            'flight': rufz.ljust(8),
            'alt_baro': alt, 'alt_geom': alt + 325,
            'gs': float(gs), 'ias': ias, 'tas': tas,
            'mach': round(tas / schallgeschwindigkeit_kt(alt), 3),
            'track': float(kurs), 'baro_rate': rate, 'geom_rate': rate - 32,
            # Steuerkurs missweisend und mit Windversatz -- ausdruecklich
            # NICHT track plus Konstante allein, sonst waere die Differenz
            # eine reine Missweisung und die Seite zeigte eine Scheinpraezision.
            'mag_heading': round((kurs + 3 + (i % 5) * 2.2) % 360, 1),
            'roll': round((i % 7 - 3) * 0.6, 1),
            'track_rate': round((i % 5 - 2) * 0.04, 2),
            'nav_qnh': 1013.2, 'nav_altitude_mcp': round(alt / 1000) * 1000,
            'nic': 8, 'rc': 186, 'nac_p': 9, 'sil': 3, 'sil_type': 'perhour',
            'squawk': squawk, 'category': kat,
            'lat': lat, 'lon': lon,
            'seen': round(0.4 + i * 0.3, 1),
            'rssi': round(-14.0 - nm * 0.28, 1),
            'messages': 1400 - i * 63,
        })
    # Ein Ziel OHNE Position: die Tafel fuehrt dafuer eine eigene Zeile, und
    # ohne einen solchen Datensatz ist die Zeile im Bild nie zu sehen.
    ziele.append({'hex': 'f0beef', 'alt_baro': 5000, 'gs': 210.0,
                  'baro_rate': 0, 'squawk': '1000', 'seen': 8.2,
                  'rssi': -31.4, 'messages': 96})
    return {'now': 1785500000.0, 'messages': 57219043, 'aircraft': ziele}


def range_json(jetzt):
    """Reichweitenrekorde. Die Keule ist gestellt: gross nach Osten, wo das
    Gelaende offen ist, klein nach Westen -- ein gleichmaessiger Kranz sieht
    aus wie ein Diagrammfehler und nicht wie eine Messung."""
    records, hour_max = [], {}
    for s in range(36):
        winkel = math.radians(s * 10)
        # Grundform: Keule nach Osten (90 Grad), plus etwas Struktur.
        basis = 52 + 26 * math.sin(winkel) - 9 * math.cos(2 * winkel)
        nm = round(max(21.0, basis + 4 * math.sin(winkel * 3)), 2)
        records.append({
            'sector': s, 'max_nm': nm,
            'hex': 'f0%04x' % (0x2000 + s * 5),
            'callsign': 'SYN%04d' % (2000 + s * 13),
            'alt_ft': 34000 + (s % 5) * 1000,
            # Der juengste Rekord liegt 14 Minuten vor der Aufnahme: sonst
            # steht auf der Seite "vor 340 min" und das Bild sieht tot aus.
            'seen_at': time.strftime('%Y-%m-%dT%H:%M:%S+02:00',
                                     time.localtime(jetzt - 14 * 60 - s * 137)),
        })
        # Die letzte Stunde bleibt unter dem Rekord -- ausser in zwei
        # Sektoren, wo sie darueber ragt. Genau dafuer ist die zweite Spur da.
        hour_max[str(s)] = round(nm * (1.06 if s in (8, 9) else 0.62), 2)
    return {'written_at': jetzt, 'sectors': 36,
            'records': records, 'hour_max': hour_max}


def schreibe_szene(basis, aufnahme_s, LAT, LON):
    """aufnahme_s: Sekunden nach Seitenstart, zu denen das Bild entsteht.
    written_at wird darauf vorgezogen -- sonst zeigt die Systemseite
    'Daemon geschrieben vor N s' rot (gemessen am 31.07., 217 s)."""
    jetzt = time.time() + aufnahme_s
    sky = os.path.join(basis, 'skyaware', 'data')
    os.makedirs(sky, exist_ok=True)

    with open(os.path.join(sky, 'receiver.json'), 'w') as f:
        json.dump({'version': '11.0', 'refresh': 1000, 'history': 120,
                   'lat': LAT, 'lon': LON}, f)
    with open(os.path.join(sky, 'aircraft.json'), 'w') as f:
        json.dump(aircraft_json(LAT, LON), f, indent=1)
    with open(os.path.join(basis, 'data', 'range.json'), 'w') as f:
        json.dump(range_json(jetzt), f, indent=1)

    # system.json und stats.json behalten ihre ECHTEN Werte -- das sind
    # Messungen ueber diese Hardware, und eine erfundene CPU-Temperatur in
    # einem README-Bild waere eine Behauptung im Gewand eines Belegs.
    # Fortgeschrieben wird nur written_at.
    sysp = os.path.join(basis, 'data', 'system.json')
    d = json.load(open(sysp))
    d['written_at'] = jetzt - 5
    json.dump(d, open(sysp, 'w'))
    return jetzt


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def schiess(basis, seite, ziel_png, port, lat=None, lon=None):
    budget = SEITEN[seite] * 1000
    # Ohne --lat/--lon die echte Position des Geraets; mit ihnen ein frei
    # gewaehlter Demo-Standort. Fuer die Veroeffentlichungsbilder ist das
    # Zentrum von London gesetzt: Heathrow, Gatwick, Stansted, Luton und City
    # liegen dort gemeinsam im 50-NM-Kreis, und kein Bild legt mehr nahe, wo
    # der echte Empfaenger steht.
    LAT, LON = (lat, lon) if lat is not None else hole_position()
    schreibe_szene(basis, SEITEN[seite], LAT, LON)
    handler = lambda *a, **k: Handler(*a, directory=basis, **k)
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.ThreadingTCPServer(('127.0.0.1', port), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        r = subprocess.run(
            ['chromium', '--headless', '--disable-gpu', '--no-sandbox',
             '--hide-scrollbars', '--window-size=1280,720',
             '--force-device-scale-factor=1',
             '--user-data-dir=/var/tmp/foto-prof',
             f'--virtual-time-budget={budget}',
             f'--screenshot={ziel_png}',
             f'http://127.0.0.1:{port}/index.html'],
            capture_output=True, text=True, timeout=300)
    finally:
        srv.shutdown()
        srv.server_close()
    groesse = os.path.getsize(ziel_png) if os.path.exists(ziel_png) else 0
    print(json.dumps({'seite': seite, 'budget_ms': budget, 'bild': ziel_png,
                      'bytes': groesse, 'chromium_exit': r.returncode},
                     ensure_ascii=False))
    return 0 if groesse else 1


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--basis', required=True)
    p.add_argument('--seite', required=True, choices=sorted(SEITEN))
    p.add_argument('--ziel', default=None)
    p.add_argument('--lat', type=float, default=None,
                   help='Demo-Standort statt der Position des Geraets')
    p.add_argument('--lon', type=float, default=None)
    p.add_argument('--airports', default=None,
                   help='Flugplatzdatei, die in die Kopie gelegt wird')
    p.add_argument('--port', type=int, default=8110)
    a = p.parse_args()
    ziel = a.ziel or os.path.join(a.basis, f'bild-{a.seite}.png')
    if (a.lat is None) != (a.lon is None):
        print('--lat und --lon nur gemeinsam')
        return 2
    if a.airports:
        shutil.copyfile(a.airports, os.path.join(a.basis, 'data', 'airports.json'))
    return schiess(a.basis, a.seite, ziel, a.port, a.lat, a.lon)


if __name__ == '__main__':
    sys.exit(main())
