import json
import os
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
    def test_liest_lat_und_lon(self):
        # Erfundene Koordinaten -- die echte Position gehoert nicht ins Repo.
        with tempfile.NamedTemporaryFile("w", suffix=".conf", delete=False) as f:
            f.write('# Kommentar\nRECEIVER_OPTIONS="--device 0"\n'
                    'LAT=12.3456\nLON=-4.5678\n')
            path = f.name
        try:
            self.assertEqual(d.read_receiver_position(path), (12.3456, -4.5678))
        finally:
            os.unlink(path)

    def test_fehlende_datei_ist_ein_klarer_fehler(self):
        with self.assertRaises(FileNotFoundError):
            d.read_receiver_position("/nicht/vorhanden/dump1090-fa")

    def test_datei_ohne_position_ist_ein_klarer_fehler(self):
        with tempfile.NamedTemporaryFile("w", delete=False) as f:
            f.write("RECEIVER_OPTIONS=\n")
            path = f.name
        try:
            with self.assertRaises(ValueError):
                d.read_receiver_position(path)
        finally:
            os.unlink(path)


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
