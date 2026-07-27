import json
import stat
import sys
import tempfile
import time
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

    def test_datei_ist_fuer_fremde_prozesse_lesbar(self):
        # Der Zweck dieser Dateien ist, dass ein ANDERER Prozess sie liest
        # (lighttpd als www-data). mkstemp legt mit 0600 an und os.replace
        # behaelt den Modus -- ohne chmod antwortet der Webserver mit 403,
        # obwohl die Datei einwandfrei geschrieben wurde. Genau so am
        # 27.07. auf dem Geraet aufgetreten; kein Test hatte es gefangen,
        # weil alle als derselbe Benutzer zuruecklesen.
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "out.json"
            d.atomic_write_json(p, {"a": 1})
            self.assertEqual(stat.S_IMODE(p.stat().st_mode), 0o644)


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
        # Die Datei wird nie als Ganzes ungueltig, weil ein Teil fehlt.
        self.assertIsInstance(s["load"], list)
        # mem_total_mb ist auf dem Zielgeraet eine Zahl, auf einem Rechner
        # ohne /proc None -- aber NIEMALS 0. Eine 0 saehe aus wie ein
        # gemessener Wert und meldete ein kerngesundes Geraet.
        self.assertTrue(s["mem_total_mb"] is None or s["mem_total_mb"] > 0)
        self.assertTrue(s["uptime_s"] is None or s["uptime_s"] > 0)


class ProcParser(unittest.TestCase):
    # Echtes Format, am 27.07. von adsapp01 abgenommen -- nicht erfunden.
    MEMINFO = ("MemTotal:        1887940 kB\n"
               "MemFree:          713912 kB\n"
               "MemAvailable:    1577040 kB\n"
               "Buffers:           95436 kB\n"
               "Cached:           831496 kB\n")

    def test_meminfo(self):
        total, used = d.parse_meminfo(self.MEMINFO)
        self.assertEqual(total, 1843)          # 1887940 kB / 1024
        self.assertEqual(used, 1843 - 1540)    # MemAvailable 1577040 kB / 1024

    def test_meminfo_ohne_memavailable_faellt_auf_memfree_zurueck(self):
        total, used = d.parse_meminfo("MemTotal: 1887940 kB\nMemFree: 713912 kB\n")
        self.assertEqual(total, 1843)
        self.assertEqual(used, 1843 - 697)

    def test_meminfo_ohne_memtotal_ist_unbekannt_nicht_null(self):
        self.assertEqual(d.parse_meminfo("Buffers: 95436 kB\n"), (None, None))

    def test_meminfo_muell(self):
        self.assertEqual(d.parse_meminfo("voelliger Unsinn\n"), (None, None))

    def test_uptime(self):
        self.assertEqual(d.parse_uptime("250613.94 928885.98\n"), 250613)

    def test_uptime_muell_ist_unbekannt_nicht_null(self):
        self.assertIsNone(d.parse_uptime(""))
        self.assertIsNone(d.parse_uptime("keine Zahl\n"))


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


if __name__ == "__main__":
    unittest.main()
