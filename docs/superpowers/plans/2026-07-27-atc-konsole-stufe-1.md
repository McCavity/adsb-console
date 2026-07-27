# ATC-Konsole — Implementierungsplan Stufe 0 und 1

> **Für agentische Bearbeiter:** ERFORDERLICHE SUB-SKILL: `superpowers:subagent-driven-development`
> (empfohlen) oder `superpowers:executing-plans`, um diesen Plan Aufgabe für Aufgabe
> umzusetzen. Die Schritte nutzen Checkbox-Syntax (`- [ ]`) zur Verfolgung.

**Ziel:** Eine laufende ATC-Konsole am 7"-Panel von `adsapp01` mit Radarschirm, Board
und Statistikseite, gespeist aus dem eigenen `dump1090-fa`, samt Schreiber-Daemon und
Kiosk-Autostart.

**Architektur:** Ein stdlib-Python-Daemon pollt `/run/dump1090-fa/aircraft.json`, führt
Reichweiten-Rekorde in SQLite und schreibt `system.json` und `range.json` atomar in
`/var/www/html/atc/data/`. Das Frontend ist reine Statik im selben Verzeichnis und wird
vom bereits laufenden lighttpd ausgeliefert — kein zweiter Webserver. Ein
Chromium-Kiosk unter labwc zeigt es auf dem Panel.

**Tech-Stack:** Python 3.13 (nur Standardbibliothek, SQLite), ES-Module im Browser ohne
Framework, `node --test` für die reinen Rechenfunktionen, systemd, labwc + seatd +
Chromium.

**Maßgeblicher Entwurf:** [`docs/specs/2026-07-27-atc-konsole-design.md`](../../specs/2026-07-27-atc-konsole-design.md).
Bei jedem Widerspruch gilt die Spec, nicht dieser Plan.

**Umfang dieses Plans:** Stufe 0 (Meß-Spike) und Stufe 1 (Daemon, Kiosk, Gerüst, Radar,
Board, Statistik). **Stufe 2** (Einzelziel, System-Seite, Höhenprofil) und **Stufe 3**
(Polar mit Rekordhaltern) bekommen einen eigenen Plan, sobald diese Stufe am Panel läuft
— der Meß-Spike kann die Radar-Umsetzung ändern, und darauf wartet man besser, als es zu
raten.

## Globale Randbedingungen

Diese gelten für **jede** Aufgabe, auch wo sie nicht wiederholt werden.

- **Die exakte Empfängerposition wird nie ins Repo geschrieben** — kein Testfixture, kein
  Beispiel, kein Kommentar. Tests verwenden erfundene Koordinaten. Sie steht auf dem
  Gerät und ist faktisch eine Wohnadresse. Gelesen wird sie zur Laufzeit aus den
  Argumenten `--lat`/`--lon` des laufenden `dump1090-fa`-Prozesses
  (`/proc/<pid>/cmdline`) — **nicht** aus `/etc/default/dump1090-fa`: dort heißen die
  Schlüssel `RECEIVER_LAT`/`RECEIVER_LON` und sind auf diesem Gerät leer.
- **Keine Fremdquelle zur Laufzeit.** Keine CDN-Schrift, keine externe Bibliothek, keine
  Kartenkacheln. Alles wird lokal ausgeliefert.
- **Nur Python-Standardbibliothek** im Daemon. Kein `pip install`, kein venv auf dem Gerät.
- **Kein Umbau am ADS-B-Stack.** `dump1090-fa`, `piaware`, `fr24feed` und die
  lighttpd-Konfiguration werden nicht angefaßt.
- **Jeder Test wird einmal absichtlich rot gesehen**, bevor ihm geglaubt wird.
- **Testbefehl immer mit Dateimuster:** `node --test tests/*.mjs`. Ein blankes
  `node --test` findet in diesem Repo **keine** Testdatei (Node sucht nach
  `test.mjs`/`test-*.mjs` bzw. einem Verzeichnis `test/`, nicht nach `tests/test_*.mjs`)
  und meldet trotzdem `fail 0` — ein grünes Instrument, das nichts mißt. `node --test tests/`
  scheitert unter Node 26 mit `Cannot find module`. Beides am 27.07. empirisch geprüft.
- SSH: `ssh adsapp01` meldet sich als Benutzer **`pi`** an (NOPASSWD-sudo). Einen
  Benutzer `hhalfpap` gibt es auf diesem Gerät **nicht**, auch wenn ältere Notizen das
  behaupten.
- Zielpfade auf dem Gerät: Frontend `/var/www/html/atc/`, Daten
  `/var/www/html/atc/data/`, Datenbank `/var/lib/atc-console/atc.db`.
- Anzeigesprache Deutsch, Fachbegriffe (Squawk, Track, FL, Heavy) englisch, Einheiten
  nautisch (NM, kt, FL).
- Arbeitsweise: Session-Branch `session/2026-07-27-atc-konsole`, häufige Commits, am Ende
  ein PR gegen `main`.

---

## Dateistruktur

| Datei | Verantwortung |
|---|---|
| `console/js/geo.js` | Reine Rechenfunktionen: Entfernung, Peilung, Formatierung, Sektor. Kein DOM, kein Zustand. |
| `console/js/config.js` | Config laden, mit Vorgabewerten mischen, kaputte Eingaben abfangen. |
| `console/js/console.js` | Karussell, Touch, Seitenregistrierung, Kopfzeile. |
| `console/js/data.js` | Abrufschleifen für `aircraft.json`, `stats.json`, `range.json`, `system.json`; Alterszustand. |
| `console/js/pages/radar.js` | Radarseite: Hintergrund-, Phosphor- und Overlay-Ebene. |
| `console/js/pages/board.js` | Zielliste. |
| `console/js/pages/stats.js` | Empfängerstatistik. |
| `console/index.html`, `console/css/console.css` | Dokument und Layout, 1280×720. |
| `console/data/airports.json` | Statische Flugplatz- und Bahngeometrie (aus OurAirports, gemeinfrei). |
| `daemon/atc_daemon.py` | Schreiber-Daemon: Polling, Rekorde, Ausgabedateien. |
| `daemon/schema.sql` | SQLite-Schema. |
| `config/console.json` | Seitenschalter, Standzeiten, Radar-Parameter. |
| `install-console.sh` | Kiosk- und Daemon-Installation auf dem Gerät. |
| `atc-daemon.service`, `atc-console.service` | systemd-Units. |
| `tests/test_geo.mjs`, `tests/test_daemon.py` | Tests der beiden Rechenschichten. |

---

## Aufgabe 1: Reine Rechenfunktionen (`geo.js`)

**Dateien:**
- Anlegen: `console/js/geo.js`
- Test: `tests/test_geo.mjs`

**Schnittstellen:**
- Verbraucht: nichts.
- Liefert: `haversineNm(lat1, lon1, lat2, lon2) -> Number` (NM);
  `bearingDeg(lat1, lon1, lat2, lon2) -> Number` (0…360);
  `formatBearing(deg) -> String` (`"072°"`, Norden `"360°"`, `null` → `"—"`);
  `flightLevel(altFt) -> String` (`"FL075"`, `null` → `"—"`);
  `formatCallsign(raw) -> String|null`;
  `sectorOf(deg, count = 36) -> Number` (0…count−1);
  `isEmergency(ac) -> Boolean`;
  `nmToPx(nm, rangeNm, radiusPx) -> Number`.

- [ ] **Schritt 1: Den scheiternden Test schreiben**

Kalibriert an Wahrheiten, die **unabhängig vom Code** feststehen: Ein Breitengrad ist
per Definition der Seemeile 60 NM; die vier Himmelsrichtungen haben exakte Peilungen.

```javascript
// tests/test_geo.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  haversineNm, bearingDeg, formatBearing, flightLevel,
  formatCallsign, sectorOf, isEmergency, nmToPx,
} from '../console/js/geo.js';

test('ein Breitengrad ist 60 NM', () => {
  // Die Seemeile ist als eine Bogenminute definiert -> 1 Grad = 60 NM.
  // Auf einer Kugel mit mittlerem Erdradius kommen 60,04 heraus.
  assert.ok(Math.abs(haversineNm(0, 0, 1, 0) - 60) < 0.1);
  assert.ok(Math.abs(haversineNm(49, 8, 50, 8) - 60) < 0.1);
});

test('eine Viertelumrundung am Aequator', () => {
  assert.ok(Math.abs(haversineNm(0, 0, 0, 90) - 5403.6) < 5);
});

test('gleiche Punkte haben Abstand null', () => {
  assert.equal(haversineNm(49.5, 8.5, 49.5, 8.5), 0);
});

test('die vier Himmelsrichtungen', () => {
  assert.ok(Math.abs(bearingDeg(0, 0, 1, 0) - 0) < 0.01);
  assert.ok(Math.abs(bearingDeg(0, 0, 0, 1) - 90) < 0.01);
  assert.ok(Math.abs(bearingDeg(0, 0, -1, 0) - 180) < 0.01);
  assert.ok(Math.abs(bearingDeg(0, 0, 0, -1) - 270) < 0.01);
});

test('Peilung liegt immer in 0..360', () => {
  for (const [la, lo] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const b = bearingDeg(0, 0, la, lo);
    assert.ok(b >= 0 && b < 360, `Peilung ausserhalb: ${b}`);
  }
});

test('Norden wird 360 geschrieben, nicht 000', () => {
  assert.equal(formatBearing(0), '360°');
  assert.equal(formatBearing(360), '360°');
  assert.equal(formatBearing(72), '072°');
  assert.equal(formatBearing(359.6), '360°');
  assert.equal(formatBearing(null), '—');
});

test('Flugflaeche', () => {
  assert.equal(flightLevel(7325), 'FL073');
  assert.equal(flightLevel(38975), 'FL390');
  assert.equal(flightLevel(0), 'FL000');
  assert.equal(flightLevel(null), '—');
  assert.equal(flightLevel('ground'), '—');   // dump1090 liefert das woertlich
});

test('Callsigns kommen mit Fuellzeichen', () => {
  assert.equal(formatCallsign('DLA7TT  '), 'DLA7TT');
  assert.equal(formatCallsign('   '), null);
  assert.equal(formatCallsign(undefined), null);
});

test('Sektoren zu je zehn Grad', () => {
  assert.equal(sectorOf(0), 0);
  assert.equal(sectorOf(9.99), 0);
  assert.equal(sectorOf(10), 1);
  assert.equal(sectorOf(359.9), 35);
  assert.equal(sectorOf(360), 0);
});

test('Notfall nur bei aussagekraeftigem Wert', () => {
  // Gemessen am Geraet: emergency ist bei voellig normalen Zielen vorhanden,
  // mit den Werten null oder "none". "Feld gesetzt" waere die falsche Bedingung.
  assert.equal(isEmergency({ squawk: '1000', emergency: 'none' }), false);
  assert.equal(isEmergency({ squawk: '1000', emergency: null }), false);
  assert.equal(isEmergency({ squawk: '1000' }), false);
  assert.equal(isEmergency({ squawk: '7700' }), true);
  assert.equal(isEmergency({ squawk: '7600' }), true);
  assert.equal(isEmergency({ squawk: '7500' }), true);
  assert.equal(isEmergency({ squawk: '1000', emergency: 'general' }), true);
});

test('Umrechnung NM auf Pixel', () => {
  assert.equal(nmToPx(0, 50, 310), 0);
  assert.equal(nmToPx(50, 50, 310), 310);
  assert.equal(nmToPx(25, 50, 310), 155);
});
```

- [ ] **Schritt 2: Test laufen lassen, Scheitern bestätigen**

Ausführen: `node --test tests/test_geo.mjs`
Erwartet: FAIL — `Cannot find module .../console/js/geo.js`.

- [ ] **Schritt 3: Minimale Implementierung schreiben**

```javascript
// console/js/geo.js
// Reine Rechenfunktionen. Kein DOM, kein Zustand, keine Uhr.
// Die einzige Schicht, in der ein Rechenfehler unbemerkt bliebe -- daher getestet.

const R_NM = 3440.065;          // mittlerer Erdradius in Seemeilen
const RAD = Math.PI / 180;

export function haversineNm(lat1, lon1, lat2, lon2) {
  const p1 = lat1 * RAD, p2 = lat2 * RAD;
  const dp = (lat2 - lat1) * RAD, dl = (lon2 - lon1) * RAD;
  const a = Math.sin(dp / 2) ** 2 +
            Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R_NM * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function bearingDeg(lat1, lon1, lat2, lon2) {
  const p1 = lat1 * RAD, p2 = lat2 * RAD, dl = (lon2 - lon1) * RAD;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

// Norden liest sich als "drei-sechs-null", nicht als "null-null-null" --
// dieselbe Konvention wie in der Seefahrt und im Sprechfunk.
export function formatBearing(deg) {
  if (deg == null || !Number.isFinite(deg)) return '—';
  let d = Math.round(deg) % 360;
  if (d === 0) d = 360;
  return String(d).padStart(3, '0') + '°';
}

export function flightLevel(altFt) {
  if (typeof altFt !== 'number' || !Number.isFinite(altFt)) return '—';
  return 'FL' + String(Math.round(altFt / 100)).padStart(3, '0');
}

// dump1090 fuellt das Callsign-Feld auf acht Zeichen mit Leerzeichen auf.
export function formatCallsign(raw) {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length ? t : null;
}

export function sectorOf(deg, count = 36) {
  const width = 360 / count;
  return Math.floor((((deg % 360) + 360) % 360) / width);
}

const EMERGENCY_SQUAWKS = new Set(['7500', '7600', '7700']);

// Achtung: emergency ist bei normalen Zielen vorhanden -- mit den Werten
// null oder "none". Nur ein Wert ausserhalb davon ist eine Aussage.
export function isEmergency(ac) {
  if (!ac) return false;
  if (EMERGENCY_SQUAWKS.has(ac.squawk)) return true;
  const e = ac.emergency;
  return typeof e === 'string' && e !== 'none';
}

export function nmToPx(nm, rangeNm, radiusPx) {
  return nm / rangeNm * radiusPx;
}
```

- [ ] **Schritt 4: Test laufen lassen, Bestehen bestätigen**

Ausführen: `node --test tests/test_geo.mjs`
Erwartet: PASS, 11 Tests.

- [ ] **Schritt 5: Den Test absichtlich rot machen und wieder reparieren**

Ein Test, der nie rot war, ist unkalibriert. In `haversineNm` `2 * R_NM` durch `R_NM`
ersetzen, `node --test tests/test_geo.mjs` laufen lassen und bestätigen, daß die
Breitengrad- **und** die Äquatorprüfung scheitern (nicht nur eine). Danach zurückändern
und erneut grün laufen lassen.

- [ ] **Schritt 6: Commit**

```bash
git add console/js/geo.js tests/test_geo.mjs
git commit -m "Reine Rechenfunktionen mit unabhaengig kalibrierten Tests"
```

---

## Aufgabe 2: Daemon-Kern — Position, Drosselung, Geometrie

**Dateien:**
- Anlegen: `daemon/atc_daemon.py`
- Test: `tests/test_daemon.py`

**Schnittstellen:**
- Verbraucht: nichts.
- Liefert: `parse_position_from_cmdline(argv: list[str]) -> tuple[float, float] | None`;
  `read_receiver_position(cmdlines=None) -> (float, float)`;
  `parse_throttled(value: int) -> dict` mit den Schlüsseln `now` und `ever`, je ein Dict
  aus `undervoltage`, `arm_freq_capped`, `throttled`, `soft_temp_limit`;
  `great_circle_nm(lat1, lon1, lat2, lon2) -> float`;
  `bearing_deg(lat1, lon1, lat2, lon2) -> float`;
  `sector_of(deg: float, count: int = 36) -> int`;
  `atomic_write_json(path: Path, obj) -> None`.

- [ ] **Schritt 1: Den scheiternden Test schreiben**

```python
# tests/test_daemon.py
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "daemon"))

import atc_daemon as d


class ThrottleParser(unittest.TestCase):
    def test_null_ist_alles_in_ordnung(self):
        r = d.parse_throttled(0x0)
        self.assertFalse(any(r["now"].values()))
        self.assertFalse(any(r["ever"].values()))

    def test_0xe0000_meldet_historie_und_nicht_gegenwart(self):
        # Belegt: Bits 0-3 = jetzt, Bits 16-19 = seit dem Boot einmal.
        # 0xe0000 setzt 17, 18, 19 -> jetzt wird NICHTS gedrosselt.
        r = d.parse_throttled(0xE0000)
        self.assertFalse(any(r["now"].values()), "0xe0000 darf keine Gegenwart melden")
        self.assertFalse(r["ever"]["undervoltage"])
        self.assertTrue(r["ever"]["arm_freq_capped"])
        self.assertTrue(r["ever"]["throttled"])
        self.assertTrue(r["ever"]["soft_temp_limit"])

    def test_gegenwaertige_unterspannung(self):
        r = d.parse_throttled(0x1)
        self.assertTrue(r["now"]["undervoltage"])
        self.assertFalse(r["ever"]["undervoltage"])


class Position(unittest.TestCase):
    # Alle Koordinaten hier sind erfunden -- die echte Position gehoert nicht
    # ins Repo. Gelesen wird zur Laufzeit die WIRKSAME Position des laufenden
    # dump1090-fa aus /proc/<pid>/cmdline, nicht eine Konfigdatei: auf dem
    # Zielgeraet sind RECEIVER_LAT/RECEIVER_LON in /etc/default/dump1090-fa
    # leer, und die Position kommt aus der piaware-Konfiguration.
    def test_zieht_lat_und_lon_aus_der_argumentliste(self):
        argv = ["/usr/bin/dump1090-fa", "--device-type", "rtlsdr",
                "--lat", "12.34567", "--lon", "-4.56789", "--max-range", "360"]
        self.assertEqual(d.parse_position_from_cmdline(argv), (12.34567, -4.56789))

    def test_nur_eine_haelfte_ist_keine_position(self):
        self.assertIsNone(d.parse_position_from_cmdline(
            ["/usr/bin/dump1090-fa", "--lat", "12.34567"]))

    def test_flag_am_ende_ohne_wert(self):
        # Wuerde ohne Laengenpruefung einen IndexError werfen.
        self.assertIsNone(d.parse_position_from_cmdline(
            ["/usr/bin/dump1090-fa", "--lon", "-4.5", "--lat"]))

    def test_unlesbarer_wert(self):
        self.assertIsNone(d.parse_position_from_cmdline(
            ["/usr/bin/dump1090-fa", "--lat", "sued", "--lon", "-4.5"]))

    def test_liest_aus_cmdline_puffern(self):
        cmdlines = [
            b"/usr/bin/python3\x00-m\x00http.server\x00",
            b"/usr/bin/dump1090-fa\x00--lat\x0012.34567\x00--lon\x00-4.56789\x00",
        ]
        self.assertEqual(d.read_receiver_position(cmdlines), (12.34567, -4.56789))

    def test_kein_dump1090_prozess_ist_ein_klarer_fehler(self):
        with self.assertRaises(RuntimeError):
            d.read_receiver_position([b"/usr/bin/python3\x00-m\x00http.server\x00"])

    def test_dump1090_ohne_position_ist_ein_klarer_fehler(self):
        with self.assertRaises(RuntimeError):
            d.read_receiver_position([b"/usr/bin/dump1090-fa\x00--max-range\x00360\x00"])

    def test_unlesbarer_eintrag_wird_uebersprungen(self):
        # Der einzige Pfad, der eine echte Race Condition abfaengt: ein
        # Prozess verschwindet zwischen glob und Lesen, oder sein Eintrag ist
        # nicht lesbar. Ohne diesen Test existiert die Schutzlogik nur als
        # Behauptung. (Als root wuerde der Test zu Recht scheitern -- dann
        # ist der unlesbare Eintrag naemlich lesbar.)
        with tempfile.TemporaryDirectory() as tmp:
            good = Path(tmp) / "1" / "cmdline"
            bad = Path(tmp) / "2" / "cmdline"
            for f in (good, bad):
                f.parent.mkdir()
            good.write_bytes(b"/usr/bin/dump1090-fa\x00--lat\x0012.34567\x00"
                             b"--lon\x00-4.56789\x00")
            bad.write_bytes(b"/usr/bin/dump1090-fa\x00--lat\x0099.9\x00--lon\x0099.9\x00")
            bad.chmod(0o000)
            try:
                pattern = str(Path(tmp) / "[0-9]*" / "cmdline")
                self.assertEqual(len(list(d._iter_proc_cmdlines(pattern))), 1)
                self.assertEqual(
                    d.read_receiver_position(d._iter_proc_cmdlines(pattern)),
                    (12.34567, -4.56789))
            finally:
                bad.chmod(0o600)        # sonst schlaegt das Aufraeumen fehl


class Geometrie(unittest.TestCase):
    def test_ein_breitengrad_sind_60_nm(self):
        self.assertAlmostEqual(d.great_circle_nm(0, 0, 1, 0), 60, delta=0.1)

    def test_himmelsrichtungen(self):
        self.assertAlmostEqual(d.bearing_deg(0, 0, 1, 0), 0, delta=0.01)
        self.assertAlmostEqual(d.bearing_deg(0, 0, 0, 1), 90, delta=0.01)
        self.assertAlmostEqual(d.bearing_deg(0, 0, -1, 0), 180, delta=0.01)
        self.assertAlmostEqual(d.bearing_deg(0, 0, 0, -1), 270, delta=0.01)

    def test_sektoren(self):
        self.assertEqual(d.sector_of(0), 0)
        self.assertEqual(d.sector_of(9.99), 0)
        self.assertEqual(d.sector_of(10), 1)
        self.assertEqual(d.sector_of(359.9), 35)


class AtomaresSchreiben(unittest.TestCase):
    def test_ersetzt_vollstaendig(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "out.json"
            d.atomic_write_json(p, {"a": 1})
            d.atomic_write_json(p, {"b": 2})
            self.assertEqual(json.loads(p.read_text()), {"b": 2})

    def test_hinterlaesst_keine_temp_dateien(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "out.json"
            d.atomic_write_json(p, {"a": 1})
            self.assertEqual([f.name for f in Path(tmp).iterdir()], ["out.json"])


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Schritt 2: Test laufen lassen, Scheitern bestätigen**

Ausführen: `python3 -m unittest discover -s tests -v`
Erwartet: FAIL — `ModuleNotFoundError: No module named 'atc_daemon'`.

- [ ] **Schritt 3: Minimale Implementierung schreiben**

```python
#!/usr/bin/env python3
"""ATC-Konsole: Schreiber-Daemon.

Liest die JSON-Ausgaben von dump1090-fa, fuehrt Reichweiten-Rekorde in SQLite
und schreibt system.json und range.json in den lighttpd-Docroot. Nur
Standardbibliothek -- auf dem Geraet gibt es kein venv und soll keines geben.
"""
from __future__ import annotations

import glob
import json
import math
import os
import tempfile
from pathlib import Path

R_NM = 3440.065          # mittlerer Erdradius in Seemeilen

# vcgencmd get_throttled packt zwei Aussagen in eine Zahl: die unteren Bits
# beschreiben den Zustand JETZT, die oberen, ob es seit dem Boot einmal
# vorgekommen ist. Wer sie zusammenwirft, meldet Drosselung, waehrend nichts
# gedrosselt wird.
_THROTTLE_BITS = {
    "undervoltage": 0,
    "arm_freq_capped": 1,
    "throttled": 2,
    "soft_temp_limit": 3,
}
_EVER_OFFSET = 16


def parse_throttled(value: int) -> dict:
    return {
        "now": {n: bool(value & (1 << b)) for n, b in _THROTTLE_BITS.items()},
        "ever": {n: bool(value & (1 << (b + _EVER_OFFSET)))
                 for n, b in _THROTTLE_BITS.items()},
    }


def parse_position_from_cmdline(argv: list[str]) -> tuple[float, float] | None:
    """--lat/--lon aus einer Argumentliste ziehen, oder None."""
    found = {}
    for i, a in enumerate(argv):
        if a in ("--lat", "--lon") and i + 1 < len(argv):
            try:
                found[a] = float(argv[i + 1])
            except ValueError:
                return None
    if "--lat" not in found or "--lon" not in found:
        return None
    return found["--lat"], found["--lon"]


PROC_CMDLINE_GLOB = "/proc/[0-9]*/cmdline"


def _iter_proc_cmdlines(pattern: str = PROC_CMDLINE_GLOB):
    """cmdline-Puffer aller Prozesse. Das Muster ist ein Parameter, damit der
    Ueberspring-Pfad unten testbar ist statt nur behauptet."""
    for path in glob.glob(pattern):
        try:
            yield Path(path).read_bytes()
        except OSError:
            continue        # Prozess zwischen glob und Lesen verschwunden,
                            # oder Eintrag nicht lesbar -- beides kein Grund
                            # aufzugeben, es gibt weitere Kandidaten


def read_receiver_position(cmdlines=None) -> tuple[float, float]:
    """Die WIRKSAME Position des laufenden dump1090-fa.

    Gelesen aus /proc/<pid>/cmdline statt aus einer Konfigdatei: Auf dem
    Zielgeraet sind RECEIVER_LAT/RECEIVER_LON in /etc/default/dump1090-fa
    leer, und dump1090 bezieht die Position aus der piaware-Konfiguration.
    Die Prozessargumente sind die einzige Quelle, die unabhaengig davon
    stimmt, welche Schicht den Wert geliefert hat -- und sie sind
    unprivilegiert lesbar (am Geraet als uid 1000 belegt).

    Die Position bleibt im Speicher. Sie wird nie in eine Ausgabedatei
    geschrieben und gehoert nicht ins Repo; das Frontend benutzt die
    gerundete Fassung aus receiver.json.
    """
    for raw in (cmdlines if cmdlines is not None else _iter_proc_cmdlines()):
        argv = [a.decode("utf-8", "replace") for a in raw.split(b"\0") if a]
        if not argv or "dump1090" not in argv[0]:
            continue
        pos = parse_position_from_cmdline(argv)
        if pos is not None:
            return pos
    raise RuntimeError(
        "kein laufender dump1090-Prozess mit --lat/--lon gefunden -- "
        "laeuft dump1090-fa, und ist eine Position konfiguriert?")


def great_circle_nm(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R_NM * math.asin(min(1.0, math.sqrt(a)))


def bearing_deg(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lon2 - lon1)
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def sector_of(deg: float, count: int = 36) -> int:
    return int((deg % 360 + 360) % 360 // (360 / count))


def atomic_write_json(path: Path, obj) -> None:
    """Schreiben und umbenennen. Ein halb geschriebenes JSON darf das
    Frontend nie sehen."""
    path = Path(path)
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=".tmp-")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(obj, f, separators=(",", ":"))
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise
```

- [ ] **Schritt 4: Test laufen lassen, Bestehen bestätigen**

Ausführen: `python3 -m unittest discover -s tests -v`
Erwartet: PASS, 16 Tests
(3 Drosselung, 8 Position, 3 Geometrie, 2 atomares Schreiben).

- [ ] **Schritt 5: Den Drosselungs-Test absichtlich rot machen**

`_EVER_OFFSET` von `16` auf `0` setzen, Tests laufen lassen, bestätigen daß
`test_0xe0000_meldet_historie_und_nicht_gegenwart` scheitert — genau der Fehler, der
auf dem Schwesterprojekt einmal einen Fehlalarm erzeugt hat. Zurückändern, grün laufen
lassen.

- [ ] **Schritt 6: Commit**

```bash
git add daemon/atc_daemon.py tests/test_daemon.py
git commit -m "Daemon-Kern: Position, Drosselungs-Bits, Geometrie, atomares Schreiben"
```

---

## Aufgabe 3: Rekordspeicher und Stundenfenster

**Dateien:**
- Anlegen: `daemon/schema.sql`
- Ändern: `daemon/atc_daemon.py` (anhängen)
- Ändern: `tests/test_daemon.py` (anhängen)

**Schnittstellen:**
- Verbraucht: `sector_of`, `great_circle_nm`, `bearing_deg` aus Aufgabe 2.
- Liefert: `class RangeStore(db_path)` mit `update(sector, nm, hex_, callsign, alt_ft, seen_at) -> bool`
  und `records() -> list[dict]`;
  `class HourWindow()` mit `add(ts, sector, nm)` und `maxima(now_ts) -> dict[int, float]`;
  `usable_positions(doc, lat0, lon0, max_nm=300.0) -> list[dict]` mit den Schlüsseln
  `hex`, `callsign`, `alt_ft`, `nm`, `bearing`, `sector`.

- [ ] **Schritt 1: Den scheiternden Test schreiben**

```python
# tests/test_daemon.py -- anhaengen
import time


class Rekorde(unittest.TestCase):
    def store(self, tmp):
        return d.RangeStore(Path(tmp) / "atc.db")

    def test_erster_eintrag_wird_rekord(self):
        with tempfile.TemporaryDirectory() as tmp:
            s = self.store(tmp)
            self.assertTrue(s.update(3, 42.0, "abc123", "TEST1", 30000, "2026-07-27T15:00:00+02:00"))
            r = {x["sector"]: x for x in s.records()}
            self.assertAlmostEqual(r[3]["max_nm"], 42.0)
            self.assertEqual(r[3]["callsign"], "TEST1")

    def test_kleinerer_wert_ersetzt_nicht(self):
        with tempfile.TemporaryDirectory() as tmp:
            s = self.store(tmp)
            s.update(3, 42.0, "abc123", "TEST1", 30000, "2026-07-27T15:00:00+02:00")
            self.assertFalse(s.update(3, 41.9, "def456", "TEST2", 30000, "2026-07-27T15:01:00+02:00"))
            r = {x["sector"]: x for x in s.records()}
            self.assertEqual(r[3]["callsign"], "TEST1")

    def test_gleichstand_ersetzt_nicht(self):
        # Bindende Randbedingung: bei Gleichstand bleibt der alte Rekord --
        # sonst wechselt der Rekordhalter bei jedem gleich weiten Ziel.
        with tempfile.TemporaryDirectory() as tmp:
            s = self.store(tmp)
            s.update(3, 42.0, "abc123", "TEST1", 30000, "2026-07-27T15:00:00+02:00")
            self.assertFalse(s.update(3, 42.0, "def456", "TEST2", 30000, "2026-07-27T15:01:00+02:00"))
            r = {x["sector"]: x for x in s.records()}
            self.assertEqual(r[3]["callsign"], "TEST1")

    def test_groesserer_wert_ersetzt(self):
        with tempfile.TemporaryDirectory() as tmp:
            s = self.store(tmp)
            s.update(3, 42.0, "abc123", "TEST1", 30000, "2026-07-27T15:00:00+02:00")
            self.assertTrue(s.update(3, 42.1, "def456", "TEST2", 31000, "2026-07-27T15:01:00+02:00"))
            r = {x["sector"]: x for x in s.records()}
            self.assertEqual(r[3]["callsign"], "TEST2")

    def test_rekorde_ueberleben_den_neustart(self):
        with tempfile.TemporaryDirectory() as tmp:
            s = self.store(tmp)
            s.update(7, 55.5, "abc123", "TEST1", 30000, "2026-07-27T15:00:00+02:00")
            del s
            s2 = self.store(tmp)            # frische Verbindung, gleiche Datei
            r = {x["sector"]: x for x in s2.records()}
            self.assertAlmostEqual(r[7]["max_nm"], 55.5)


class Stundenfenster(unittest.TestCase):
    def test_maximum_je_sektor(self):
        w = d.HourWindow()
        w.add(1000.0, 2, 10.0)
        w.add(1001.0, 2, 30.0)
        w.add(1002.0, 5, 20.0)
        m = w.maxima(1003.0)
        self.assertAlmostEqual(m[2], 30.0)
        self.assertAlmostEqual(m[5], 20.0)

    def test_alte_werte_fallen_heraus(self):
        w = d.HourWindow()
        w.add(1000.0, 2, 90.0)
        w.add(4000.0, 2, 10.0)          # 3000 s spaeter
        m = w.maxima(4700.0)            # 3700 s nach dem ersten Wert
        self.assertAlmostEqual(m[2], 10.0, msg="der 90-NM-Wert ist aelter als eine Stunde")

    def test_leeres_fenster(self):
        self.assertEqual(d.HourWindow().maxima(1000.0), {})

    def test_waechst_nicht_unbegrenzt_ohne_maxima_aufruf(self):
        # Aufgeraeumt wird nach Zeit in maxima(). Bleibt dieser Aufruf aus,
        # muss eine Notbremse greifen -- sonst frisst ein Fehlerpfad in der
        # Hauptschleife den Speicher eines 1843-MB-Geraets auf.
        w = d.HourWindow(max_items=10)
        for i in range(50):
            w.add(1000.0 + i, 0, float(i))
        self.assertEqual(len(w._items), 10)
        # Die juengsten Werte ueberleben, nicht die aeltesten.
        self.assertAlmostEqual(w.maxima(1050.0)[0], 49.0)


class Zielfilter(unittest.TestCase):
    # Erfundene Empfaengerposition.
    LAT0, LON0 = 12.0, 34.0

    def doc(self, aircraft):
        return {"now": 1785156795.6, "aircraft": aircraft}

    def test_ziel_ohne_position_faellt_weg(self):
        out = d.usable_positions(self.doc([{"hex": "a", "flight": "X  "}]), self.LAT0, self.LON0)
        self.assertEqual(out, [])

    def test_mlat_ziel_faellt_weg(self):
        # mlat ist fremde Multilateration, nicht der eigene Empfang.
        ac = {"hex": "a", "lat": 12.1, "lon": 34.0, "mlat": ["lat", "lon"]}
        self.assertEqual(d.usable_positions(self.doc([ac]), self.LAT0, self.LON0), [])

    def test_leeres_mlat_faellt_nicht_weg(self):
        ac = {"hex": "a", "lat": 12.1, "lon": 34.0, "mlat": []}
        self.assertEqual(len(d.usable_positions(self.doc([ac]), self.LAT0, self.LON0)), 1)

    def test_unplausible_entfernung_faellt_weg(self):
        ac = {"hex": "a", "lat": 60.0, "lon": 34.0, "mlat": []}   # weit ueber 300 NM
        self.assertEqual(d.usable_positions(self.doc([ac]), self.LAT0, self.LON0), [])

    def test_felder_werden_berechnet(self):
        ac = {"hex": "abc123", "flight": "TEST1   ", "alt_baro": 30000,
              "lat": 13.0, "lon": 34.0, "mlat": []}
        out = d.usable_positions(self.doc([ac]), self.LAT0, self.LON0)[0]
        self.assertEqual(out["hex"], "abc123")
        self.assertEqual(out["callsign"], "TEST1")
        self.assertEqual(out["alt_ft"], 30000)
        self.assertAlmostEqual(out["nm"], 60.0, delta=0.1)     # ein Breitengrad nordwaerts
        self.assertAlmostEqual(out["bearing"], 0.0, delta=0.1)
        self.assertEqual(out["sector"], 0)

    def test_alt_baro_ground_ist_keine_hoehe(self):
        ac = {"hex": "a", "lat": 12.1, "lon": 34.0, "alt_baro": "ground", "mlat": []}
        self.assertIsNone(d.usable_positions(self.doc([ac]), self.LAT0, self.LON0)[0]["alt_ft"])
```

- [ ] **Schritt 2: Test laufen lassen, Scheitern bestätigen**

Ausführen: `python3 -m unittest discover -s tests -v`
Erwartet: FAIL — `AttributeError: module 'atc_daemon' has no attribute 'RangeStore'`.

- [ ] **Schritt 3: Schema und Implementierung schreiben**

```sql
-- daemon/schema.sql
CREATE TABLE IF NOT EXISTS range_record (
  sector    INTEGER PRIMARY KEY,   -- 0..35, je zehn Grad, 0 = 000..009
  max_nm    REAL    NOT NULL,
  hex       TEXT,
  callsign  TEXT,
  alt_ft    INTEGER,
  seen_at   TEXT    NOT NULL       -- ISO 8601 mit Offset
);
```

```python
# daemon/atc_daemon.py -- anhaengen
import sqlite3
from collections import deque

SECTORS = 36
HOUR_S = 3600.0
MAX_PLAUSIBLE_NM = 300.0     # weit ueber dem gemessenen Maximum (69 NM),
                             # aber unterhalb offensichtlichen Unsinns
MAX_WINDOW_ITEMS = 200_000   # Notbremse gegen unbegrenztes Wachstum, s. HourWindow


class RangeStore:
    """Reichweiten-Rekorde je Sektor. Eine Zeile je Sektor, nie mehr."""

    def __init__(self, db_path):
        self.path = Path(db_path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(self.path))
        self.conn.row_factory = sqlite3.Row
        schema = Path(__file__).with_name("schema.sql").read_text()
        self.conn.executescript(schema)
        self.conn.commit()

    def update(self, sector, nm, hex_, callsign, alt_ft, seen_at) -> bool:
        cur = self.conn.execute(
            "SELECT max_nm FROM range_record WHERE sector = ?", (sector,))
        row = cur.fetchone()
        if row is not None and row["max_nm"] >= nm:
            return False
        self.conn.execute(
            "INSERT INTO range_record (sector, max_nm, hex, callsign, alt_ft, seen_at) "
            "VALUES (?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(sector) DO UPDATE SET "
            "  max_nm = excluded.max_nm, hex = excluded.hex, "
            "  callsign = excluded.callsign, alt_ft = excluded.alt_ft, "
            "  seen_at = excluded.seen_at",
            (sector, nm, hex_, callsign, alt_ft, seen_at))
        self.conn.commit()
        return True

    def records(self) -> list[dict]:
        return [dict(r) for r in
                self.conn.execute("SELECT * FROM range_record ORDER BY sector")]


class HourWindow:
    """Maximum je Sektor ueber die letzte Stunde, im Speicher.

    Der Daemon sieht die Ziele ohnehin im Sekundentakt; das Frontend soll
    dafuer nicht 120 History-Dateien je Seitenladen holen.
    """

    def __init__(self, max_items: int = MAX_WINDOW_ITEMS):
        # maxlen ist eine Notbremse, keine Fachlogik: Aufgeraeumt wird nach
        # Zeit in maxima(). Ruft die Hauptschleife maxima() aber laenger nicht
        # auf -- Fehlerpfad, haengende Schleife --, waechst die Struktur sonst
        # unbegrenzt weiter, und zwar auf einem Geraet mit 1843 MB RAM.
        # 200.000 Eintraege sind rund anderthalb Stunden bei 36 Zielen je
        # Sekunde (das Maximum der Messung), also weit jenseits des Normalen.
        self._items = deque(maxlen=max_items)   # (ts, sector, nm)

    def add(self, ts: float, sector: int, nm: float) -> None:
        self._items.append((ts, sector, nm))

    def maxima(self, now_ts: float) -> dict:
        cutoff = now_ts - HOUR_S
        while self._items and self._items[0][0] < cutoff:
            self._items.popleft()
        out: dict[int, float] = {}
        for _, sector, nm in self._items:
            if nm > out.get(sector, -1.0):
                out[sector] = nm
        return out


def usable_positions(doc, lat0, lon0, max_nm=MAX_PLAUSIBLE_NM) -> list[dict]:
    """Ziele mit eigener, plausibler Position -- angereichert um Entfernung,
    Peilung und Sektor.

    Ausgeschlossen: Ziele ohne Position, per Multilateration bestimmte Ziele
    (fremde Rechnung, nicht der eigene Empfang) und unplausible Entfernungen.
    """
    out = []
    for ac in doc.get("aircraft", []):
        lat, lon = ac.get("lat"), ac.get("lon")
        if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)):
            continue
        if ac.get("mlat"):          # nicht-leere Liste = per MLAT bestimmt
            continue
        nm = great_circle_nm(lat0, lon0, lat, lon)
        if nm > max_nm:
            continue
        brg = bearing_deg(lat0, lon0, lat, lon)
        flight = ac.get("flight")
        alt = ac.get("alt_baro")
        out.append({
            "hex": ac.get("hex"),
            # dump1090 schreibt "ground" woertlich in alt_baro -- das ist
            # keine Hoehe und darf nicht als Zahl weitergereicht werden.
            "alt_ft": alt if isinstance(alt, (int, float)) else None,
            "callsign": flight.strip() if isinstance(flight, str) and flight.strip() else None,
            "nm": nm,
            "bearing": brg,
            "sector": sector_of(brg, SECTORS),
        })
    return out
```

- [ ] **Schritt 4: Test laufen lassen, Bestehen bestätigen**

Ausführen: `python3 -m unittest discover -s tests -v`
Erwartet: PASS, 31 Tests.

- [ ] **Schritt 5: Den Fensterschnitt absichtlich rot machen**

In `HourWindow.maxima` `cutoff = now_ts - HOUR_S` durch `cutoff = 0` ersetzen, Tests
laufen lassen, bestätigen daß `test_alte_werte_fallen_heraus` scheitert. Zurückändern.

- [ ] **Schritt 6: Commit**

```bash
git add daemon/schema.sql daemon/atc_daemon.py tests/test_daemon.py
git commit -m "Rekordspeicher, Stundenfenster und Zielfilter"
```

---

## Aufgabe 4: Hauptschleife, Ausgabedateien und Daemon-Unit

**Dateien:**
- Ändern: `daemon/atc_daemon.py` (anhängen)
- Anlegen: `atc-daemon.service`
- Test: `tests/test_daemon.py` (anhängen)

**Schnittstellen:**
- Verbraucht: alles aus den Aufgaben 2 und 3.
- Liefert: `build_system_json(throttled_raw, vcgen_available) -> dict`;
  `seed_hour_window(window, run_dir, lat0, lon0) -> int` (Anzahl gelesener Dateien);
  `main(argv) -> int`. Die Ausgabedateien `system.json` und `range.json` in dem per
  `--out-dir` übergebenen Verzeichnis.

- [ ] **Schritt 1: Den scheiternden Test schreiben**

```python
# tests/test_daemon.py -- anhaengen


class SystemJson(unittest.TestCase):
    def test_pflichtschluessel_vorhanden(self):
        s = d.build_system_json(0x0, vcgen_available=True)
        for key in ("cpu_temp_c", "load", "cpu_count", "mem_total_mb", "mem_used_mb",
                    "disk_total_gb", "disk_used_gb", "uptime_s", "throttle", "services"):
            self.assertIn(key, s)
        self.assertIn("now", s["throttle"])
        self.assertIn("ever", s["throttle"])

    def test_ohne_vcgencmd_bleiben_die_felder_null_statt_zu_scheitern(self):
        s = d.build_system_json(None, vcgen_available=False)
        self.assertIsNone(s["throttle"])
        self.assertIsNone(s["core_clock_hz"])
        # Der Rest muss trotzdem befuellt sein -- die Datei wird nie als
        # Ganzes ungueltig, weil ein Teil fehlt.
        self.assertIsInstance(s["load"], list)
        self.assertIsInstance(s["mem_total_mb"], int)


class StundenfensterVorbelegung(unittest.TestCase):
    def test_liest_history_dateien(self):
        with tempfile.TemporaryDirectory() as tmp:
            run = Path(tmp)
            for i in range(3):
                (run / f"history_{i}.json").write_text(json.dumps({
                    "now": 1000.0 + i,
                    "aircraft": [{"hex": "a", "lat": 13.0, "lon": 34.0, "mlat": []}],
                }))
            w = d.HourWindow()
            n = d.seed_hour_window(w, run, 12.0, 34.0)
            self.assertEqual(n, 3)
            self.assertIn(0, w.maxima(1002.0))

    def test_fuegt_chronologisch_ein_nicht_nach_dateinamen(self):
        # history_10 sortiert lexikographisch VOR history_2, ist hier aber
        # juenger. Wer nach Dateinamen einfuegt, verletzt die aufsteigende
        # Ordnung, auf die HourWindow beim Aufraeumen baut.
        with tempfile.TemporaryDirectory() as tmp:
            run = Path(tmp)
            for name, ts in (("history_2.json", 1000.0), ("history_10.json", 2000.0)):
                (run / name).write_text(json.dumps({
                    "now": ts,
                    "aircraft": [{"hex": "a", "lat": 13.0, "lon": 34.0, "mlat": []}],
                }))
            w = d.HourWindow()
            d.seed_hour_window(w, run, 12.0, 34.0)
            self.assertEqual([ts for ts, _, _ in w._items], [1000.0, 2000.0])

    def test_kaputte_history_datei_wird_uebersprungen(self):
        with tempfile.TemporaryDirectory() as tmp:
            run = Path(tmp)
            (run / "history_0.json").write_text("{kaputt")
            (run / "history_1.json").write_text(json.dumps({
                "now": 1000.0,
                "aircraft": [{"hex": "a", "lat": 13.0, "lon": 34.0, "mlat": []}],
            }))
            w = d.HourWindow()
            self.assertEqual(d.seed_hour_window(w, run, 12.0, 34.0), 1)
```

- [ ] **Schritt 2: Test laufen lassen, Scheitern bestätigen**

Ausführen: `python3 -m unittest discover -s tests -v`
Erwartet: FAIL — `AttributeError: module 'atc_daemon' has no attribute 'build_system_json'`.

- [ ] **Schritt 3: Implementierung schreiben**

```python
# daemon/atc_daemon.py -- anhaengen
import argparse
import shutil
import signal
import subprocess
import time
from datetime import datetime

SERVICES = ("dump1090-fa", "piaware", "fr24feed", "telegraf", "lighttpd")
RUN_DIR = Path("/run/dump1090-fa")
POLL_S = 1.0
SYSTEM_EVERY_S = 10.0
RANGE_EVERY_S = 60.0
_VCGEN_CACHE = {"at": 0.0, "data": {}}


def _vcgencmd(*args) -> str | None:
    try:
        r = subprocess.run(["vcgencmd", *args], capture_output=True,
                           text=True, timeout=5)
        return r.stdout.strip() if r.returncode == 0 else None
    except (OSError, subprocess.SubprocessError):
        return None


def build_system_json(throttled_raw, vcgen_available: bool,
                      clock_hz=None, volts=None) -> dict:
    load1, load5, load15 = os.getloadavg()
    mem = {}
    for line in Path("/proc/meminfo").read_text().splitlines():
        k, _, v = line.partition(":")
        mem[k] = int(v.split()[0])          # kB
    total_mb = mem["MemTotal"] // 1024
    avail_mb = mem.get("MemAvailable", mem["MemFree"]) // 1024
    st = os.statvfs("/")
    disk_total = st.f_blocks * st.f_frsize / 1e9
    disk_free = st.f_bavail * st.f_frsize / 1e9
    temp = None
    try:
        temp = int(Path("/sys/class/thermal/thermal_zone0/temp").read_text()) / 1000
    except (OSError, ValueError):
        pass
    services = {}
    for name in SERVICES:
        r = subprocess.run(["systemctl", "is-active", name],
                           capture_output=True, text=True)
        services[name] = r.stdout.strip() or "unknown"
    return {
        "cpu_temp_c": temp,
        "load": [load1, load5, load15],
        "cpu_count": os.cpu_count(),
        "mem_total_mb": total_mb,
        "mem_used_mb": total_mb - avail_mb,
        "disk_total_gb": round(disk_total, 1),
        "disk_used_gb": round(disk_total - disk_free, 1),
        "uptime_s": int(float(Path("/proc/uptime").read_text().split()[0])),
        "core_clock_hz": clock_hz if vcgen_available else None,
        "core_volts": volts if vcgen_available else None,
        "throttle": parse_throttled(throttled_raw) if vcgen_available and throttled_raw is not None else None,
        "services": services,
        "written_at": time.time(),
    }


def read_vcgencmd_cached(now: float) -> dict:
    """vcgencmd kostet einen Unterprozess -- fuenf Sekunden Cache genuegen."""
    if now - _VCGEN_CACHE["at"] < 5.0:
        return _VCGEN_CACHE["data"]
    data = {"available": shutil.which("vcgencmd") is not None,
            "throttled": None, "clock_hz": None, "volts": None}
    if data["available"]:
        t = _vcgencmd("get_throttled")           # "throttled=0x0"
        if t and "=" in t:
            try:
                data["throttled"] = int(t.split("=")[1], 16)
            except ValueError:
                data["available"] = False
        c = _vcgencmd("measure_clock", "arm")    # "frequency(48)=1800457088"
        if c and "=" in c:
            data["clock_hz"] = int(c.split("=")[1])
        v = _vcgencmd("measure_volts", "core")   # "volt=0.9000V"
        if v and "=" in v:
            data["volts"] = float(v.split("=")[1].rstrip("V"))
    _VCGEN_CACHE.update(at=now, data=data)
    return data


def seed_hour_window(window: HourWindow, run_dir: Path, lat0, lon0) -> int:
    """Das Stundenfenster einmalig aus den History-Dateien vorbelegen.

    Nur beim Start. Danach fuellt die Hauptschleife es fort. Eine kaputte
    Datei wird uebersprungen, nicht zum Abbruch erklaert.
    """
    # Erst alle Dateien einlesen, dann NACH ZEITSTEMPEL sortiert einfuegen.
    # Nach Dateinamen zu sortieren waere falsch: history_0, history_1,
    # history_10, history_100 ... ist lexikographisch, nicht chronologisch.
    # HourWindow raeumt von links auf und setzt aufsteigende Zeitstempel
    # voraus -- unsortiert eingefuegt blieben alte Eintraege liegen.
    snapshots = []
    for path in Path(run_dir).glob("history_*.json"):
        try:
            doc = json.loads(path.read_text())
        except (OSError, ValueError):
            continue
        ts = doc.get("now")
        if not isinstance(ts, (int, float)):
            continue
        snapshots.append((ts, doc))
    snapshots.sort(key=lambda pair: pair[0])
    for ts, doc in snapshots:
        for t in usable_positions(doc, lat0, lon0):
            window.add(ts, t["sector"], t["nm"])
    return len(snapshots)


def build_range_json(store: RangeStore, window: HourWindow, now: float) -> dict:
    hour = window.maxima(now)
    return {
        "written_at": now,
        "sectors": SECTORS,
        "records": store.records(),
        "hour_max": {str(k): round(v, 2) for k, v in sorted(hour.items())},
    }


_running = True


def _stop(signum, frame):
    global _running
    _running = False


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="ATC-Konsole: Schreiber-Daemon")
    ap.add_argument("--out-dir", default="/var/www/html/atc/data")
    ap.add_argument("--db", default="/var/lib/atc-console/atc.db")
    ap.add_argument("--run-dir", default=str(RUN_DIR))
    args = ap.parse_args(argv)

    # Signale ueber eine Variable leiten, damit die Schleife sauber austritt
    # und keine halb geschriebene Datei zuruecklaesst.
    signal.signal(signal.SIGTERM, _stop)
    signal.signal(signal.SIGINT, _stop)

    # Die wirksame Position des laufenden dump1090-fa (siehe Aufgabe 2).
    # Kein Konfigpfad als Argument: die Konfigdatei ist auf dem Zielgeraet
    # an dieser Stelle leer, und ein Argument, das zur falschen Quelle
    # zeigen kann, ist schlimmer als keines.
    lat0, lon0 = read_receiver_position()
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    run_dir = Path(args.run_dir)
    store = RangeStore(args.db)
    window = HourWindow()
    seeded = seed_hour_window(window, run_dir, lat0, lon0)
    print(f"Stundenfenster aus {seeded} History-Dateien vorbelegt", flush=True)

    last_system = 0.0
    last_range = 0.0
    while _running:
        now = time.time()
        try:
            doc = json.loads((run_dir / "aircraft.json").read_text())
        except (OSError, ValueError):
            doc = None
        if doc:
            stamp = datetime.now().astimezone().isoformat(timespec="seconds")
            for t in usable_positions(doc, lat0, lon0):
                window.add(now, t["sector"], t["nm"])
                store.update(t["sector"], t["nm"], t["hex"],
                             t["callsign"], t["alt_ft"], stamp)
        if now - last_system >= SYSTEM_EVERY_S:
            v = read_vcgencmd_cached(now)
            atomic_write_json(out_dir / "system.json",
                              build_system_json(v["throttled"], v["available"],
                                                v["clock_hz"], v["volts"]))
            last_system = now
        if now - last_range >= RANGE_EVERY_S:
            atomic_write_json(out_dir / "range.json",
                              build_range_json(store, window, now))
            last_range = now
        time.sleep(POLL_S)
    print("beendet", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Schritt 4: Test laufen lassen, Bestehen bestätigen**

Ausführen: `python3 -m unittest discover -s tests -v`
Erwartet: PASS, 36 Tests.

- [ ] **Schritt 5: Die Unit schreiben**

```ini
# atc-daemon.service
[Unit]
Description=ATC-Konsole: Schreiber-Daemon (Reichweiten-Rekorde und Systemzustand)
After=dump1090-fa.service
Wants=dump1090-fa.service

[Service]
Type=simple
User=atc
Group=atc
# atc ist ein Systemaccount ohne Login. StateDirectory legt
# /var/lib/atc-console mit den richtigen Rechten an, bevor ExecStart laeuft.
StateDirectory=atc-console
StateDirectoryMode=0750
ExecStart=/usr/local/lib/atc-console/atc_daemon.py \
  --out-dir /var/www/html/atc/data \
  --db /var/lib/atc-console/atc.db
Restart=always
RestartSec=5
# Der Daemon liest nur und schreibt in genau zwei Verzeichnisse.
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
ReadWritePaths=/var/www/html/atc/data /var/lib/atc-console
NoNewPrivileges=yes

[Install]
WantedBy=multi-user.target
```

- [ ] **Schritt 6: Auf dem Gerät in Betrieb nehmen und den Rückweg prüfen**

```bash
ssh adsapp01 'sudo useradd --system --no-create-home --shell /usr/sbin/nologin atc || true
sudo install -d -o atc -g atc -m 0755 /var/www/html/atc /var/www/html/atc/data
sudo install -d -m 0755 /usr/local/lib/atc-console'
scp daemon/atc_daemon.py daemon/schema.sql adsapp01:/tmp/
ssh adsapp01 'sudo install -m 0755 /tmp/atc_daemon.py /usr/local/lib/atc-console/
sudo install -m 0644 /tmp/schema.sql /usr/local/lib/atc-console/'
scp atc-daemon.service adsapp01:/tmp/
ssh adsapp01 'sudo install -m 0644 /tmp/atc-daemon.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now atc-daemon.service
sleep 70 && systemctl is-active atc-daemon.service'
```

Erwartet: `active`.

Dann die Ausgabe selbst ziehen, nicht der Erfolgsmeldung glauben:

```bash
ssh adsapp01 'curl -sf http://127.0.0.1/atc/data/system.json | head -c 300; echo;
curl -sf http://127.0.0.1/atc/data/range.json | python3 -c "
import json,sys; d=json.load(sys.stdin)
print(\"Rekorde:\", len(d[\"records\"]), \"Stundenfenster-Sektoren:\", len(d[\"hour_max\"]))"'
```

Erwartet: `system.json` mit `throttle.now`/`throttle.ever`, und `range.json` mit
Rekorden **und** einem nicht-leeren Stundenfenster — letzteres beweist, daß die
Vorbelegung aus den History-Dateien greift und nicht erst eine Stunde Laufzeit nötig ist.

**Der Rückweg gehört zur Prüfung:**

```bash
ssh adsapp01 'sudo systemctl restart atc-daemon.service && sleep 65 &&
curl -sf http://127.0.0.1/atc/data/range.json | python3 -c "
import json,sys; print(\"Rekorde nach Neustart:\", len(json.load(sys.stdin)[\"records\"]))"'
```

Erwartet: dieselbe Anzahl Rekorde wie vorher — sie überleben den Neustart.

- [ ] **Schritt 7: Commit**

```bash
git add daemon/atc_daemon.py atc-daemon.service tests/test_daemon.py
git commit -m "Daemon-Hauptschleife, Ausgabedateien und systemd-Unit"
```

---

## Aufgabe 5: Kiosk-Installation und Rotation am Gerät messen

**Dateien:**
- Anlegen: `install-console.sh`, `atc-console.service`

**Schnittstellen:**
- Verbraucht: `atc-daemon.service` aus Aufgabe 4.
- Liefert: einen laufenden Chromium-Kiosk auf `http://127.0.0.1/atc/` und den **am Gerät
  bestimmten Rotationswert**, der in den folgenden Aufgaben als bekannt vorausgesetzt wird.

- [ ] **Schritt 1: `install-console.sh` schreiben**

Übernimm `install-console.sh` aus `~/git/projects/own/jeelink-davis` als Grundlage und
passe an: `SERVICE_USER=atc`, `SERVICE_FILE=atc-console.service`,
`CONSOLE_STATE_DIR=/var/lib/atc-console`, Ziel-URL `http://127.0.0.1/atc/`. **Unverändert
übernehmen** — das sind teuer bezahlte Details, keine Stilfragen:

- Entdeckung der seatd-Gruppe über `stat -c '%G' /run/seatd.sock` mit Warteschleife und
  Namensliste als Rückfall (auf Debian 13 läuft seatd als `seatd -g video`; trixie kann
  abweichen).
- Entdeckung der Render-Node-Gruppe über `stat -c '%G' /dev/dri/renderD128`; deren Fehlen
  ist eine Warnung, kein Abbruch.
- Gruppe `video` für `vcgencmd`, Deduplizierung der drei Gruppennamen.
- `install -d` mit **explizit genanntem** `.config` — GNU `install` vererbt `-o`/`-g`
  nicht an implizit angelegte Elternverzeichnisse.
- Ableitung der libinput-`calibrationMatrix` aus demselben `--rotate`-Wert wie die
  Ausgabetransformation.
- Erzeugung des transparenten XCursor-Themes.
- Eingabevalidierung für `--rotate` und `--output`.

Neu hinzu, weil es hier anders liegt als bei der Vorlage:

```bash
# Das Frontend liegt im Docroot des ohnehin laufenden lighttpd -- es gibt
# keinen eigenen Webserver. Nachweisen statt annehmen, dass der Pfad
# tatsaechlich ausgeliefert wird, bevor der Kiosk dagegen startet.
echo "Frontend nach /var/www/html/atc/ kopieren ..."
install -d -o "$SERVICE_USER" -g "$SERVICE_USER" -m 0755 /var/www/html/atc /var/www/html/atc/data
cp -r console/. /var/www/html/atc/
chown -R "$SERVICE_USER:$SERVICE_USER" /var/www/html/atc

CODE="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1/atc/)"
if [[ "$CODE" != "200" ]]; then
    echo "ERROR: http://127.0.0.1/atc/ antwortet mit $CODE statt 200." >&2
    echo "  Der Kiosk wuerde eine Fehlerseite zeigen. Abbruch." >&2
    exit 1
fi
echo "http://127.0.0.1/atc/ antwortet mit 200."
```

**Achtung bei einem Wiederholungslauf:** `cp -r console/.` überschreibt, löscht aber
nicht. `console.json` wird bewußt nur installiert, wenn sie noch nicht existiert —
ein Update darf die Auswahl am Gerät nicht zurücksetzen:

```bash
if [[ ! -f /var/www/html/atc/console.json ]]; then
    install -m 0644 config/console.json /var/www/html/atc/console.json
else
    echo "console.json existiert bereits -- bestehende Auswahl bleibt unangetastet."
fi
```

- [ ] **Schritt 2: `atc-console.service` schreiben**

```ini
[Unit]
Description=ATC-Konsole (labwc + Chromium-Kiosk)
After=lighttpd.service seatd.service atc-daemon.service
Wants=lighttpd.service atc-daemon.service
Requires=seatd.service

[Service]
Type=simple
User=atc
Group=atc
# __SEAT_GROUP__ ist ein Platzhalter: install-console.sh ersetzt ihn durch
# die Gruppe, die seatd auf diesem System tatsaechlich benutzt.
SupplementaryGroups=video __SEAT_GROUP__

RuntimeDirectory=atc-console
RuntimeDirectoryMode=0700
StateDirectory=atc-console
StateDirectoryMode=0700
Environment=XDG_RUNTIME_DIR=/run/atc-console
Environment=HOME=/var/lib/atc-console
Environment=XDG_CONFIG_HOME=/var/lib/atc-console/.config
Environment=WLR_LIBINPUT_NO_DEVICES=0
Environment=XCURSOR_THEME=atc-console-blank

# Chromium darf das Rennen gegen lighttpd und den Daemon nicht gewinnen:
# ohne diese Schleife zeigt das Panel beim Booten eine Verbindungsfehlerseite.
# Gewartet wird auf beides -- die Seite laedt sonst mit leerer Systemanzeige.
ExecStartPre=/bin/sh -c 'for i in $(seq 1 60); do \
  curl -sf -o /dev/null http://127.0.0.1/atc/ && \
  curl -sf -o /dev/null http://127.0.0.1/atc/data/system.json && exit 0; \
  sleep 2; done; exit 1'
ExecStart=/usr/bin/labwc -s '/usr/bin/chromium \
  --kiosk \
  --ozone-platform=wayland \
  --overscroll-history-navigation=0 \
  --disable-session-crashed-bubble \
  --disable-infobars \
  --noerrdialogs \
  --check-for-update-interval=31536000 \
  --app=http://127.0.0.1/atc/'
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

- [ ] **Schritt 3: Eine Testseite ausliefern, damit der Kiosk etwas zeigen kann**

`console/index.html` als Platzhalter mit vier eindeutig unterscheidbaren Ecken — sie ist
zugleich das Meßmittel für die Rotation:

```html
<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>ATC-Konsole</title>
<style>
  html,body{margin:0;width:1280px;height:720px;overflow:hidden;background:#04140a;
            color:#7dfba1;font:600 40px/1.2 monospace;cursor:none}
  .e{position:absolute;padding:18px}
  #ol{top:0;left:0}#or{top:0;right:0}#ul{bottom:0;left:0}#ur{bottom:0;right:0}
  #tr{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:30px}
</style></head><body>
  <div class="e" id="ol">OBEN LINKS</div>
  <div class="e" id="or">OBEN RECHTS</div>
  <div class="e" id="ul">UNTEN LINKS</div>
  <div class="e" id="ur">UNTEN RECHTS</div>
  <div id="tr">bitte eine Ecke antippen</div>
  <script>
    // Zeigt an, WO der Finger wirklich landet -- eine gedrehte Anzeige ueber
    // einer ungedrehten Touchflaeche sieht voellig richtig aus und ist falsch.
    addEventListener('pointerup', e => {
      const v = e.clientY < 360 ? 'OBEN' : 'UNTEN';
      const h = e.clientX < 640 ? 'LINKS' : 'RECHTS';
      document.getElementById('tr').textContent =
        `Treffer: ${v} ${h} (${Math.round(e.clientX)}, ${Math.round(e.clientY)})`;
    });
  </script>
</body></html>
```

- [ ] **Schritt 4: Installieren und die Rotation bestimmen**

```bash
rsync -a --exclude .git ./ adsapp01:/tmp/adsb-console/
ssh -t adsapp01 'cd /tmp/adsb-console && sudo ./install-console.sh --rotate 90 --output DSI-1'
```

Dann **am Panel** ablesen, nicht raten. Ist das Bild kopfüber oder seitenverkehrt, mit
`--rotate 0`, `180` oder `270` wiederholen, bis die Beschriftungen richtig stehen. Bei
dwsapp01 war die naheliegende Annahme (aus `fbcon=rotate:3` abgeleitet) um 180° falsch —
deshalb wird hier gemessen und der ermittelte Wert notiert.

- [ ] **Schritt 5: Die Rotation mit dem Finger prüfen, nicht mit den Augen**

Alle vier Ecken der Reihe nach antippen. Die Meldung in der Mitte muß **dieselbe** Ecke
nennen, die man berührt hat. Stimmt sie nicht, ist die `calibrationMatrix` falsch —
`--rotate` mit dem korrekten Wert erneut laufen lassen (die Matrix wird daraus
abgeleitet) und erneut prüfen.

- [ ] **Schritt 6: Den ermittelten Rotationswert festhalten**

In `README.md` unter „Installation" den Wert notieren, mit dem Zusatz, daß er am Gerät
gemessen und nicht übernommen wurde.

- [ ] **Schritt 7: Commit**

```bash
git add install-console.sh atc-console.service console/index.html README.md
git commit -m "Kiosk-Installation, Unit und Rotationsmessung am Panel"
```

---

## Aufgabe 6: Meß-Spike — entscheidet die Radar-Umsetzung

**Dateien:**
- Anlegen: `docs/messungen/2026-07-27-canvas-spike.md`
- Temporär (nicht committen): eine Wegwerf-Seite unter `/var/www/html/atc/spike.html`

**Schnittstellen:**
- Verbraucht: den laufenden Kiosk aus Aufgabe 5.
- Liefert: die Entscheidung **Variante A (Canvas-Phosphor)** oder **Variante B
  (CSS-Sweep)** für Aufgabe 9, samt Meßprotokoll.

- [ ] **Schritt 1: Die Baseline erneut erheben**

Die Zahlen aus der Spec stammen von vor der Kiosk-Installation. Chromium läuft jetzt —
also gilt eine **neue** Baseline, sonst mißt man die Animation gegen einen Zustand, den
es nicht mehr gibt.

```bash
ssh adsapp01 'for i in $(seq 1 10); do
  printf "%s;%s;%s;%s\n" "$(date +%T)" "$(vcgencmd measure_temp)" \
    "$(vcgencmd get_throttled)" "$(cut -d" " -f1 /proc/loadavg)"
  sleep 30
done' | tee /tmp/claude-501/*/scratchpad/baseline-kiosk.csv
```

Erwartet: fünf Minuten Meßreihe mit ruhender Platzhalterseite.

- [ ] **Schritt 2: Die Wegwerf-Seite schreiben**

Sie soll **teurer** sein als die geplante Radarseite, nicht billiger — wer den
günstigsten Fall mißt, mißt am Risiko vorbei: volle 620×620-Canvas, 30 Bilder je
Sekunde, Phosphorabklingen über die ganze Fläche, 30 Blips.

```html
<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>Spike</title>
<style>html,body{margin:0;background:#000;overflow:hidden;cursor:none}</style></head>
<body><canvas id="c" width="620" height="620"></canvas>
<script>
const c = document.getElementById('c'), x = c.getContext('2d');
const R = 310, blips = Array.from({length: 30}, (_, i) => ({
  a: i * 12 * Math.PI / 180, r: 40 + (i * 9) % 260 }));
let ang = 0, frames = 0, t0 = performance.now();
function frame() {
  // Phosphor-Abklingen ueber die volle Flaeche -- der teure Teil.
  x.fillStyle = 'rgba(0,0,0,0.06)'; x.fillRect(0, 0, 620, 620);
  ang += 2 * Math.PI / (5 * 30);                 // 5 s je Umlauf bei 30 fps
  x.strokeStyle = 'rgba(120,255,160,0.9)'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(R, R);
  x.lineTo(R + R * Math.sin(ang), R - R * Math.cos(ang)); x.stroke();
  for (const b of blips) {
    const d = ((ang - b.a) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    if (d < 0.12) {
      x.fillStyle = '#9dffbe';
      x.beginPath();
      x.arc(R + b.r * Math.sin(b.a), R - b.r * Math.cos(b.a), 4, 0, 7); x.fill();
    }
  }
  if (++frames % 300 === 0) {
    console.log('fps', (frames / ((performance.now() - t0) / 1000)).toFixed(1));
  }
  requestAnimationFrame(frame);
}
frame();
</script></body></html>
```

- [ ] **Schritt 3: Den Spike laufen lassen und messen**

```bash
scp spike.html adsapp01:/tmp/ && ssh adsapp01 'sudo install -m 0644 -o atc -g atc /tmp/spike.html /var/www/html/atc/spike.html
sudo sed -i "s|--app=http://127.0.0.1/atc/|--app=http://127.0.0.1/atc/spike.html|" /etc/systemd/system/atc-console.service
sudo systemctl daemon-reload && sudo systemctl restart atc-console.service'
```

Dann 30 Minuten messen — **alle drei Abbruchkriterien in einer Reihe**:

```bash
ssh adsapp01 'for i in $(seq 1 60); do
  printf "%s;%s;%s;%s;%s\n" "$(date +%T)" "$(vcgencmd measure_temp)" \
    "$(vcgencmd get_throttled)" "$(cut -d" " -f1 /proc/loadavg)" \
    "$(python3 -c "import json;print(json.load(open(\"/run/dump1090-fa/stats.json\"))[\"last5min\"][\"local\"][\"samples_dropped\"])")"
  sleep 30
done' | tee /tmp/claude-501/*/scratchpad/spike-canvas.csv
```

- [ ] **Schritt 4: Gegen die vorab festgelegten Grenzen entscheiden**

| Kriterium | Grenze | Ergebnis |
|---|---|---|
| `samples_dropped` | bleibt **0** | |
| `get_throttled` | bleibt `0x0` | |
| CPU-Temperatur | unter **72 °C** | |

`samples_dropped` ist das harte Kriterium: Verliert der SDR-Leser Samples, beschädigt die
Konsole den Zweck des Geräts. Alle drei gehalten → **Variante A**. Eines gerissen →
**Variante B**, und Variante B wird mit demselben Verfahren gemessen, bevor sie
freigegeben wird.

- [ ] **Schritt 5: Aufräumen und protokollieren**

```bash
ssh adsapp01 'sudo rm -f /var/www/html/atc/spike.html
sudo sed -i "s|--app=http://127.0.0.1/atc/spike.html|--app=http://127.0.0.1/atc/|" /etc/systemd/system/atc-console.service
sudo systemctl daemon-reload && sudo systemctl restart atc-console.service'
```

`docs/messungen/2026-07-27-canvas-spike.md` anlegen: beide Meßreihen als Tabelle,
Baseline und Spike gegenübergestellt, die Entscheidung mit einem Satz Begründung, und
die erreichte Bildrate aus der Konsolenausgabe.

- [ ] **Schritt 6: Commit**

```bash
git add docs/messungen/2026-07-27-canvas-spike.md
git commit -m "Mess-Spike: Animationskosten am Panel gemessen, Radar-Variante entschieden"
```

---

## Aufgabe 7: Frontend-Gerüst — Layout, Config, Karussell

**Dateien:**
- Ändern: `console/index.html` (Platzhalter aus Aufgabe 5 ersetzen)
- Anlegen: `console/css/console.css`, `console/js/config.js`, `console/js/console.js`,
  `console/js/data.js`, `config/console.json`
- Test: `tests/test_config.mjs`

**Schnittstellen:**
- Verbraucht: `geo.js` aus Aufgabe 1.
- Liefert: `mergeConfig(raw) -> Config` aus `config.js`;
  `registerPage({id, title, ageSource, mount, render})` und `startConsole()` aus
  `console.js`; `createDataStore(onUpdate) -> {state, start()}` aus `data.js` mit
  `state.aircraft`, `state.aircraftAt`, `state.stats`, `state.range`, `state.system`,
  `state.receiver` (`{lat, lon}`).

- [ ] **Schritt 1: Den scheiternden Config-Test schreiben**

Das ist die „absichtlich falsch bedienen"-Prüfung aus §10.3 der Spec, als Test statt als
Handgriff.

```javascript
// tests/test_config.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeConfig, DEFAULTS } from '../console/js/config.js';

test('leere Eingabe ergibt die Vorgabewerte', () => {
  const c = mergeConfig(null);
  assert.deepEqual(c.pages, DEFAULTS.pages);
  assert.equal(c.radar.range_nm, 50);
});

test('Teilangaben ueberschreiben nur das Genannte', () => {
  const c = mergeConfig({ radar: { range_nm: 25 } });
  assert.equal(c.radar.range_nm, 25);
  assert.equal(c.radar.sweep_s, DEFAULTS.radar.sweep_s);
  assert.equal(c.dwell_s.radar, DEFAULTS.dwell_s.radar);
});

test('unbekannte Seitennamen werden verworfen, nicht uebernommen', () => {
  const c = mergeConfig({ pages: { gibtsnicht: true, radar: false } });
  assert.equal(c.pages.gibtsnicht, undefined);
  assert.equal(c.pages.radar, false);
});

test('alle Seiten aus ergibt trotzdem eine sichtbare Konsole', () => {
  // Ein weisser Schirm wegen einer Konfiguration ist inakzeptabel.
  const c = mergeConfig({ pages: { radar: false, board: false, target: false,
    stats: false, polar: false, profile: false, system: false } });
  assert.ok(c.activePages.length >= 1, 'mindestens eine Seite muss bleiben');
  assert.equal(c.activePages[0], 'radar');
});

test('unsinnige Zahlen fallen auf die Vorgabe zurueck', () => {
  assert.equal(mergeConfig({ radar: { range_nm: 0 } }).radar.range_nm, DEFAULTS.radar.range_nm);
  assert.equal(mergeConfig({ radar: { range_nm: -5 } }).radar.range_nm, DEFAULTS.radar.range_nm);
  assert.equal(mergeConfig({ radar: { sweep_s: -1 } }).radar.sweep_s, DEFAULTS.radar.sweep_s);
  assert.equal(mergeConfig({ radar: { range_nm: 'weit' } }).radar.range_nm, DEFAULTS.radar.range_nm);
  assert.equal(mergeConfig({ dwell_s: { radar: 0 } }).dwell_s.radar, DEFAULTS.dwell_s.radar);
});

test('falsche Typen an der Wurzel werden ignoriert', () => {
  assert.deepEqual(mergeConfig('kaputt').pages, DEFAULTS.pages);
  assert.deepEqual(mergeConfig([1, 2, 3]).pages, DEFAULTS.pages);
  assert.deepEqual(mergeConfig({ pages: 'ja' }).pages, DEFAULTS.pages);
});
```

- [ ] **Schritt 2: Test laufen lassen, Scheitern bestätigen**

Ausführen: `node --test tests/test_config.mjs`
Erwartet: FAIL — `Cannot find module .../console/js/config.js`.

- [ ] **Schritt 3: `config.js` schreiben**

```javascript
// console/js/config.js
// Konfiguration laden und haerten. Eine kaputte Datei fuehrt zu einer
// laufenden Konsole mit Vorgabewerten, niemals zu einem weissen Schirm.

export const DEFAULTS = Object.freeze({
  pages: { radar: true, board: true, target: true, stats: true,
           polar: true, profile: true, system: true },
  dwell_s: { radar: 45, default: 15 },
  radar: { range_nm: 50, rings_nm: [10, 25, 50], sweep_s: 5,
           decay_s: 6, leader_s: 60, labels: ['callsign', 'fl', 'squawk'] },
  emergency: { highlight: true, interrupt_carousel: false },
});

const PAGE_ORDER = ['radar', 'board', 'target', 'stats', 'polar', 'profile', 'system'];

function positiveNumber(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function mergeConfig(raw) {
  const src = plainObject(raw);
  const pagesIn = plainObject(src.pages);
  const pages = {};
  for (const id of PAGE_ORDER) {
    pages[id] = typeof pagesIn[id] === 'boolean' ? pagesIn[id] : DEFAULTS.pages[id];
  }
  // Unbekannte Namen werden bewusst nicht uebernommen: sonst traegt die
  // Konsole eine Seite in der Liste, fuer die es keinen Renderer gibt.

  const dwellIn = plainObject(src.dwell_s);
  const dwell_s = {
    radar: positiveNumber(dwellIn.radar, DEFAULTS.dwell_s.radar),
    default: positiveNumber(dwellIn.default, DEFAULTS.dwell_s.default),
  };

  const radarIn = plainObject(src.radar);
  const radar = {
    range_nm: positiveNumber(radarIn.range_nm, DEFAULTS.radar.range_nm),
    sweep_s: positiveNumber(radarIn.sweep_s, DEFAULTS.radar.sweep_s),
    decay_s: positiveNumber(radarIn.decay_s, DEFAULTS.radar.decay_s),
    leader_s: positiveNumber(radarIn.leader_s, DEFAULTS.radar.leader_s),
    rings_nm: Array.isArray(radarIn.rings_nm) &&
              radarIn.rings_nm.every(n => typeof n === 'number' && n > 0)
              ? radarIn.rings_nm.slice() : DEFAULTS.radar.rings_nm.slice(),
    labels: Array.isArray(radarIn.labels)
            ? radarIn.labels.filter(l => DEFAULTS.radar.labels.includes(l))
            : DEFAULTS.radar.labels.slice(),
  };

  const emIn = plainObject(src.emergency);
  const emergency = {
    highlight: typeof emIn.highlight === 'boolean' ? emIn.highlight : DEFAULTS.emergency.highlight,
    interrupt_carousel: typeof emIn.interrupt_carousel === 'boolean'
      ? emIn.interrupt_carousel : DEFAULTS.emergency.interrupt_carousel,
  };

  let activePages = PAGE_ORDER.filter(id => pages[id]);
  if (activePages.length === 0) {
    // Lieber die Hauptseite gegen den Wunsch zeigen als gar nichts: eine
    // leere Anzeige waere von einem Defekt nicht zu unterscheiden.
    activePages = ['radar'];
  }
  return { pages, dwell_s, radar, emergency, activePages };
}

export async function loadConfig(url = 'console.json') {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    return mergeConfig(res.ok ? await res.json() : null);
  } catch (_) {
    return mergeConfig(null);       // auch ein JSON-Syntaxfehler landet hier
  }
}
```

- [ ] **Schritt 4: Test laufen lassen, Bestehen bestätigen**

Ausführen: `node --test tests/test_config.mjs`
Erwartet: PASS, 6 Tests.

- [ ] **Schritt 5: `data.js` schreiben**

```javascript
// console/js/data.js
// Abrufschleifen. Ein fehlgeschlagener Abruf laesst die letzten Werte
// stehen und altern -- die Seite wird nie neu geladen.

async function getJSON(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    return res.ok && res.status !== 204 ? await res.json() : null;
  } catch (_) { return null; }
}

const DATA = '/skyaware/data/';
const OWN = 'data/';

// Testmodus: ?source=... zeigt die Zielquelle auf eine praeparierte Datei.
// Ohne diesen Haken laesst sich der Notfall-Squawk nicht herstellen, ohne in
// den produktiven Datenpfad /run/dump1090-fa/ zu schreiben -- und ein Pfad,
// den man nie ausloesen kann, ist unkalibriert (Spec 10.3).
const AIRCRAFT_URL =
  new URLSearchParams(location.search).get('source') || DATA + 'aircraft.json';

export function createDataStore(onUpdate) {
  const state = {
    aircraft: [], aircraftAt: null, aircraftNow: null,
    stats: null, statsAt: null,
    range: null, rangeAt: null,
    system: null, systemAt: null,
    receiver: null,
    systemVisible: false,
  };

  async function pollAircraft() {
    const d = await getJSON(AIRCRAFT_URL);
    if (d) {
      state.aircraft = d.aircraft || [];
      // now stammt vom selben Host wie der Browser -- kein Uhrenversatz.
      state.aircraftNow = d.now;
      state.aircraftAt = Date.now();
      onUpdate();
    }
  }
  async function pollStats() {
    const d = await getJSON(DATA + 'stats.json');
    if (d) { state.stats = d; state.statsAt = Date.now(); onUpdate(); }
  }
  async function pollRange() {
    const d = await getJSON(OWN + 'range.json');
    if (d) { state.range = d; state.rangeAt = Date.now(); onUpdate(); }
  }
  // Die Systemseite ist die einzige, deren Quelle einen Unterprozess kostet
  // -- also nur abrufen, solange sie sichtbar ist.
  async function pollSystem() {
    if (!state.systemVisible) return;
    const d = await getJSON(OWN + 'system.json');
    if (d) { state.system = d; state.systemAt = Date.now(); onUpdate(); }
  }

  async function start() {
    // Die gerundete Position aus receiver.json genuegt: bei 0,161 NM/px sind
    // 600 m Rundungsfehler rund zwei Pixel. Die exakte Position bleibt auf
    // dem Geraet und wird nur vom Daemon fuer die Rekorde benutzt.
    const r = await getJSON(DATA + 'receiver.json');
    if (r) state.receiver = { lat: r.lat, lon: r.lon };
    await Promise.all([pollAircraft(), pollStats(), pollRange()]);
    setInterval(pollAircraft, 1000);
    setInterval(pollStats, 5000);
    setInterval(pollRange, 60000);
    setInterval(pollSystem, 10000);
  }

  return { state, start };
}

// Alterszustand einer Quelle. Grenzen aus der Spec, Abschnitt 8.
export function ageState(ageMs) {
  if (ageMs == null) return 'stale';
  if (ageMs < 10000) return 'fresh';
  if (ageMs < 60000) return 'aging';
  return 'stale';
}
```

- [ ] **Schritt 6: `console.js`, `index.html` und `console.css` schreiben**

```javascript
// console/js/console.js
import { loadConfig } from './config.js';
import { createDataStore, ageState } from './data.js';

const pages = new Map();          // id -> {id, title, ageSource, mount, render}

export function registerPage(page) { pages.set(page.id, page); }

export async function startConsole() {
  const config = await loadConfig();
  const store = createDataStore(() => renderCurrent());
  const order = config.activePages.filter(id => pages.has(id));
  const stage = document.getElementById('stage');
  const dotsEl = document.getElementById('dots');
  const els = new Map();
  let current = 0, rotateTimer = null, resumeTimer = null;

  for (const id of order) {
    const el = document.createElement('div');
    el.className = 'page';
    stage.appendChild(el);
    els.set(id, el);
    pages.get(id).mount(el, config, store.state);

    const box = document.createElement('div');
    box.className = 'dotbox';
    const dot = document.createElement('span');
    dot.className = 'dot';
    box.appendChild(dot);
    const index = order.indexOf(id);
    box.addEventListener('pointerup', () => { takeOver(); goTo(index); });
    dotsEl.appendChild(box);
  }

  function dwellFor(id) {
    return (config.dwell_s[id] ?? config.dwell_s.default) * 1000;
  }

  function renderCurrent() {
    const page = pages.get(order[current]);
    if (!page) return;
    store.state.systemVisible = page.id === 'system';
    page.render(els.get(page.id), config, store.state);
    document.getElementById('page-title').textContent = page.title.toUpperCase();
    updateAge(page);
  }

  function updateAge(page) {
    const at = page.ageSource ? store.state[page.ageSource + 'At'] : null;
    const dot = document.getElementById('age-dot');
    const txt = document.getElementById('age');
    if (!page.ageSource) { dot.style.display = 'none'; txt.textContent = ''; return; }
    dot.style.display = '';
    const ms = at == null ? null : Date.now() - at;
    const st = ageState(ms);
    dot.className = st;
    txt.textContent = ms == null ? 'keine Daten' : `${Math.round(ms / 1000)} s`;
    els.get(page.id).classList.remove('fresh', 'aging', 'stale');
    els.get(page.id).classList.add(st);
  }

  function goTo(index) {
    const next = ((index % order.length) + order.length) % order.length;
    if (next === current) return;
    els.get(order[current]).classList.remove('active');
    current = next;
    renderCurrent();
    els.get(order[current]).classList.add('active');
    dotsEl.querySelectorAll('.dot')
      .forEach((d, i) => d.classList.toggle('on', i === current));
    startRotation();
  }

  function startRotation() {
    clearTimeout(rotateTimer);
    rotateTimer = setTimeout(() => goTo(current + 1), dwellFor(order[current]));
  }

  // Jede Beruehrung pausiert die Rotation; sie nimmt danach von der
  // SICHTBAREN Seite aus wieder auf, nicht von der unterbrochenen.
  function takeOver() {
    clearTimeout(rotateTimer);
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(startRotation, 60000);
  }

  let downX = 0, downY = 0, downT = 0;
  stage.addEventListener('pointerdown', e => {
    downX = e.clientX; downY = e.clientY; downT = Date.now();
  });
  stage.addEventListener('pointerup', e => {
    const dx = e.clientX - downX, dy = e.clientY - downY;
    takeOver();
    if (Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) && Date.now() - downT < 1200) {
      goTo(current + (dx < 0 ? 1 : -1));
    }
  });
  document.addEventListener('contextmenu', e => e.preventDefault());

  function tickClock() {
    const now = new Date();
    document.getElementById('clock').textContent =
      now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', hour12: false });
    document.getElementById('date').textContent =
      now.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
    updateAge(pages.get(order[current]));
  }

  els.get(order[0]).classList.add('active');
  dotsEl.querySelector('.dot').classList.add('on');
  await store.start();
  renderCurrent();
  tickClock();
  setInterval(tickClock, 1000);
  startRotation();

  // Naechtlicher Reload -- nur wenn die Quelle vorher antwortet. Ohne diese
  // Sperre ist der Reload genau der Mechanismus, der morgens eine
  // Fehlerseite an der Wand hinterlaesst.
  setInterval(async () => {
    const now = new Date();
    if (now.getHours() !== 4 || now.getMinutes() !== 0) return;
    try {
      const res = await fetch('/skyaware/data/aircraft.json', { cache: 'no-store' });
      if (res.ok) location.reload();
    } catch (_) { /* kein Reload */ }
  }, 60000);
}
```

```html
<!-- console/index.html -->
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=1280, height=720, initial-scale=1, user-scalable=no">
  <title>ATC-Konsole</title>
  <link rel="stylesheet" href="css/console.css">
</head>
<body>
  <div id="app">
    <div id="head">
      <div id="page-title">—</div>
      <div class="spacer"></div>
      <div id="age-wrap"><span id="age-dot"></span><span id="age">—</span></div>
      <div id="clock">--:--</div>
      <div id="date">—</div>
    </div>
    <div id="stage"></div>
    <div id="dots"></div>
  </div>
  <script type="module">
    import { startConsole } from './js/console.js';
    import './js/pages/radar.js';
    import './js/pages/board.js';
    import './js/pages/stats.js';
    startConsole();
  </script>
</body>
</html>
```

```css
/* console/css/console.css */
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body {
  width: 1280px; height: 720px; overflow: hidden;
  background: #04140a; color: #b8f5cc;
  font-family: ui-monospace, "DejaVu Sans Mono", monospace;
  user-select: none; -webkit-user-select: none;
  touch-action: none; cursor: none;
}
#app { width: 1280px; height: 720px; padding: 0 20px; display: flex; flex-direction: column; }
#head { height: 56px; flex: 0 0 56px; display: flex; align-items: center; gap: 18px;
        border-bottom: 1px solid #14361f; }
#page-title { font-size: 24px; font-weight: 700; letter-spacing: .16em; color: #4e9c6a; }
#head .spacer { flex: 1; }
#age-wrap { display: flex; align-items: center; gap: 9px; font-size: 18px; color: #4e9c6a;
            font-variant-numeric: tabular-nums; }
#age-dot { width: 12px; height: 12px; border-radius: 50%; background: #3ddc84; }
#age-dot.aging { background: #f0b429; }
#age-dot.stale { background: #4e6b58; }
#clock { font-size: 38px; font-weight: 600; font-variant-numeric: tabular-nums; }
#date { font-size: 18px; color: #4e9c6a; }

#stage { flex: 1; position: relative; min-height: 0; }
.page { position: absolute; inset: 0; padding: 16px 0 6px; display: flex; gap: 20px;
        opacity: 0; pointer-events: none; transition: opacity 180ms linear; }
.page.active { opacity: 1; pointer-events: auto; }
.aging .value { opacity: .55; }
.stale .value { opacity: .35; filter: grayscale(1); }

#dots { height: 44px; flex: 0 0 44px; display: flex; align-items: center;
        justify-content: center; gap: 12px; }
.dotbox { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; }
.dot { width: 12px; height: 12px; border-radius: 50%; background: #1d4a2e;
       transition: width 150ms, background 150ms; }
.dot.on { background: #3ddc84; width: 34px; border-radius: 6px; }
```

`config/console.json` erhält exakt den Inhalt aus §4.3 der Spec.

**Ehrlichkeitsvermerk zu `emergency.interrupt_carousel`:** Der Schalter wird von
`mergeConfig` gelesen und validiert, hat in dieser Stufe aber **keine Wirkung** — er
würde auf die Einzelziel-Seite springen, und die entsteht erst in Stufe 2. Sein
Vorgabewert ist `false`, er wird also niemand still enttäuschen; in `config/console.json`
steht ein Kommentar-Feld `"_hinweis": "interrupt_carousel wirkt ab Stufe 2"`, damit die
Datei nicht mehr verspricht, als sie hält. Die Markierung selbst (`highlight`) wirkt
sofort.

- [ ] **Schritt 7: Beide Testdateien laufen lassen**

Ausführen: `node --test tests/*.mjs`
Erwartet: PASS, 17 Tests (11 aus `test_geo.mjs`, 6 aus `test_config.mjs`).

- [ ] **Schritt 8: Commit**

```bash
git add console/ config/console.json tests/test_config.mjs
git commit -m "Frontend-Geruest: Layout, gehaertete Konfiguration, Karussell"
```

---

## Aufgabe 8: Flugplatzdaten

**Dateien:**
- Anlegen: `console/data/airports.json`, `tools/build_airports.py`
- Test: `tests/test_airports.mjs`

**Schnittstellen:**
- Verbraucht: nichts.
- Liefert: `console/data/airports.json` in der Form
  `{"generated": "<ISO-Datum>", "source": "OurAirports (public domain)",
  "airports": [{"icao": "EDDF", "name": "...", "lat": 50.03, "lon": 8.57,
  "runways": [{"le_ident": "07C", "he_ident": "25C", "le_lat": ..., "le_lon": ...,
  "he_lat": ..., "he_lon": ..., "length_ft": 13123}]}]}`.

- [ ] **Schritt 1: Das Erzeugungswerkzeug schreiben**

Die Koordinaten werden **geholt, nicht erinnert** — Bahnschwellen aus dem Gedächtnis zu
schreiben wäre genau die Sorte Behauptung, die dieser Plan sonst überall vermeidet.

```python
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
```

- [ ] **Schritt 2: Ausführen und das Ergebnis gegen die Wirklichkeit prüfen**

Ausführen: `python3 tools/build_airports.py`
Erwartet: eine zweistellige Zahl Plätze.

Dann eine Gegenprobe, deren Antwort vorher feststeht — EDDF hat **vier** Bahnen (drei
parallele Ost-West-Bahnen und die Nord-Süd-Bahn 18/36), und die längste liegt bei rund
4000 m:

```bash
python3 -c "
import json
d = json.load(open('console/data/airports.json'))
f = [a for a in d['airports'] if a['icao'] == 'EDDF'][0]
print(f['name'], '-', len(f['runways']), 'Bahnen')
for r in f['runways']:
    print(' ', r['le_ident'], '/', r['he_ident'], r['length_ft'], 'ft')
print('Egelsbach vorhanden:', any(a['icao'] == 'EDFE' for a in d['airports']))
"
```

Erwartet: vier Bahnen, darunter `18/36`, längste rund 13.000 ft. Weicht das ab, ist der
Filter falsch — **nicht** die Erwartung anpassen, sondern den Filter.

- [ ] **Schritt 3: Den Datentest schreiben**

```javascript
// tests/test_airports.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const data = JSON.parse(readFileSync(new URL('../console/data/airports.json', import.meta.url)));

test('Frankfurt ist enthalten und hat vier Bahnen', () => {
  const eddf = data.airports.find(a => a.icao === 'EDDF');
  assert.ok(eddf, 'EDDF fehlt');
  assert.equal(eddf.runways.length, 4);
  assert.ok(eddf.runways.some(r => r.le_ident === '18' || r.he_ident === '36'));
});

test('jede Bahn hat beide Schwellen', () => {
  for (const a of data.airports) {
    for (const r of a.runways) {
      for (const k of ['le_lat', 'le_lon', 'he_lat', 'he_lon']) {
        assert.equal(typeof r[k], 'number', `${a.icao} ${r.le_ident}: ${k} fehlt`);
      }
    }
  }
});

test('alle Plaetze liegen im deklarierten Ausschnitt', () => {
  const [latMin, lonMin, latMax, lonMax] = data.bbox;
  for (const a of data.airports) {
    assert.ok(a.lat >= latMin && a.lat <= latMax, `${a.icao} ausserhalb`);
    assert.ok(a.lon >= lonMin && a.lon <= lonMax, `${a.icao} ausserhalb`);
  }
});
```

- [ ] **Schritt 4: Test laufen lassen**

Ausführen: `node --test tests/test_airports.mjs`
Erwartet: PASS, 3 Tests.

- [ ] **Schritt 5: Commit**

```bash
git add tools/build_airports.py console/data/airports.json tests/test_airports.mjs
git commit -m "Flugplatz- und Bahngeometrie aus OurAirports eingefroren"
```

---

## Aufgabe 9: Radarseite

**Dateien:**
- Anlegen: `console/js/pages/radar.js`
- Test: `tests/test_radar_geometry.mjs`

**Schnittstellen:**
- Verbraucht: `geo.js` (Aufgabe 1), `registerPage` (Aufgabe 7), `airports.json` (Aufgabe 8),
  die Entscheidung aus Aufgabe 6.
- Liefert: `projectToCanvas(nm, bearingDeg, rangeNm, radiusPx) -> {x, y}` (exportiert und
  getestet) sowie die registrierte Seite `radar`.

**Vor dem Beginn:** In `docs/messungen/2026-07-27-canvas-spike.md` nachsehen, welche
Variante entschieden wurde. **Variante A** (Canvas-Phosphor) ist unten ausgeführt;
**Variante B** ersetzt nur die Phosphor-Ebene durch ein CSS-rotiertes Verlaufselement
(`transform: rotate()` mit `animation`), während Blips und Overlays im 1-Sekunden-Takt
gezeichnet werden — Hintergrund- und Overlay-Ebene sind in beiden Varianten identisch.

- [ ] **Schritt 1: Den Geometrie-Test schreiben**

Die Projektion ist die eine Stelle der Radarseite, an der ein Vorzeichenfehler still
falsch aussieht statt zu krachen — Norden muß nach **oben** zeigen, Osten nach rechts.

```javascript
// tests/test_radar_geometry.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { projectToCanvas } from '../console/js/pages/radar.js';

const R = 310, RANGE = 50;

test('Norden liegt oben, nicht unten', () => {
  const p = projectToCanvas(25, 0, RANGE, R);
  assert.ok(Math.abs(p.x) < 0.001, `x sollte 0 sein, ist ${p.x}`);
  assert.ok(p.y < 0, `Norden muss negatives y haben, ist ${p.y}`);
  assert.ok(Math.abs(p.y + 155) < 0.001);
});

test('Osten liegt rechts', () => {
  const p = projectToCanvas(25, 90, RANGE, R);
  assert.ok(Math.abs(p.x - 155) < 0.001);
  assert.ok(Math.abs(p.y) < 0.001);
});

test('Sueden und Westen', () => {
  const s = projectToCanvas(50, 180, RANGE, R);
  assert.ok(Math.abs(s.y - 310) < 0.001);
  const w = projectToCanvas(50, 270, RANGE, R);
  assert.ok(Math.abs(w.x + 310) < 0.001);
});

test('die Station selbst liegt im Mittelpunkt', () => {
  const p = projectToCanvas(0, 123, RANGE, R);
  assert.ok(Math.abs(p.x) < 0.001 && Math.abs(p.y) < 0.001);
});
```

- [ ] **Schritt 2: Test laufen lassen, Scheitern bestätigen**

Ausführen: `node --test tests/test_radar_geometry.mjs`
Erwartet: FAIL — `Cannot find module .../console/js/pages/radar.js`.

- [ ] **Schritt 3: Die Radarseite schreiben**

```javascript
// console/js/pages/radar.js
import { haversineNm, bearingDeg, formatCallsign, flightLevel, isEmergency }
  from '../geo.js';
import { registerPage } from '../console.js';

const SIZE = 620;               // Buehnenhoehe: 720 minus Kopf (56) und Punkte (44)
const R = SIZE / 2;             // Radius in Pixeln
const CENTER = SIZE / 2;

// Rein, damit sie testbar ist: Ergebnis relativ zum Mittelpunkt.
// Norden ist oben (negatives y), Osten rechts.
export function projectToCanvas(nm, brg, rangeNm, radiusPx) {
  const r = nm / rangeNm * radiusPx;
  const a = brg * Math.PI / 180;
  return { x: r * Math.sin(a), y: -r * Math.cos(a) };
}

const COL = {
  ring: '#1c5c33', ringText: '#3a8f57', sweep: '#7dfba1',
  blip: '#b8ffcf', label: '#8fe6ab', emergency: '#ff5a5a',
  airport: '#4fb0d8', runway: '#6fd0f0',
};

let airports = null;

async function loadAirports() {
  if (airports) return airports;
  try {
    const res = await fetch('data/airports.json', { cache: 'force-cache' });
    airports = res.ok ? (await res.json()).airports : [];
  } catch (_) { airports = []; }
  return airports;
}

function drawBackground(ctx, cfg, receiver) {
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.save();
  ctx.translate(CENTER, CENTER);
  ctx.strokeStyle = COL.ring;
  ctx.lineWidth = 1;
  for (const nm of cfg.radar.rings_nm) {
    const r = nm / cfg.radar.range_nm * R;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = COL.ringText;
    ctx.font = '13px ui-monospace, monospace';
    ctx.fillText(`${nm}`, 4, -r - 5);
  }
  for (let d = 0; d < 360; d += 30) {          // Peilstrahlen
    const p = projectToCanvas(cfg.radar.range_nm, d, cfg.radar.range_nm, R);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(p.x, p.y); ctx.stroke();
    const t = projectToCanvas(cfg.radar.range_nm * 0.94, d, cfg.radar.range_nm, R);
    ctx.fillStyle = COL.ringText;
    ctx.font = '13px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(d === 0 ? 360 : d).padStart(3, '0'), t.x, t.y);
  }
  ctx.textAlign = 'left';
  if (receiver && airports) drawAirports(ctx, cfg, receiver);
  ctx.restore();
}

function drawAirports(ctx, cfg, receiver) {
  for (const ap of airports) {
    const nm = haversineNm(receiver.lat, receiver.lon, ap.lat, ap.lon);
    if (nm > cfg.radar.range_nm) continue;
    const p = projectToCanvas(nm, bearingDeg(receiver.lat, receiver.lon, ap.lat, ap.lon),
                              cfg.radar.range_nm, R);
    // Bahnen massstaeblich, sofern sie bei diesem Massstab ueberhaupt
    // sichtbar sind -- bei 0,161 NM/px sind 4000 m rund 13 px. Alles unter
    // vier Pixeln waere Strichgekritzel und wird zum blossen Symbol.
    let drewRunway = false;
    for (const rw of ap.runways || []) {
      const a = projectToCanvas(
        haversineNm(receiver.lat, receiver.lon, rw.le_lat, rw.le_lon),
        bearingDeg(receiver.lat, receiver.lon, rw.le_lat, rw.le_lon),
        cfg.radar.range_nm, R);
      const b = projectToCanvas(
        haversineNm(receiver.lat, receiver.lon, rw.he_lat, rw.he_lon),
        bearingDeg(receiver.lat, receiver.lon, rw.he_lat, rw.he_lon),
        cfg.radar.range_nm, R);
      if (Math.hypot(b.x - a.x, b.y - a.y) < 4) continue;
      ctx.strokeStyle = COL.runway;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      drewRunway = true;
    }
    if (!drewRunway) {
      ctx.fillStyle = COL.airport;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = COL.airport;
    ctx.font = '12px ui-monospace, monospace';
    ctx.fillText(ap.icao, p.x + 6, p.y - 6);
  }
}

registerPage({
  id: 'radar',
  title: 'Radar',
  ageSource: 'aircraft',
  mount(el, cfg) {
    el.innerHTML = `
      <div class="radar-wrap">
        <canvas class="bg"      width="${SIZE}" height="${SIZE}"></canvas>
        <canvas class="phosphor" width="${SIZE}" height="${SIZE}"></canvas>
        <canvas class="overlay"  width="${SIZE}" height="${SIZE}"></canvas>
      </div>
      <div class="radar-side value"></div>`;
    el._ctx = {
      bg: el.querySelector('.bg').getContext('2d'),
      ph: el.querySelector('.phosphor').getContext('2d'),
      ov: el.querySelector('.overlay').getContext('2d'),
      angle: 0, raf: null, targets: [], drawnBg: false,
    };
    loadAirports().then(() => { el._ctx.drawnBg = false; });
  },
  render(el, cfg, state) {
    const c = el._ctx;
    if (!c.drawnBg && state.receiver) {
      drawBackground(c.bg, cfg, state.receiver);
      c.drawnBg = true;
    }
    // painted merkt sich, ob die Keule dieses Ziel schon ueberstrichen hat.
    // Die Zielliste wird jede Sekunde neu gebaut -- ohne Uebernahme des
    // Merkers verschwaenden alle Labels bei jedem Datenabruf und kaemen erst
    // beim naechsten Sweep zurueck. Das saehe am Panel wie ein Flackern aus.
    const wasPainted = new Map((c.targets || []).map(t => [t.hex, t.painted]));
    c.targets = state.receiver ? state.aircraft
      .filter(a => typeof a.lat === 'number' && typeof a.lon === 'number')
      .map(a => {
        const nm = haversineNm(state.receiver.lat, state.receiver.lon, a.lat, a.lon);
        return {
          hex: a.hex, nm,
          brg: bearingDeg(state.receiver.lat, state.receiver.lon, a.lat, a.lon),
          callsign: formatCallsign(a.flight), fl: flightLevel(a.alt_baro),
          squawk: a.squawk || null, gs: a.gs, track: a.track,
          heavy: a.category === 'A5', emergency: isEmergency(a),
          painted: wasPainted.get(a.hex) || false,
        };
      })
      .filter(t => t.nm <= cfg.radar.range_nm) : [];

    // Die Animation laeuft nur, solange die Seite sichtbar ist. Eine
    // unsichtbare Canvas zu rendern ist auf diesem Geraet auch eine
    // thermische Verschwendung.
    const visible = el.classList.contains('active');
    if (visible && !c.raf) c.raf = requestAnimationFrame(() => step(el, cfg));
    if (!visible && c.raf) { cancelAnimationFrame(c.raf); c.raf = null; }
  },
});

function step(el, cfg) {
  const c = el._ctx;
  if (!el.classList.contains('active')) { c.raf = null; return; }
  const dt = 1 / 30;
  const prev = c.angle;
  c.angle = (c.angle + 360 * dt / cfg.radar.sweep_s) % 360;

  // Phosphor: die ganze Flaeche leicht abdunkeln statt jedes Blip einzeln zu
  // verrechnen -- das ist die klassische und billige Loesung.
  const fade = 1 - Math.exp(-dt / cfg.radar.decay_s * 3);
  c.ph.globalCompositeOperation = 'destination-out';
  c.ph.fillStyle = `rgba(0,0,0,${fade.toFixed(3)})`;
  c.ph.fillRect(0, 0, SIZE, SIZE);
  c.ph.globalCompositeOperation = 'source-over';

  c.ph.save();
  c.ph.translate(CENTER, CENTER);
  const a = c.angle * Math.PI / 180;
  c.ph.strokeStyle = COL.sweep;
  c.ph.lineWidth = 2;
  c.ph.beginPath();
  c.ph.moveTo(0, 0);
  c.ph.lineTo(R * Math.sin(a), -R * Math.cos(a));
  c.ph.stroke();

  // Ein Blip wird gesetzt, wenn die Keule seinen Azimut in diesem Bild
  // ueberstreicht -- die Keule ist der Verschluss (siehe Spec 6.1).
  for (const t of c.targets) {
    const passed = prev <= c.angle
      ? (t.brg > prev && t.brg <= c.angle)
      : (t.brg > prev || t.brg <= c.angle);
    if (!passed) continue;
    const p = projectToCanvas(t.nm, t.brg, cfg.radar.range_nm, R);
    c.ph.fillStyle = t.emergency ? COL.emergency : COL.blip;
    c.ph.beginPath();
    c.ph.arc(p.x, p.y, t.heavy ? 5 : 3.5, 0, Math.PI * 2);
    c.ph.fill();
    t.painted = true;
  }
  c.ph.restore();

  drawOverlay(c.ov, cfg, c.targets);
  c.raf = requestAnimationFrame(() => step(el, cfg));
}

function drawOverlay(ctx, cfg, targets) {
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.save();
  ctx.translate(CENTER, CENTER);
  ctx.font = '13px ui-monospace, monospace';
  for (const t of targets) {
    if (!t.painted) continue;          // noch nicht ueberstrichen
    const p = projectToCanvas(t.nm, t.brg, cfg.radar.range_nm, R);
    if (typeof t.gs === 'number' && typeof t.track === 'number') {
      // Track-Vektor: wo das Ziel in leader_s Sekunden waere.
      const len = t.gs * (cfg.radar.leader_s / 3600) / cfg.radar.range_nm * R;
      const dir = t.track * Math.PI / 180;
      ctx.strokeStyle = t.emergency ? COL.emergency : COL.label;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + len * Math.sin(dir), p.y - len * Math.cos(dir));
      ctx.stroke();
    }
    ctx.fillStyle = t.emergency ? COL.emergency : COL.label;
    const lines = [];
    if (cfg.radar.labels.includes('callsign')) lines.push(t.callsign || '——');
    const second = [];
    if (cfg.radar.labels.includes('fl')) second.push(t.fl);
    if (cfg.radar.labels.includes('squawk') && t.squawk) second.push(t.squawk);
    if (second.length) lines.push(second.join(' '));
    if (t.heavy) lines[0] += ' H';
    lines.forEach((line, i) => ctx.fillText(line, p.x + 9, p.y + 5 + i * 15));
  }
  ctx.restore();
}
```

Dazu in `console/css/console.css` ergänzen:

```css
.radar-wrap { position: relative; width: 620px; height: 620px; flex: 0 0 620px; }
.radar-wrap canvas { position: absolute; inset: 0; }
.radar-side { flex: 1; display: flex; flex-direction: column; gap: 14px; }
```

- [ ] **Schritt 4: Test laufen lassen, Bestehen bestätigen**

Ausführen: `node --test tests/test_radar_geometry.mjs`
Erwartet: PASS, 4 Tests.

- [ ] **Schritt 5: Den Projektionstest absichtlich rot machen**

In `projectToCanvas` `y: -r * Math.cos(a)` durch `y: r * Math.cos(a)` ersetzen — der
klassische Vorzeichenfehler, der ein Radarbild spiegelt, ohne es kaputt aussehen zu
lassen. Tests laufen lassen, bestätigen daß „Norden liegt oben" scheitert. Zurückändern.

- [ ] **Schritt 6: Am Panel ansehen — mit gesichertem Cache**

```bash
rsync -a --exclude .git ./ adsapp01:/tmp/adsb-console/
ssh -t adsapp01 'cd /tmp/adsb-console && sudo cp -r console/. /var/www/html/atc/ &&
sudo chown -R atc:atc /var/www/html/atc && sudo systemctl restart atc-console.service'
```

Vor jedem Urteil über das Bild sicherstellen, daß die geladene Fassung die gebaute ist —
Layout-Kritik an einer gecachten Datei war beim Schwesterprojekt ein Beinahe-Fehlurteil:

```bash
ssh adsapp01 'curl -s http://127.0.0.1/atc/js/pages/radar.js | md5sum'
md5 -q console/js/pages/radar.js
```

Erwartet: identische Prüfsummen.

Am Panel prüfen: Dreht der Sweep? Erscheinen Blips beim Überstreichen und verglühen sie?
Steht EDDF südwestlich der Mitte mit erkennbaren Bahnen? Zeigen die Labels Callsign, FL
und Squawk?

- [ ] **Schritt 7: Commit**

```bash
git add console/js/pages/radar.js console/css/console.css tests/test_radar_geometry.mjs
git commit -m "Radarseite: Sweep, Phosphor, Blips, Flugplaetze"
```

---

## Aufgabe 10: Board — Zielliste

**Dateien:**
- Anlegen: `console/js/pages/board.js`
- Test: `tests/test_board.mjs`

**Schnittstellen:**
- Verbraucht: `geo.js` (Aufgabe 1), `registerPage` (Aufgabe 7).
- Liefert: `splitTargets(aircraft, receiver) -> {positioned, unpositioned}` (exportiert
  und getestet); registrierte Seite `board`.

- [ ] **Schritt 1: Den scheiternden Test schreiben**

```javascript
// tests/test_board.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { splitTargets } from '../console/js/pages/board.js';

const RX = { lat: 12.0, lon: 34.0 };      // erfundene Empfaengerposition

test('Ziele ohne Position gehen nicht verloren', () => {
  // Gemessen: 13 von 26 Zielen hatten keine Position. Sie wegzulassen hiesse,
  // die Haelfte des Empfangs zu verschweigen.
  const { positioned, unpositioned } = splitTargets([
    { hex: 'a', lat: 12.1, lon: 34.0, flight: 'MIT1    ' },
    { hex: 'b', flight: 'OHNE1   ', alt_baro: 12000 },
    { hex: 'c' },
  ], RX);
  assert.equal(positioned.length, 1);
  assert.equal(unpositioned.length, 2);
});

test('nach Entfernung sortiert, das naechste zuerst', () => {
  const { positioned } = splitTargets([
    { hex: 'fern', lat: 13.0, lon: 34.0 },
    { hex: 'nah',  lat: 12.1, lon: 34.0 },
  ], RX);
  assert.deepEqual(positioned.map(t => t.hex), ['nah', 'fern']);
});

test('ohne Empfaengerposition faellt alles in die zweite Liste', () => {
  const { positioned, unpositioned } = splitTargets(
    [{ hex: 'a', lat: 12.1, lon: 34.0 }], null);
  assert.equal(positioned.length, 0);
  assert.equal(unpositioned.length, 1);
});

test('leere Eingabe ergibt zwei leere Listen', () => {
  const r = splitTargets([], RX);
  assert.deepEqual(r.positioned, []);
  assert.deepEqual(r.unpositioned, []);
});
```

- [ ] **Schritt 2: Test laufen lassen, Scheitern bestätigen**

Ausführen: `node --test tests/test_board.mjs`
Erwartet: FAIL — `Cannot find module .../console/js/pages/board.js`.

- [ ] **Schritt 3: Implementierung schreiben**

```javascript
// console/js/pages/board.js
import { haversineNm, bearingDeg, formatBearing, formatCallsign, flightLevel, isEmergency }
  from '../geo.js';
import { registerPage } from '../console.js';

export function splitTargets(aircraft, receiver) {
  const positioned = [], unpositioned = [];
  for (const a of aircraft || []) {
    const hasPos = receiver &&
      typeof a.lat === 'number' && typeof a.lon === 'number';
    const base = {
      hex: a.hex,
      callsign: formatCallsign(a.flight),
      fl: flightLevel(a.alt_baro),
      gs: typeof a.gs === 'number' ? Math.round(a.gs) : null,
      track: typeof a.track === 'number' ? a.track : null,
      rate: typeof a.baro_rate === 'number' ? a.baro_rate : null,
      heavy: a.category === 'A5',
      emergency: isEmergency(a),
      squawk: a.squawk || null,
    };
    if (hasPos) {
      positioned.push({ ...base,
        nm: haversineNm(receiver.lat, receiver.lon, a.lat, a.lon),
        brg: bearingDeg(receiver.lat, receiver.lon, a.lat, a.lon) });
    } else {
      unpositioned.push(base);
    }
  }
  positioned.sort((x, y) => x.nm - y.nm);
  return { positioned, unpositioned };
}

function arrow(rate) {
  if (rate == null || Math.abs(rate) < 100) return '→';
  return rate > 0 ? '↑' : '↓';
}

registerPage({
  id: 'board',
  title: 'Ziele',
  ageSource: 'aircraft',
  mount(el) { el.innerHTML = '<div class="board value"></div>'; },
  render(el, cfg, state) {
    const { positioned, unpositioned } = splitTargets(state.aircraft, state.receiver);
    const root = el.querySelector('.board');
    if (!positioned.length && !unpositioned.length) {
      // Nachts ist null Ziele der Normalfall, kein Defekt.
      root.innerHTML = `<div class="empty">KEINE ZIELE IN REICHWEITE
        <div class="empty-sub">Nachrichtenrate: ${msgRate(state)} /s</div></div>`;
      return;
    }
    const rows = positioned.slice(0, 12).map(t => `
      <tr class="${t.emergency ? 'emg' : ''}">
        <td>${t.callsign || '——'}${t.heavy ? ' <span class="hv">H</span>' : ''}</td>
        <td>${t.fl}</td>
        <td>${t.gs ?? '—'}</td>
        <td>${formatBearing(t.track)}</td>
        <td>${t.nm.toFixed(1)}</td>
        <td>${formatBearing(t.brg)}</td>
        <td>${arrow(t.rate)}</td>
        <td>${t.emergency ? t.squawk : ''}</td>
      </tr>`).join('');
    root.innerHTML = `
      <table class="tbl">
        <thead><tr><th>CALLSIGN</th><th>FL</th><th>GS</th><th>TRACK</th>
                   <th>ENTF</th><th>PEIL</th><th></th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="nopos">ohne Position: ${unpositioned.length}
        <span class="nopos-list">${unpositioned.slice(0, 10)
          .map(t => `${t.callsign || t.hex} ${t.fl}`).join(' · ')}</span>
      </div>`;
  },
});

function msgRate(state) {
  const s = state.stats && state.stats.last1min;
  if (!s) return '—';
  const span = s.end - s.start;
  return span > 0 ? Math.round(s.messages / span) : '—';
}
```

Ergänzung in `console/css/console.css`:

```css
.board { flex: 1; display: flex; flex-direction: column; }
.tbl { width: 100%; border-collapse: collapse; font-size: 26px;
       font-variant-numeric: tabular-nums; }
.tbl th { font-size: 16px; letter-spacing: .12em; color: #4e9c6a;
          text-align: right; padding: 0 14px 8px; font-weight: 600; }
.tbl th:first-child, .tbl td:first-child { text-align: left; }
.tbl td { text-align: right; padding: 5px 14px; }
.tbl tr.emg td { color: #ff5a5a; }
.hv { font-size: 16px; color: #f0b429; }
.nopos { margin-top: auto; padding-top: 10px; border-top: 1px solid #14361f;
         font-size: 20px; color: #4e9c6a; }
.nopos-list { color: #2f6b45; margin-left: 12px; font-size: 17px; }
.empty { display: flex; flex-direction: column; align-items: center;
         justify-content: center; flex: 1; font-size: 34px; letter-spacing: .1em;
         color: #3a8f57; }
.empty-sub { font-size: 20px; margin-top: 14px; color: #2f6b45; }
```

- [ ] **Schritt 4: Test laufen lassen, Bestehen bestätigen**

Ausführen: `node --test tests/test_board.mjs`
Erwartet: PASS, 4 Tests.

- [ ] **Schritt 5: Commit**

```bash
git add console/js/pages/board.js console/css/console.css tests/test_board.mjs
git commit -m "Board: Zielliste samt der Ziele ohne Position"
```

---

## Aufgabe 11: Statistikseite

**Dateien:**
- Anlegen: `console/js/pages/stats.js`
- Test: `tests/test_stats.mjs`

**Schnittstellen:**
- Verbraucht: `registerPage` (Aufgabe 7).
- Liefert: `summarise(statsDoc) -> {windows: [{label, msgPerS, accepted, strong, peak, signal, noise}], gain, tracks}`
  (exportiert und getestet); registrierte Seite `stats`.

- [ ] **Schritt 1: Den scheiternden Test schreiben**

```javascript
// tests/test_stats.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { summarise } from '../console/js/pages/stats.js';

// Aufbau und Groessenordnung stammen aus der Messung am Geraet.
const DOC = {
  last1min:  { start: 0, end: 60,  messages: 10000,
    local: { accepted: [6000, 300], signal: -13.5, noise: -27.4,
             peak_signal: -1.8, strong_signals: 20, gain_db: 36.4 },
    tracks: { all: 31, single_message: 19, unreliable: 19 } },
  last5min:  { start: 0, end: 300, messages: 50606,
    local: { accepted: [30041, 1440], signal: -13.5, noise: -27.4,
             peak_signal: -1.8, strong_signals: 102, gain_db: 36.4 },
    tracks: { all: 31, single_message: 19, unreliable: 19 } },
  last15min: { start: 0, end: 900, messages: 150000,
    local: { accepted: [90000, 4300], signal: -13.6, noise: -27.4,
             peak_signal: -1.8, strong_signals: 300, gain_db: 36.4 },
    tracks: { all: 40, single_message: 22, unreliable: 22 } },
};

test('Nachrichtenrate aus Zaehler und Zeitspanne', () => {
  const s = summarise(DOC);
  const w5 = s.windows.find(w => w.label === '5 min');
  assert.equal(w5.msgPerS, 169);            // 50606 / 300
});

test('drei Fenster in fester Reihenfolge', () => {
  assert.deepEqual(summarise(DOC).windows.map(w => w.label), ['1 min', '5 min', '15 min']);
});

test('akzeptierte Nachrichten summieren ueber die Korrekturstufen', () => {
  const w5 = summarise(DOC).windows.find(w => w.label === '5 min');
  assert.equal(w5.accepted, 31481);          // 30041 + 1440
});

test('fehlendes Dokument ergibt leere Auswertung statt Absturz', () => {
  const s = summarise(null);
  assert.deepEqual(s.windows, []);
  assert.equal(s.gain, null);
});

test('einzelnes fehlendes Fenster wird uebersprungen', () => {
  const s = summarise({ last5min: DOC.last5min });
  assert.equal(s.windows.length, 1);
});

test('Zeitspanne null erzeugt keine Division durch null', () => {
  const s = summarise({ last1min: { start: 5, end: 5, messages: 10,
    local: { accepted: [1, 0] }, tracks: {} } });
  assert.equal(s.windows[0].msgPerS, null);
});
```

- [ ] **Schritt 2: Test laufen lassen, Scheitern bestätigen**

Ausführen: `node --test tests/test_stats.mjs`
Erwartet: FAIL — `Cannot find module .../console/js/pages/stats.js`.

- [ ] **Schritt 3: Implementierung schreiben**

```javascript
// console/js/pages/stats.js
import { registerPage } from '../console.js';

const WINDOWS = [['last1min', '1 min'], ['last5min', '5 min'], ['last15min', '15 min']];

export function summarise(doc) {
  if (!doc || typeof doc !== 'object') return { windows: [], gain: null, tracks: null };
  const windows = [];
  let gain = null, tracks = null;
  for (const [key, label] of WINDOWS) {
    const w = doc[key];
    if (!w || !w.local) continue;
    const span = w.end - w.start;
    const acc = Array.isArray(w.local.accepted)
      ? w.local.accepted.reduce((a, b) => a + b, 0) : null;
    windows.push({
      label,
      msgPerS: span > 0 ? Math.round(w.messages / span) : null,
      accepted: acc,
      strong: w.local.strong_signals ?? null,
      peak: w.local.peak_signal ?? null,
      signal: w.local.signal ?? null,
      noise: w.local.noise ?? null,
    });
    if (w.local.gain_db != null) gain = w.local.gain_db;
    if (w.tracks) tracks = w.tracks;
  }
  return { windows, gain, tracks };
}

const n = (v, d = 1) => (typeof v === 'number' ? v.toFixed(d) : '—');

registerPage({
  id: 'stats',
  title: 'Empfang',
  ageSource: 'stats',
  mount(el) { el.innerHTML = '<div class="stats value"></div>'; },
  render(el, cfg, state) {
    const s = summarise(state.stats);
    const root = el.querySelector('.stats');
    if (!s.windows.length) {
      root.innerHTML = '<div class="empty">KEINE STATISTIK</div>';
      return;
    }
    const row = (label, pick, digits) => `
      <tr><th>${label}</th>${s.windows.map(w =>
        `<td>${typeof pick(w) === 'number' ? pick(w).toFixed(digits) : '—'}</td>`).join('')}</tr>`;
    root.innerHTML = `
      <table class="tbl stats-tbl">
        <thead><tr><th></th>${s.windows.map(w => `<th>${w.label}</th>`).join('')}</tr></thead>
        <tbody>
          ${row('Nachrichten /s', w => w.msgPerS, 0)}
          ${row('akzeptiert', w => w.accepted, 0)}
          ${row('starke Signale', w => w.strong, 0)}
          ${row('Peak dBFS', w => w.peak, 1)}
          ${row('Signal dBFS', w => w.signal, 1)}
          ${row('Rauschen dBFS', w => w.noise, 1)}
        </tbody>
      </table>
      <div class="stats-foot">
        <span>Verstaerkung <b>${n(s.gain)} dB</b></span>
        <span>Tracks <b>${s.tracks?.all ?? '—'}</b></span>
        <span>davon single-message <b>${s.tracks?.single_message ?? '—'}</b></span>
        <span>unreliable <b>${s.tracks?.unreliable ?? '—'}</b></span>
      </div>`;
  },
});
```

Ergänzung in `console/css/console.css`:

```css
.stats { flex: 1; display: flex; flex-direction: column; }
.stats-tbl th:first-child { text-align: left; font-size: 20px; color: #8fe6ab;
                            text-transform: none; letter-spacing: 0; }
.stats-foot { margin-top: auto; padding-top: 12px; border-top: 1px solid #14361f;
              display: flex; gap: 40px; font-size: 20px; color: #4e9c6a; }
.stats-foot b { color: #b8f5cc; }
```

- [ ] **Schritt 4: Test laufen lassen, Bestehen bestätigen**

Ausführen: `node --test tests/test_stats.mjs`
Erwartet: PASS, 6 Tests.

- [ ] **Schritt 5: Alle Tests zusammen laufen lassen**

Ausführen: `node --test tests/*.mjs && python3 -m unittest discover -s tests -v`
Erwartet: 34 JavaScript-Tests (11 geo, 6 config, 3 airports, 4 radar, 4 board, 6 stats)
und 36 Python-Tests, alle grün.

- [ ] **Schritt 6: Commit**

```bash
git add console/js/pages/stats.js console/css/console.css tests/test_stats.mjs
git commit -m "Statistikseite: Nachrichtenrate, Pegel, Track-Guete"
```

---

## Aufgabe 12: Abnahme am Gerät

**Dateien:**
- Anlegen: `docs/abnahme/2026-07-27-stufe-1.md`
- Ändern: `README.md` (Installationsabschnitt vervollständigen)

**Schnittstellen:**
- Verbraucht: alles Vorherige.
- Liefert: ein Abnahmeprotokoll mit Meßwerten, kein Häkchen ohne Beleg.

- [ ] **Schritt 1: Vollständig neu installieren**

Nicht auf den gewachsenen Zustand der letzten Aufgaben verlassen — der Installationsweg
selbst gehört geprüft:

```bash
rsync -a --exclude .git ./ adsapp01:/tmp/adsb-console/
ssh -t adsapp01 'cd /tmp/adsb-console && sudo ./install-console.sh --rotate <gemessener Wert> --output DSI-1'
```

Erwartet: Durchlauf ohne Fehler, am Ende die 200-Meldung für `http://127.0.0.1/atc/`.

- [ ] **Schritt 2: Den Installer ein zweites Mal laufen lassen**

Ein Wiederholungslauf ist der häufigste reale Fall und der am seltensten geprüfte.

Erwartet: erneut fehlerfrei, und — ausdrücklich zu kontrollieren — die Meldung
„console.json existiert bereits". Danach prüfen, daß eine zuvor am Gerät geänderte
`console.json` unverändert ist.

- [ ] **Schritt 3: Kaputte Konfiguration**

```bash
ssh adsapp01 'sudo cp /var/www/html/atc/console.json /tmp/console.json.bak
echo "{ das ist kein JSON" | sudo tee /var/www/html/atc/console.json > /dev/null
sudo systemctl restart atc-console.service'
```

Erwartet **am Panel**: Die Konsole läuft mit Vorgabewerten. Kein weißer Schirm, keine
Fehlermeldung. Danach dasselbe mit allen Seiten auf `false`, mit `range_nm: 0` und mit
einem unbekannten Seitennamen. Anschließend zurückspielen:

```bash
ssh adsapp01 'sudo cp /tmp/console.json.bak /var/www/html/atc/console.json &&
sudo systemctl restart atc-console.service'
```

- [ ] **Schritt 4: Notfall-Squawk erzeugen — und wieder entwarnen**

Nicht in `/run/dump1090-fa/` schreiben — das ist der produktive Datenpfad. Stattdessen
eine präparierte Kopie danebenlegen und das Frontend im Testmodus dorthin zeigen lassen:

```bash
ssh adsapp01 'python3 -c "
import json
d = json.load(open(\"/run/dump1090-fa/aircraft.json\"))
for a in d[\"aircraft\"]:
    if \"lat\" in a:
        a[\"squawk\"] = \"7700\"; break
json.dump(d, open(\"/tmp/emergency.json\",\"w\"))"
sudo install -m 0644 -o atc -g atc /tmp/emergency.json /var/www/html/atc/data/emergency.json'
```

Im Browser des Entwicklungsrechners `http://adsapp01/atc/?source=data/emergency.json`
öffnen (dafür liest `data.js` einen `source`-Parameter, falls vorhanden — sonst den
Regelpfad).

Erwartet: rotes Blip auf dem Radar, rote Zeile im Board mit `7700`.
**Und der Rückweg:** dieselbe Datei ohne den Sonder-Squawk erzeugen, neu laden,
bestätigen daß die Markierung **verschwindet**. Eine Alarmregel ist erst geprüft, wenn
sie auch wieder entwarnt hat.

- [ ] **Schritt 5: Daemon töten und wiederbeleben**

```bash
ssh adsapp01 'sudo systemctl stop atc-daemon.service'
```

Erwartet am Panel: Radar, Board und Statistik laufen unverändert weiter — sie hängen
direkt an dump1090. Anschließend wieder starten und bestätigen, daß `range.json` erneut
aktualisiert wird und die Rekorde noch da sind.

- [ ] **Schritt 6: Leerzustand herstellen**

Entweder nachts hinsehen oder eine leere Zielliste unterschieben (`{"now": ..., "aircraft": []}`
als Testquelle wie in Schritt 4).

Erwartet: „KEINE ZIELE IN REICHWEITE" mit weiterlaufender Nachrichtenrate — der
Unterschied zwischen „nichts fliegt" und „Empfänger tot" muß ablesbar bleiben.

- [ ] **Schritt 7: Netzstecker ziehen**

Das LAN-Kabel an `adsapp01` abziehen, fünf Minuten laufen lassen.

Erwartet: Die Konsole zeigt unverändert weiter (die Daten kommen von 127.0.0.1). Danach
wieder einstecken. **Achtung:** Damit fällt auch der SSH-Zugang weg — den Test am Panel
beobachten, nicht über die Leitung, die man gerade trennt.

- [ ] **Schritt 8: Reboot und Wisch**

```bash
ssh adsapp01 'sudo reboot'
```

Erwartet: Nach dem Hochfahren erscheint die Konsole ohne Zutun; kein
„Seiten wiederherstellen?"-Dialog. Dann am Panel wischen: Die Seite muß blättern und
Chromium darf **nicht** zurücknavigieren. Eine Minute warten und bestätigen, daß die
Rotation von der sichtbaren Seite aus wieder aufnimmt.

- [ ] **Schritt 9: Wärme über eine Stunde**

```bash
ssh adsapp01 'for i in $(seq 1 120); do
  printf "%s;%s;%s;%s\n" "$(date +%T)" "$(vcgencmd measure_temp)" "$(vcgencmd get_throttled)" \
    "$(python3 -c "import json;print(json.load(open(\"/run/dump1090-fa/stats.json\"))[\"last5min\"][\"local\"][\"samples_dropped\"])")"
  sleep 30
done' | tee /tmp/claude-501/*/scratchpad/abnahme-waerme.csv
```

Erwartet: `samples_dropped` bleibt 0, `get_throttled` bleibt `0x0`, Temperatur unter
72 °C — dieselben Grenzen wie beim Spike, jetzt aber mit der echten Konsole und über die
volle Karussellrotation.

- [ ] **Schritt 10: Protokoll schreiben und Commit**

`docs/abnahme/2026-07-27-stufe-1.md` mit jedem Schritt, dem beobachteten Ergebnis und
den Meßwerten. Was nicht geprüft werden konnte, wird als **offen** notiert, nicht als
erledigt. `README.md` um den Installationsabschnitt mit dem gemessenen Rotationswert
ergänzen.

```bash
git add docs/abnahme/2026-07-27-stufe-1.md README.md
git commit -m "Abnahmeprotokoll Stufe 1"
```

- [ ] **Schritt 11: Pull Request**

```bash
git push -u origin session/2026-07-27-atc-konsole
gh pr create --title "ATC-Konsole Stufe 1: Daemon, Kiosk, Radar, Board, Statistik" \
  --body "Setzt docs/specs/2026-07-27-atc-konsole-design.md um, Stufen 0 und 1.

Abnahme am Geraet: docs/abnahme/2026-07-27-stufe-1.md
Mess-Spike: docs/messungen/2026-07-27-canvas-spike.md

Stufe 2 (Einzelziel, System, Hoehenprofil) und Stufe 3 (Polar) folgen in einem
eigenen Plan."
```

---

## Nach dem Merge

Aus dem Bootstrap, gehört nicht in dieses Repo, aber zum Abschluß der Arbeit:

- Stand nach `04-projects/adsb-monitoring/` im Vault nachziehen.
- Den veralteten Hardware-Block im dortigen README korrigieren: Es steht Bookworm mit
  Kernel 6.1 dort, tatsächlich läuft Debian 13 (trixie) mit 6.18 von einer USB-SSD.
- **Ebenfalls im README korrigieren:** Die Benutzertabelle behauptet, `ssh adsapp01`
  melde sich als `hhalfpap` an. Gemessen: Es ist `pi`, und einen Benutzer `hhalfpap`
  gibt es auf dem Gerät nicht.
- Side-Quest-Eintrag in `03-strategy/current-priorities.md` schließen.
