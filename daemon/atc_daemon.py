#!/usr/bin/env python3
"""ATC-Konsole: Schreiber-Daemon.

Liest die JSON-Ausgaben von dump1090-fa, fuehrt Reichweiten-Rekorde in SQLite
und schreibt system.json und range.json in den lighttpd-Docroot. Nur
Standardbibliothek -- auf dem Geraet gibt es kein venv und soll keines geben.
"""
from __future__ import annotations

import json
import math
import os
import re
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


def read_receiver_position(path: str = "/etc/default/dump1090-fa") -> tuple[float, float]:
    """Die exakte Position des Empfaengers vom Geraet lesen.

    Bleibt im Speicher. Sie wird nie in eine Ausgabedatei geschrieben und
    gehoert nicht ins Repo -- receiver.json fuehrt sie ohnehin gerundet, und
    das Frontend benutzt jene gerundete Fassung.
    """
    text = Path(path).read_text()
    lat = re.search(r"^\s*LAT=([-\d.]+)", text, re.MULTILINE)
    lon = re.search(r"^\s*LON=([-\d.]+)", text, re.MULTILINE)
    if not lat or not lon:
        raise ValueError(f"{path} enthaelt kein LAT/LON")
    return float(lat.group(1)), float(lon.group(1))


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
