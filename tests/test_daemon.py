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
