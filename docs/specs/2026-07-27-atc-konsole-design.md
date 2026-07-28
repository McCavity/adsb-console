# ATC-Konsole für adsapp01 — Entwurf

> Datum: 2026-07-27
> Status: Stufe 1 umgesetzt und seit 27.07.2026 auf dem Gerät in Betrieb (Abnahme: `docs/abnahme/`)
> Gerät: `adsapp01` — Raspberry Pi 4 Model B Rev 1.5 mit 7"-DSI-Touchpanel
> Vorlage: die Wetterkonsole auf dwsapp01 (`jeelink-davis`, 25.07.2026)

## 1. Ziel

Am 7"-Panel von `adsapp01` läuft heute nur der Text-Login (`agetty`). An seine Stelle
tritt eine **ATC-Konsole**: eine Kiosk-Anzeige dessen, was der eigene ADS-B-Empfänger
gerade sieht — mit einem Radarschirm als Hauptseite und sechs weiteren Seiten in einem
Karussell.

Die Konsole ist ein **Leser**. Der ADS-B-Stack (`dump1090-fa`, `piaware`, `fr24feed`)
bleibt unangetastet; der Feed ist der Zweck des Geräts, die Anzeige ist es nicht.

## 2. Gemessene Randbedingungen

Alle Zahlen am 27.07.2026 nachmittags read-only am Gerät erhoben, nicht angenommen.
Sie tragen die Entwurfsentscheidungen und gehören deshalb hierher.

### 2.1 Gerät und Panel

| Eigenschaft | Wert | Quelle |
|---|---|---|
| OS / Kernel | Debian 13 (trixie), 6.18.34+rpt-rpi-v8 | Migration vom 22.07. |
| Root | `/dev/sda2` ext4 auf USB-SSD, 4,4 von 117 GB belegt | `df -h /` |
| RAM | 1843 MB gesamt, **313 MB belegt, 1529 MB verfügbar** | `free -m` |
| Temperatur im Leerlauf | **62,3 °C** bei Load 0,35 | `vcgencmd measure_temp` |
| Drosselung | `get_throttled = 0x0` — seit dem Boot **nie** | `vcgencmd get_throttled` |
| dump1090-CPU | 21,1 % einer CPU (demod), `samples_dropped: 0` | `stats.json`, 5-min-Fenster |
| Panel | `card1-DSI-1: connected`, Nativmodus **720×1280** | `/sys/class/drm` |
| Textkonsole | `fbcon=rotate:3` gesetzt → **Querformat** | `/boot/firmware/cmdline.txt` |
| Touch | „Goodix Capacitive TouchScreen" vorhanden | `/proc/bus/input/devices` |
| DSI-Overlay | **keines** in `config.txt`, nur `dtoverlay=vc4-kms-v3d` | `/boot/firmware/config.txt` |

Zwei Konsequenzen, die man leicht falsch macht:

- **62,3 °C im Leerlauf lassen 18 K bis zur harten 80-°C-Grenze.** Bei dwsapp01 hat eine
  einzige schlechte Datenbankabfrage 15 K gekostet. Die Animationskosten der Radarseite
  sind deshalb eine Meßfrage, keine Formalie (§10.1).
- **`fbcon=rotate:3` sagt etwas über die Textkonsole und nichts über den Compositor.**
  Der grafische Stack kennt diese Drehung nicht; sie muß ein zweites Mal gelöst werden.
  Die 90° von dwsapp01 werden **nicht** übernommen — dort war die erste Annahme 180°
  und falsch.

### 2.2 Datenlage

`lighttpd` liefert die dump1090-Ausgaben bereits über HTTP aus — nachgewiesen mit
`curl`, nicht angenommen:

| Pfad | :80 | :8080 | Inhalt |
|---|---|---|---|
| `/skyaware/data/aircraft.json` | 200 | 200 | Ziele, ~1 s Takt |
| `/skyaware/data/stats.json` | 200 | 200 | Empfängerstatistik |
| `/skyaware/data/history_N.json` | 200 | 200 | 120 Schnappschüsse ≈ letzte Stunde |

Der Docroot ist `/var/www/html` und enthält heute nur Debians Platzhalterseite. Ein
Unterverzeichnis `/var/www/html/atc/` wird damit **ohne jede lighttpd-Konfigänderung**
ausgeliefert; die `alias.url`-Regeln betreffen nur `/skyaware/`. Beim Installieren wird
das trotzdem per `curl` nachgewiesen.

**Zielfelder** (zwei Stichproben wenige Minuten auseinander): 26 Ziele, davon 13 mit
Position, 11 mit Callsign, 11 mit Squawk, 15 mit `gs`/`track`, 18 mit `alt_baro`;
`rssi`, `seen` und `messages` bei allen. In der zweiten Stichprobe 29 Ziele, davon
**5 mit `category: A5` (Heavy)**. Detailfelder wie `ias`, `tas`, `mach`, `roll`,
`nav_qnh` sind bei einem Teil der Ziele real belegt.

**Empfängerstatistik** (5-Minuten-Fenster): 50.606 Nachrichten ≈ **169/s**,
`signal −13,5 dBFS`, `noise −27,4`, `peak_signal −1,8`, `strong_signals 102`,
`gain_db 36,4`, `tracks: 31 gesamt / 19 single_message / 19 unreliable`.

### 2.3 Reichweite — der Grund für den 50-NM-Maßstab

Aus 1630 Positionen (aktuelle Datei plus 120 History-Schnappschüsse, also gut eine
Stunde), gerechnet gegen die Empfängerposition:

| Größe | Wert |
|---|---|
| Maximum | **69,1 NM** |
| Median | **21,3 NM** |
| 0–25 NM | 948 Positionen (58 %) |
| 25–50 NM | 582 |
| 50–75 NM | 100 |
| > 75 NM | keine |

Maximum je 45°-Sektor (von Nord im Uhrzeigersinn):
**69 · 47 · 69 · 51 · 24 · 15 · 16 · 61 NM**.

Nach Südwest und West bricht die Reichweite auf ein Viertel ein — eine reale
Abschattung. Die 360 NM aus der dump1090-Konfiguration sind für die Anzeige
bedeutungslos.

### 2.4 Was fehlt

`seatd`, `labwc` und `chromium` sind **nicht installiert** — auf dwsapp01 waren sie es.
Das Installationsskript bringt sie mit; das ist der größte Eingriff dieses Projekts in
ein produktives Feeder-Gerät.

## 3. Nicht-Ziele

- **Keine Kartenkacheln, keine Fremdquelle zur Laufzeit.** Die Konsole zeigt, was der
  eigene Empfänger sieht. Schriften, Flugplatzgeometrie und Code liegen lokal.
- **Kein Umbau am ADS-B-Stack.** Weder dump1090, noch die Feeder, noch die
  lighttpd-Konfiguration werden angefaßt.
- **Kein zweiter Webserver.** Siehe §4.
- **Keine Zeitreihen in der Konsole.** Verlauf und Alarmierung liegen in
  Telegraf → InfluxDB → Grafana und bleiben dort.
- **Keine Nachtabsenkung in v1.** Das Panel kann es; zurückgestellt bis es sich als
  nötig erweist.

## 4. Architektur

Drei Teile, klar getrennt, jeder einzeln prüfbar.

```
dump1090-fa ──> /run/dump1090-fa/*.json ──> lighttpd /skyaware/data/  ─┐
                        │                                              ├─> Chromium-Kiosk
                        └──> atc-daemon ──> SQLite (Rekorde)           │    /atc/
                                       └──> /var/www/html/atc/data/ ───┘
                                            system.json, range.json
```

**1. Der Schreiber-Daemon** (`atc-daemon.service`) — stdlib-Python, eigener
Systemaccount. Pollt `aircraft.json`, pflegt die Reichweiten-Rekorde in SQLite und
schreibt `system.json` sowie `range.json` in den Docroot. §5.

**2. Das Statik-Frontend** unter `/var/www/html/atc/` — HTML, CSS, JavaScript, ein
gebundelter Font, eine statische Flugplatzdatei. Kein Framework, keine externe
Bibliothek.

**3. Der Kiosk** (`atc-console.service`) — labwc + Chromium auf
`http://127.0.0.1/atc/`. §9.

**Warum kein Backend-Fallback nötig ist:** Fällt der Daemon aus, verlieren genau zwei
Seiten ihre Daten (System, Polar-Rekorde). Radar, Board, Einzelziel, Statistik und
Höhenprofil hängen direkt an dump1090 und laufen weiter. Diese Trennung ist Absicht.

### 4.1 Abrufraten des Frontends

| Quelle | Intervall | Bemerkung |
|---|---|---|
| `aircraft.json` | 1 s | Taktgeber aller Zielseiten |
| `stats.json` | 5 s | |
| `system.json` | 10 s | **nur während die Systemseite sichtbar ist** |
| `range.json` | 60 s | enthält Rekorde **und** Stundenfenster |

Das Frontend liest die `history_*.json` **nicht**. Sie einmal je Seitenladen zu holen
hieße 120 HTTP-Anfragen für Daten, die der Daemon ohnehin im Sekundentakt sieht — sie
werden dort einmalig beim Start als Startwert des Stundenfensters gelesen (§5.3).

### 4.2 Repo-Zuschnitt

```
adsb-console/
  console/
    index.html
    css/console.css
    js/geo.js          — reine Funktionen: Entfernung, Peilung, FL, Formatierung
    js/console.js      — Karussell, Touch, Seitenauswahl
    js/pages/*.js      — je Seite ein Renderer
    fonts/             — gebundelter Font, **nur im Radarkreis** benutzt
    data/airports.json — statische Flugplatz- und Bahngeometrie
  daemon/
    atc_daemon.py
    schema.sql
  config/
    console.json
  install-console.sh
  atc-console.service
  atc-daemon.service
  tests/
    test_geo.mjs       — node --test
    test_daemon.py     — unittest
```

`geo.js` enthält keine DOM-Zugriffe und keinen Zustand. Es ist die Schicht, die ohne
Browser testbar ist, und deshalb die einzige, in der Rechenfehler unentdeckt bleiben
könnten.

### 4.3 Konfiguration

`config/console.json` wird ausgeliefert **und** am Gerät überschreibbar gehalten — ein
Update darf die Auswahl nicht zurücksetzen.

```json
{
  "pages":   { "radar": true, "board": true, "target": true, "stats": true,
               "polar": true, "profile": true, "system": true },
  "dwell_s": { "radar": 45, "default": 15 },
  "radar":   { "range_nm": 50, "rings_nm": [10, 25, 50], "sweep_s": 5,
               "decay_s": 6, "leader_s": 60,
               "labels": ["callsign", "fl", "squawk"] },
  "emergency": { "highlight": true, "interrupt_carousel": false }
}
```

**Jeder Wert hat einen Vorgabewert im Code.** Eine fehlende, leere oder syntaktisch
kaputte Datei führt zu einer laufenden Konsole mit Vorgabewerten, niemals zu einem
weißen Schirm (§10.3).

## 5. Der Daemon

### 5.1 Empfängerposition — und warum sie nicht ins Repo darf

> **Korrektur vom 27.07., am Gerät gemessen.** Ein früherer Entwurfsstand behauptete hier,
> die Position stehe in `/etc/default/dump1090-fa` unter `LAT=`/`LON=`. Das ist falsch in
> zwei Punkten: Die Schlüssel heißen dort `RECEIVER_LAT`/`RECEIVER_LON`, und sie sind auf
> diesem Gerät **leer** — dump1090-fa zieht die Position dann aus der
> piaware-Konfiguration. Der Irrtum stammt aus einem `grep -i`, dessen Treffer `LAT=` in
> Wahrheit das Zeilenende von `RECEIVER_LAT=` war: ein Meßmittel, das eine andere Frage
> beantwortete als die gestellte.

Maßgeblich ist die **tatsächlich wirksame** Position: die Argumente `--lat`/`--lon` des
laufenden `dump1090-fa`-Prozesses, gelesen aus `/proc/<pid>/cmdline`. Das ist
unprivilegiert lesbar (am Gerät als uid 1000 belegt), liefert fünf Nachkommastellen und
ist unabhängig davon, welche Konfigurationsschicht den Wert geliefert hat — es liest, was
der Decoder wirklich benutzt, statt einer von mehreren möglichen Quellen zu vertrauen.

`receiver.json` führt die Position nur auf **zwei Nachkommastellen gerundet** — das sind bis zu
~600 m Fehler in jeder Entfernungsangabe, für Rekorde zu ungenau. (Die gerundeten Werte standen
hier bis zum Schluß-Review im Klartext, vier Zeilen unter der Regel, die sie verbietet. Auf ~1 km
genau ist kein Rundungsfehler.)

Diese Koordinate ist faktisch Hennings Wohnadresse. Sie wird zur Laufzeit vom Gerät
gelesen und **niemals** ins Repo geschrieben — auch nicht in ein Testfixture, einen
Beispiel-Config oder einen Kommentar. Ausgeliefert wird ein Platzhalter. Tests, die
eine Position brauchen, verwenden erfundene Koordinaten. Das gilt unabhängig von der
Repo-Sichtbarkeit und kostet nichts.

### 5.2 SQLite

`/var/lib/atc-console/atc.db`, 36 Sektoren à 10°:

```sql
CREATE TABLE IF NOT EXISTS range_record (
  sector    INTEGER PRIMARY KEY,   -- 0..35, je 10 Grad, 0 = 000..009
  max_nm    REAL    NOT NULL,
  hex       TEXT,
  callsign  TEXT,
  alt_ft    INTEGER,
  seen_at   TEXT    NOT NULL       -- ISO 8601, lokale Zeit mit Offset
);
```

Ein Rekord wird ersetzt, wenn `max_nm` überschritten wird. Ausgeschlossen werden Ziele
mit `mlat` (fremde Multilateration, nicht der eigene Empfang) und solche mit
unplausibler Position; die Plausibilitätsgrenze ist `range_nm_max = 300` — großzügig
über dem gemessenen Maximum, aber unterhalb offensichtlichen Unsinns.

### 5.3 Ausgabedateien

Beide werden **atomar** geschrieben (`write` in eine Temp-Datei, dann `rename`). Ein
halb geschriebenes JSON darf das Frontend nie sehen.

`range.json` (60 s): die 36 Rekorde plus das Maximum je Sektor über die letzte Stunde.

Das Stundenfenster führt der Daemon selbst — er sieht die Ziele ohnehin im
Sekundentakt. Beim Start ist es leer, deshalb liest er die 120 `history_*.json`
**einmalig** als Startwert; danach nie wieder. So ist die Polar-Seite unmittelbar nach
einem Neustart aussagefähig, ohne daß irgendjemand 120 Dateien pro Seitenladen holt.

`system.json` (10 s):

```json
{
  "cpu_temp_c": 62.3, "load": [0.35, 0.38, 0.41], "cpu_count": 4,
  "mem_total_mb": 1843, "mem_used_mb": 313,
  "disk_total_gb": 117.0, "disk_used_gb": 4.4, "uptime_s": 431000,
  "core_clock_hz": 1800457088, "core_volts": 0.9,
  "throttle": {
    "now":  { "undervoltage": false, "arm_freq_capped": false,
              "throttled": false, "soft_temp_limit": false },
    "ever": { "undervoltage": false, "arm_freq_capped": false,
              "throttled": false, "soft_temp_limit": false }
  },
  "services": { "dump1090-fa": "active", "piaware": "active",
                "fr24feed": "active", "telegraf": "active", "lighttpd": "active" },
  "written_at": 1785224553.5
}
```

`written_at` ist der Unix-Zeitstempel des Schreibvorgangs (Sekunden, mit
Nachkommastellen). Die Systemseite vergleicht ihn gegen die eigene Uhr und
erkennt daran, wie lange der Daemon schon nicht mehr geschrieben hat — unabhängig
vom Fetch-Intervall des Frontends, das nur zeigt, wann *es* zuletzt gefragt hat.

**`now` und `ever` bleiben getrennte Felder und getrennte Anzeige.** `get_throttled`
packt den aktuellen Zustand in die Bits 0–3 und „ist seit dem Boot einmal vorgekommen"
in die Bits 16–19. Wer sie zusammenwirft, baut eine Konsole, die Drosselung meldet,
während nichts gedrosselt wird — bei dwsapp01 einmal real passiert.

Jedes Feld ist nullbar: Wo `vcgencmd` fehlt oder scheitert, stehen `null` und in der
Anzeige ein Gedankenstrich. Die Datei wird nie als Ganzes ungültig, weil ein Teil fehlt.

## 6. Die Seiten

Sieben Seiten. **Reihenfolge in diesem Dokument** ist die thematische: Radar, Board,
Einzelziel, Statistik, Polar, Höhenprofil, System — Übersicht, Liste, Detail, Zahlen.
Das ist **nicht** die Reihenfolge des Karussells am Gerät; die steht verbindlich in
§7.1 und wurde am 28.07.2026 am Panel geändert, nachdem Einzelziel und Höhenprofil
dazukamen. Layout **1280×720 quer** (Panel 720×1280 nativ,
im Compositor gedreht): 56 px Kopfzeile, Rumpf, 44 px Indikatorreihe. **Nichts
scrollt.** Was nicht paßt, ist ein Layoutfehler und wird als solcher behoben.

Die Kopfzeile trägt links den Seitentitel, dann das Alter der **für diese Seite
maßgeblichen** Quelle mit Statuspunkt, dann Uhrzeit und Datum. Anders als bei dwsapp01
laufen Browser und Datenquelle auf demselben Host, und `aircraft.json` trägt ein
`now`-Feld — das Alter ist also exakt bestimmbar, ohne Uhrendrift zwischen zwei
Maschinen.

Anzeigesprache ist Deutsch; Fachbegriffe (Squawk, Track, FL, Heavy) bleiben englisch.
Einheiten sind durchgehend nautisch: NM, Knoten, Fuß bzw. Flugfläche.

### 6.1 Radar (PPI)

**Maßstab.** 50 NM Radius, Ringe bei 10/25/50 NM, North-up. Begründet durch §2.3:
Median 21 NM, 58 % innerhalb von 25 NM, Stundenmaximum 69 NM. Bei einem Scope von
⌀ ≈ 620 px (720 px Höhe minus Kopfzeile und Indikatorreihe) sind das **0,161 NM/px**.

**Drei Zeichenebenen**, weil sie völlig verschiedene Frequenzen haben:

| Ebene | Inhalt | Neu gezeichnet |
|---|---|---|
| Hintergrund | Ringe, Peilstrahlen alle 30°, Flugplätze, Beschriftung | **einmal** beim Laden |
| Phosphor | Sweep-Keule, Blips, Nachglühen | jeden Frame |
| Overlay | Callsign, FL, Squawk, Track-Vektor, Heavy-Marker | 1×/s, konstant hell |

**Der Sweep.** Dünne Linie, Umlauf `sweep_s = 5 s` (Größenordnung einer
Anflugradarantenne), mit nachlaufendem Keil abnehmender Helligkeit. Das Nachglühen
entsteht klassisch: Die Phosphor-Ebene wird pro Frame mit halbtransparentem Schwarz
überzogen, statt jedes Blip einzeln zu verrechnen. Ein Blip wird hell gesetzt, wenn die
Keule seinen Azimut überstreicht, und verblaßt über `decay_s`, **begrenzt auf
einen Sweep-Umlauf**: In Variante B hängt das Verglimmen an der
sweep-gekoppelten CSS-Animation, ein `decay_s` über `sweep_s` ist dort nicht
darstellbar und wird auf 0,98 × `sweep_s` gedeckelt.

**Die Fiktion, ausdrücklich benannt.** Ein echter PPI zeigt ein Ziel nur beim
Überstreichen; unsere Daten kommen jede Sekunde für alle Ziele gleichzeitig. Die Keule
ist hier ein **Verschluß**: Eine neue Position wird erst sichtbar, wenn der Balken sie
passiert. Die Anzeige ist damit im schlechtesten Fall 5 s alt. Für eine Wandanzeige ist
das richtig — aber es ist eine Entscheidung, keine Nebensache. Die Overlays folgen
ihrem Blip, damit kein Label vor seinem eigenen Punkt herläuft.

**Blips und Overlays.** Punkt, dazu ein Track-Vektor auf die Position in `leader_s`
= 60 s (bei 300 kt sind das 5 NM ≈ 31 px). Label zweizeilig: Callsign, darunter FL und
Squawk. `category: A5` bekommt ein Heavy-Kennzeichen. Notfall-Squawks rot (§7.3). Ziele
ohne Position erscheinen hier nicht — das Board fängt sie (§6.2).

**Flugplätze.** Statisch in `console/data/airports.json`, aus OurAirports (gemeinfrei)
einmal beim Bauen eingefroren, keine Laufzeitquelle. EDDF liegt ~10 NM entfernt; seine
4000-m-Bahnen werden bei diesem Maßstab **≈ 13 px** lang und sind damit maßstäblich und
in wahrer Ausrichtung zeichenbar, einschließlich der 18/36. Kleinere Plätze im Umkreis
(Egelsbach, Mainz-Finthen, Reichelsheim, Aschaffenburg) bekommen Symbol plus
ICAO-Kennung; ihre Bahnen wären bei 3–6 px Strichgekritzel.

**Schrift.** Ein gebundelter Font, kein CDN, **nur im Radarkreis** (Kontakt-Overlays,
Flugplatzkennungen, Ringbeschriftung) — Kacheln, Tabellen und alle übrigen Seiten
bleiben bei `ui-monospace`. Erster Kandidat ist **B612** (von Airbus für
Cockpitanzeigen entworfen, offene Lizenz) — Lizenztext und Datei werden beim Bauen
geprüft, nicht angenommen. Fällt er durch, ist die Rückfallposition eine echte
Strichschrift (Hershey, gemeinfrei), als Pfade gezeichnet.

**Rückfallposition bei zu hohen Kosten** (§10.1): Sweep als CSS-rotiertes
Verlaufselement auf dem Compositor (GPU, nahezu keine CPU) über einer Canvas, die nur
1×/s Blips zeichnet. Weniger schön, gleiche Anmutung — und dann ebenfalls gemessen.

### 6.2 Board — Zielliste

Nach Entfernung sortiert: Callsign · FL · GS · Track · Entfernung · Peilung ·
Steig-/Sinkpfeil. Darunter eine eigene, kurze Zeile **„ohne Position: n"** mit deren
Callsigns und Höhen. Das ist keine Kosmetik: 13 von 26 Zielen hatten keine Position;
sie stillschweigend wegzulassen hieße, die Hälfte des Empfangs zu verschweigen.

### 6.3 Einzelziel

**Neu gefaßt am 28.07.2026**, maßgeblich ist
[`2026-07-28-stufe-2-entwurf.md`](2026-07-28-stufe-2-entwurf.md) §4.1.

Die ursprüngliche Fassung („das nächstgelegene Ziel mit Position, groß") war beim
Bau der Stufe 2 fast vollständig Wiederholung: Der Datenblock rechts auf der
Radarseite zeigt Callsign, Heavy, FL, Entfernung, Peilung, Track-Symbol, GS,
Steig-/Sinkrate und Squawk bereits, und das ein Drittel der Karussellzeit. Übrig
blieben genau drei zusätzliche Felder — eine ganze Seite dafür ist eine Dublette.

Die Seite zeigt stattdessen ein **volles Datenblatt**: Geschwindigkeitstrias,
Höhentrias samt der im Autopiloten eingestellten Zielflugfläche
(`nav_altitude_mcp`, in der Messung vom 28.07. bei 18 von 18 positionierten
Zielen belegt), Lage, Ort, Empfangs- und Positionsgüte. Ihr Ziel friert beim
Betreten der Seite ein.

### 6.4 Statistik

Aus `stats.json`, drei Spalten für 1/5/15 min: Nachrichten pro Sekunde, akzeptiert,
`strong_signals`, `peak_signal`, `signal`/`noise`, `gain_db`. Dazu die Qualitätszeile
aus `tracks` (gesamt / `single_message` / `unreliable`) — der ehrliche Blick auf die
Empfangsgüte, den die SkyAware-Oberfläche so nicht zeigt.

### 6.5 Polar — Reichweite

36 Sektoren à 10° als Radialdiagramm, zwei Spuren übereinander — beide aus `range.json`
(§5.3): der Allzeit-Rekord aus SQLite, mit Datum, Callsign und Flugfläche des
Rekordhalters, und das Maximum der letzten Stunde. Diese Seite zeigt reale Physik — die
Abschattung nach Südwest (15 NM) gegen Nord und Ost (69 NM).

### 6.6 Höhenprofil

**Neu gefaßt am 28.07.2026**, maßgeblich ist
[`2026-07-28-stufe-2-entwurf.md`](2026-07-28-stufe-2-entwurf.md) §4.2.

Die ursprüngliche Fassung (sechs Balken nach Flugflächenbändern) scheiterte an
einer Messung über eine Stunde, 1808 Positionen: Ein Band hält 57 %, ein anderes
im Mittel 0,3 Ziele. Sechs Balken, von denen einer immer lang und einer immer
leer ist, ändern sich nicht sichtbar.

Vor allem aber summiert die Bänderzählung die **Entfernung** weg — und damit die
Struktur, die wirklich da ist: ein Reiseflugband FL320–FL400 über die vollen
50 NM und ein Flughafenkegel innerhalb von 10 NM unterhalb FL050, mit einer
Lücke dazwischen. Die Seite zeigt deshalb einen **Seitenriß** (Höhe über
Entfernung, x-Achse im Maßstab des Radars) und behält die sechs Bänder als
Zählspalte daneben.

### 6.7 System

CPU-Temperatur mit drei Marken, aber nur zwei Farbschwellen: 60 °C ist der
dokumentierte Firmware-Vorgabewert und steht als Strich im Bild, ist aber **keine**
Farbschwelle — das Gerät läuft im Regelbetrieb bei 66,7–71,5 °C, also dauerhaft
darüber, und eine Anzeige, die dabei ständig Alarmfarbe zeigt, lehrt das Falsche.
Die Farbe wechselt erst bei **72 °C** (Abnahmegrenze dieses Projekts) und bei
**80 °C** (hart). Dazu Load, RAM, Disk, Uptime, `get_throttled` in **zwei
getrennten Blöcken** „jetzt" und „seit Boot", Status der fünf Dienste und
`samples_dropped` — **aus `stats.json`, in zwei Werten** (`last1min` und `total`,
dieselbe Trennung wie bei `get_throttled` und aus demselben Grund: Ein Kriterium,
das nur kumulativ gilt, verschweigt den Moment; eines, das nur den Moment zeigt,
verschweigt die Historie). Auf 1843 MB neben vier Diensten ist das die Seite, die
sagt, ob die Konsole selbst zum Problem geworden ist.

## 7. Verhalten

### 7.1 Karussell

Radar als Heimatseite mit 45 s, die übrigen sechs je 15 s — bei allen sieben aktiven
Seiten ein Umlauf von 2:15, das Radar ein Drittel der Zeit. Standzeiten und
Seitenauswahl stehen in `console.json`.

**Die geltende Reihenfolge** (`PAGE_ORDER` in `console/js/config.js`, am 28.07.2026
am Panel festgelegt) ist: Radar, Einzelziel, Höhenprofil, Polar, Board, Statistik,
System. Sie folgt dem inhaltlichen Faden statt der Bauabfolge — das Radar zeigt, WO
etwas ist; Einzelziel greift den nächstgelegenen Kontakt davon direkt auf;
Höhenprofil zeigt dieselben Ziele im Aufriß; Polar die Reichweite darum herum. Erst
danach die Listen- und Zustandsseiten.

**Die Radar-Animation läuft nur, solange die Seite sichtbar ist.** Eine unsichtbare
Canvas zu rendern ist reine Verschwendung — und auf diesem Gerät eine thermische dazu.

Automatischer Wechsel blendet über (180 ms), ein Wisch schiebt die Seite in
Wischrichtung heraus (200 ms), damit sich die Geste wie eine Geste anfühlt.

### 7.2 Touch

Jede Berührung hält das Karussell an; **genau 60 s nach der letzten Berührung** wird
weitergeblättert, und zwar **von der sichtbaren Seite** aus, nicht von der unterbrochenen.

Der frühere Wortlaut („pausiert für 60 s, nimmt danach wieder auf") ließ zwei Lesarten
zu, und die Umsetzung wählte die andere: Nach 60 s begann die Standzeit der sichtbaren
Seite von vorn, sodaß dieselbe Geste je nach Seite 75 s (Board, Statistik) oder 105 s
(Radar) wirkte. Am 27.07. am Panel mit der Stoppuhr gemessen und entschieden. Waagerechter Wisch blättert; die
Indikatorreihe ist zugleich Direktzugriff mit 44×44-px-Zielen.

Gestenhygiene, vollständig tragend: `touch-action: none` auf der Bühne **und**
`--overscroll-history-navigation=0` an Chromium — ohne beides navigiert ein Wisch
zurück statt zu blättern. Ein Wisch zählt ab 60 px waagerechtem Weg unter 45°; alles
darunter ist ein Tap. Keine Textauswahl, kein Kontextmenü, kein Doppeltipp-Zoom, kein
sichtbarer Zeiger.

### 7.3 Notfall-Squawks

7500, 7600 und 7700 sowie ein aussagekräftiges `emergency`-Feld werden **markiert**: rotes
Blip auf dem Radar, rote Zeile im Board, Squawk im Klartext. Das Karussell läuft normal
weiter; `emergency.interrupt_carousel` kann das umschalten, steht aber auf `false`.

**„Aussagekräftig" ist hier wörtlich zu nehmen und war beinahe ein Fehler:** In der
Messung trug das Feld die Werte `null` (23 Ziele) und `"none"` (6 Ziele) — es ist also
bei völlig normalen Zielen *vorhanden*. Ausgelöst wird nur bei einem Wert außerhalb von
`null` und `"none"`; „Feld gesetzt" als Bedingung hätte jedes zweite Ziel rot gefärbt.

Ehrlicher Rahmen: In der gemessenen Stunde kam kein einziger Sonder-Squawk vor, und das
ist der Normalfall. Ein Pfad, der nie ausgelöst hat, ist unkalibriert — deshalb steht
sein absichtlicher Fehlerfall verbindlich in der Abnahme (§10.3).

### 7.4 Nächtlicher Reload

Einmal um 04:00, **nur wenn** ein Probe-Fetch auf `aircraft.json` vorher gelingt. Ohne
diese Sperre ist der Reload genau der Mechanismus, der morgens eine Fehlerseite an der
Wand hinterläßt.

## 8. Degradation und Leerzustände

| Fall | Verhalten |
|---|---|
| Fetch schlägt fehl | Letzte Werte bleiben stehen und altern sichtbar. **Kein Reload** — ein toter Dienst kostet den Datenstrom, nicht das Dokument. |
| `aircraft.json` > 10 s alt | Kopfzeile amber, Werte gedimmt |
| `aircraft.json` > 60 s alt | Werte grau, „keine Daten seit HH:MM" |
| Ziel sendet nicht mehr | Blip verglüht über `decay_s` und verschwindet, wenn dump1090 es fallenläßt — kein ewig helles Geisterziel |
| Daemon tot | System- und Polar-Rekorde altern sichtbar; die übrigen fünf Seiten laufen weiter |
| Chromium stürzt ab | `Restart=always`, `--disable-session-crashed-bubble --noerrdialogs` — kein „Seiten wiederherstellen?"-Dialog über der Anzeige |

**Leerzustände sind hier der Normalfall, nicht der Sonderfall.** Frankfurt hat ein
Nachtflugverbot: null Ziele um 03:00 ist richtig, nicht kaputt. Jede Seite braucht
daher einen ehrlichen Leerzustand („keine Ziele in Reichweite", mit der Uhrzeit des
letzten Ziels) statt eines leeren Rasters, das wie ein Defekt aussieht.

Entscheidend: **„nichts fliegt" und „Empfänger tot" müssen unterscheidbar bleiben.**
Dafür bleibt die Nachrichtenrate aus `stats.json` auf jeder Seite ablesbar — sie läuft
auch dann weiter, wenn kein einziges Ziel eine Position sendet.

## 9. Kiosk-Deployment

`install-console.sh` ist ein Abkömmling der dwsapp01-Vorlage und erbt deren teuer
bezahlte Details:

1. `labwc`, `wlr-randr`, `chromium`, `seatd`, `curl` installieren — auf diesem Gerät
   sind sie **alle** noch nicht vorhanden.
2. **Die seatd-Gruppe wird am Socket entdeckt** (`stat -c %G /run/seatd.sock`), nicht
   aus einer Namensliste geraten; auf Debian 13 läuft seatd als `seatd -g video`, und
   trixie kann hier abweichen. Ebenso die Gruppe des Render-Node.
3. Gruppe `video` für `vcgencmd` — ohne sie bleiben die Drosselungsfelder leer.
4. Ausgabetransformation über `wlr-randr` im labwc-Autostart, und **aus demselben
   Rotationswert abgeleitet** die libinput-`calibrationMatrix`: labwc dreht Toucheingaben
   nicht mit der Ausgabe mit.
5. `.config` explizit als eigenes `install -d`-Argument — GNU `install` vererbt
   `-o`/`-g` nicht an implizit angelegte Elternverzeichnisse (auf echter Hardware
   einmal als root-eigenes `.config` aufgetreten).
6. Transparentes XCursor-Theme: Der Goodix-Touchcontroller meldet sich zusätzlich als
   Maus, weshalb labwc sonst einen unbeweglichen Zeiger in eine Ecke parkt.
7. `atc-daemon.service` und `atc-console.service` installieren und aktivieren.

**Die Rotation wird am Gerät gemessen und dem Skript als `--rotate` übergeben.** Kein
übernommener Wert.

`atc-console.service` folgt der Vorlage (Systemaccount ohne PAM-Session,
`RuntimeDirectory`, `StateDirectory`, `HOME`/`XDG_CONFIG_HOME` darauf zeigend), mit
einem Unterschied: Die `ExecStartPre`-Warteschleife wartet auf **lighttpd und die erste
`system.json`**, nicht auf einen eigenen App-Server. Ohne sie gewinnt Chromium das
Rennen und zeigt eine Verbindungsfehlerseite.

Chromium startet gegen `http://127.0.0.1/atc/` — Loopback, nicht über eine öffentliche
Adresse. Ein Wanddisplay, dessen Anfragen durch einen Tunnel und zurück laufen, hätte
eine Internetabhängigkeit, die dieses Gerät nicht braucht.

## 10. Verifikation

### 10.1 Stufe 0 — der Meß-Spike, vor dem Einfrieren der Radar-Parameter

Eine Wegwerf-Canvas im Zielformat, echtes Panel, echter Chromium-Kiosk, 20–30 min gegen
die Baseline aus §2.1. Abbruchkriterien **vorher** festgelegt, damit sie hinterher nicht
schöngeredet werden:

| Kriterium | Grenze |
|---|---|
| `samples_dropped` | bleibt **0** |
| `get_throttled` | bleibt `0x0` |
| CPU-Temperatur | unter **72 °C** (8 K Reserve zur harten Grenze) |

`samples_dropped` ist das harte Kriterium: Verliert der SDR-Leser Samples, beschädigt
die Konsole den Zweck des Geräts. Reißt eines der drei, greift die Rückfallposition aus
§6.1 — und wird ihrerseits gemessen.

### 10.2 Im Repo

- `tests/test_geo.mjs` (`node --test`), kalibriert an einer Wahrheit, die **unabhängig
  vom Code** feststeht: eine bekannte Großkreis-Strecke und die Entfernung
  Empfänger→EDDF, letztere mit erfundener Empfängerposition (§5.1).
- `tests/test_daemon.py`: Throttle-Parser gegen `0xe0000` — „jetzt nichts, seit dem Boot
  dreimal" ist unabhängig belegt, nicht erinnert. Dazu Sektor-Rekord-Logik, atomares
  Schreiben, Plausibilitätsgrenze, Config-Vorgabewerte.
- **Jeder Test wird einmal absichtlich rot gesehen**, bevor ihm geglaubt wird, indem
  eine Formel gebrochen wird. Ein Test, der nie rot war, ist unkalibriert.

### 10.3 Am Gerät — absichtlich gegen die Absicht bedient

Der vorgesehene Weg beweist nur, daß es ihn gibt.

1. **Rotation mit dem Finger prüfen, nicht mit den Augen.** Ecke antippen und schauen,
   wo der Treffer landet. Ein gedrehtes Bild über einer ungedrehten Touchfläche sieht
   vollkommen richtig aus und ist falsch.
2. **Kaputte Konfiguration:** alle Seiten auf `false`, unbekannter Seitenname,
   `range_nm: 0`, negatives `sweep_s`, JSON-Syntaxfehler. Die Konsole muß mit
   Vorgabewerten laufen — ein weißer Schirm wegen eines Kommafehlers ist inakzeptabel.
3. **Notfall-Squawk künstlich erzeugen** (präparierte Datenquelle im Testmodus):
   Markierung muß kommen. **Und der Rückweg:** Squawk weg → Markierung weg. Eine
   Alarmregel ist erst geprüft, wenn sie auch wieder entwarnt hat.
4. **Daemon töten:** System-Seite altert sichtbar statt zu lügen, Radar läuft weiter.
   Wieder starten: erholt sich. **Die Rekorde überleben den Neustart.**
5. **Leerzustand herstellen** (nachts oder mit leerer Datenquelle): „keine Ziele" darf
   nicht wie ein Defekt aussehen, und die Nachrichtenrate muß weiterlaufen.
6. **Netzstecker ziehen.** Die Behauptung „keine externe Abhängigkeit" wird geprüft,
   nicht geglaubt.
7. **Reboot ohne Zutun** — kommt der Kiosk hoch? dump1090 unter laufendem Kiosk
   neustarten — erholt sich die Anzeige?
8. **Wischen** darf Chromium nicht zurücknavigieren.
9. Vor jedem Layout-Urteil sicherstellen, daß die geladene Fassung die gebaute ist.
   Layout-Kritik an einer gecachten Datei war beim letzten Bau ein Beinahe-Fehlurteil.

Nicht abhakbar, sondern notiert: Die Polar-Seite braucht Laufzeit, bis die Rekorde
aussagekräftig sind. Sie wird als „nach einer Woche noch einmal ansehen" vermerkt, nicht
als erledigt gemeldet.

## 11. Stufung

| Stufe | Inhalt |
|---|---|
| 0 | Meß-Spike (§10.1). Entscheidet die Radar-Umsetzung. |
| 1 | Daemon **inklusive Rekord-Sammlung** + Gerüst + Radar + Board + Statistik; Kiosk läuft am Panel |
| 2 | Einzelziel, System, Höhenprofil — **umgesetzt am 28.07.2026** |
| 3 | Polar mit Rekordhaltern |

Der Daemon geht bewußt zuerst live: Dann sammelt SQLite bereits Rekorde, während der
Rest gebaut wird, und die Polar-Seite hat bei ihrer Fertigstellung echte Daten statt
einer leeren Tabelle.

**Nach Stufe 2 laufen sechs Seiten**, nicht sieben: Polar hat noch keinen Renderer
(`console/js/pages/polar.js` existiert erst mit Stufe 3) und wird von `console.js`
gegen die registrierten Module gefiltert (§4.2, §6.5) — nicht ausgeblendet, sondern
schlicht nicht registriert. Erst mit Stufe 3 wird daraus wieder ein Siebentel.

## 12. Zurückgestellt

- Nachtabsenkung über `panel_backlight@1`.
- Umschaltbarer Radar-Maßstab per Fingertipp (10 / 25 / 50 NM).
- Spurhistorie je Ziel (Kondensstreifen der letzten Minuten) — reizvoll, aber
  Speicher- und Rechenaufwand auf diesem Gerät erst nach dem Meß-Spike beurteilbar.
- MLAT-Ziele aus piaware als zweite, andersfarbige Zielklasse.
