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
