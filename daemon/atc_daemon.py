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


# Die Parser sind von ihrer Quelle getrennt. Nicht aus Stilgruenden: Der
# Entwicklungsrechner ist ein Mac und hat kein /proc. Waeren Lesen und
# Parsen verschmolzen, pruefte der Test dort ausschliesslich den
# Fehlerpfad -- ein Pruefmittel, das nur einen Teil der Zielumgebung
# teilt, pruefte sich selbst. So laeuft der Parser ueberall gegen echtes
# Format.

def parse_meminfo(text: str) -> tuple[int | None, int | None]:
    """(total_mb, used_mb) aus dem Inhalt von /proc/meminfo."""
    mem = {}
    for line in text.splitlines():
        k, _, v = line.partition(":")
        try:
            mem[k] = int(v.split()[0])          # kB
        except (IndexError, ValueError):
            continue
    if "MemTotal" not in mem:
        return None, None
    total_mb = mem["MemTotal"] // 1024
    avail = mem.get("MemAvailable", mem.get("MemFree"))
    if avail is None:
        return total_mb, None
    return total_mb, total_mb - avail // 1024


def parse_uptime(text: str) -> int | None:
    try:
        return int(float(text.split()[0]))
    except (IndexError, ValueError):
        return None


# Jede dieser Quellen liefert None, wenn sie nicht lesbar ist -- NIE eine 0.
# Eine 0 saehe aus wie ein gemessener Wert: "0 MB von 0 MB" und ein
# Speicherbalken auf 0 % melden ein kerngesundes Geraet, waehrend in
# Wahrheit gar nichts gelesen werden konnte. Die Anzeige stellt None als
# Gedankenstrich dar.
def _read_or_none(path: str):
    try:
        return Path(path).read_text()
    except OSError:
        return None


def build_system_json(throttled_raw, vcgen_available: bool,
                      clock_hz=None, volts=None) -> dict:
    meminfo = _read_or_none("/proc/meminfo")
    total_mb, used_mb = parse_meminfo(meminfo) if meminfo else (None, None)
    uptime_text = _read_or_none("/proc/uptime")
    try:
        st = os.statvfs("/")
        disk_total = round(st.f_blocks * st.f_frsize / 1e9, 1)
        disk_used = round(disk_total - st.f_bavail * st.f_frsize / 1e9, 1)
    except OSError:
        disk_total = disk_used = None
    temp_text = _read_or_none("/sys/class/thermal/thermal_zone0/temp")
    try:
        temp = int(temp_text) / 1000 if temp_text else None
    except ValueError:
        temp = None
    services = {}
    for name in SERVICES:
        try:
            r = subprocess.run(["systemctl", "is-active", name],
                               capture_output=True, text=True)
            services[name] = r.stdout.strip() or "unknown"
        except (OSError, subprocess.SubprocessError):
            services[name] = "unknown"
    return {
        "cpu_temp_c": temp,
        "load": list(os.getloadavg()) if hasattr(os, 'getloadavg') else [0.0, 0.0, 0.0],
        "cpu_count": os.cpu_count(),
        "mem_total_mb": total_mb,
        "mem_used_mb": used_mb,
        "disk_total_gb": disk_total,
        "disk_used_gb": disk_used,
        "uptime_s": parse_uptime(uptime_text) if uptime_text else None,
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
