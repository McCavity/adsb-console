# Fotosession mit synthetischer Quelle

> 31.07.2026 · Gerät `adsapp01` · Chromium 150.0.7871.181 (Debian 13, aarch64)
> Anlaß: Bilder für die Veröffentlichung; Vorbedingung war [Spec 11](2026-07-31-spec-11-frischeanzeige.md)
> Ergebnis: **sieben Bilder in `docs/bilder/`**, beide Gegenproben grün und beide
> Detektoren nachweislich rot-fähig. **Zwei Darstellungsfehler gefunden**, siehe unten.

## Warum synthetisch

Nachts fliegt nichts, tagsüber steht zufällig da, was da steht. Ein Notfall-Squawk, ein
HEAVY, ein volles Board und ein satter Reichweitenrekord lassen sich nicht abwarten — und in
den produktiven Datenpfad schreibt man dafür nicht. Die Konsole braucht dazu **keine Zeile
Code**: `data.js` liest Ziel- und Reichweitenquelle über `quellUrl()`; was nicht umlenkbar ist
(`receiver.json`, `stats.json`, `data.js:69,88`) bekommt einen eigenen `skyaware/data/`-Baum
neben der eingefrorenen Kopie des Docroots.

Der Aufnahmezeitpunkt wird über `--virtual-time-budget` **gewählt**, nicht abgewartet: Der
Umlauf dauert 2:15, und jedes Bild soll mitten in der Standzeit seiner Seite entstehen, nicht
am Rand. Belegt in der Spec-11-Messung: 70 000 ms Budget = 70 000 ms Seitenzeit, 70 Ticks.

## Was gestellt wurde

17 Ziele, davon 15 innerhalb der eingestellten 50 NM, eines auf 62 NM und eines ohne
Position. Alle Kennungen erfunden (`SYN####`, hex im Block `f0….`) — nicht nur wegen der
Daten, sondern aus Ehrlichkeit: Wer das Bild sieht, soll nicht glauben, er sähe einen realen
Flug. Darin ein Notfall-Squawk 7700, zwei HEAVY, gestaffelte Flugflächen von FL024 bis FL390.

Zwei Dateien behalten ihre **echten** Werte, weil sie Messungen über diese Hardware sind und
eine erfundene CPU-Temperatur im README eine Behauptung im Gewand eines Belegs wäre:
`system.json` (nur `written_at` wird fortgeschrieben) und `stats.json`.

### Die Ziele stehen nicht, wo sie hübsch wären, sondern wo Platz ist

Bei 50 NM liegen **34 Flugplätze** im Bild. Der erste Durchgang schrieb `EDSYN1122` und
`EDSYN5509` — Zielbeschriftung auf ICAO-Kennung, was wie ein Renderfehler aussieht.
`tools/plazierung.py` sucht deshalb Peilung und Entfernung so, daß jede Beschriftung
mindestens **8 px** von jeder Flugplatzkennung und jeder anderen Zielbeschriftung frei bleibt.

Die Luft steht als **Zahl** im Prüfmittel. Sonst bliebe es grün bis 0,0 px — und genau das
meldete der erste Lauf mit engem Suchfenster: zwei Ziele bei 6,6 und 7,1 px, Exit 1. Mit
weiterem Fenster: **9,0 px an der engsten Stelle**, Exit 0. Das Werkzeug war rot, bevor es
grün war.

### Was das Datenblatt verlangt

Der erste Wurf zeigte die Einzelziel-Seite mit dreizehn Gedankenstrichen: Die Szene führte
nur die Felder, die Radar und Tafel brauchen. Ein README-Bild, das die Konsole schlechter
zeigt, als sie im Betrieb ist, ist derselbe Fehler wie eine lügende Statuszeile, nur nach
außen. Die abgeleiteten Werte werden deshalb **gerechnet und geeicht**, nicht geschätzt:

| Größe | Verfahren | Eichung an echten Daten vom 31.07. |
|---|---|---|
| IAS | 1,32 % Abnahme je 1000 ft | FL370/490,5 kt → 251 gegen gemessene **252** |
| | | FL039/178,7 kt → 170 gegen gemessene **171** |
| Mach | Standardatmosphäre, TAS 7 % unter GS in der Höhe | FL350 → 0,774 gegen reale **0,776** |

Mit `tas = gs` käme FL350 auf Mach 0,833 — eine Zahl, die im Bild niemandem auffiele und
trotzdem falsch wäre.

## Die Bilder

| Datei | Seite | Aufnahme bei | Was darauf belegt ist |
|---|---|---|---|
| `radar.png` | Radar | 22 s | Notfall rot, zwei HEAVY, Keule mit Nachglühen, 34 Flugplätze |
| `ziele.png` | Ziele | 98 s | die zwölf nächsten, Notfallzeile, „ohne Position: 1" |
| `einzelziel.png` | Einzelziel | 53 s | alle 23 Felder gefüllt |
| `hoehenprofil.png` | Höhenprofil | 68 s | Bänder zählen 17, Punkte zeigen 15, Kachel erklärt die Differenz |
| `reichweite.png` | Reichweite | 83 s | Keule nach Osten, Stundenspur ragt in zwei Sektoren über den Rekord |
| `empfang.png` | Empfang | 113 s | echte Empfangsstatistik |
| `system.png` | System | 128 s | **„Daemon geschrieben vor 5 s"**, grün |

Die letzte Zeile ist die Probe auf Spec 11: Ohne fortgeschriebenes `written_at` stünde dort
ein roter Wert (gemessen: 217 s).

### Anzeige gegen Absicht

Der Generator rechnet die Ziele aus Peilung und Entfernung, also läßt sich die Anzeige gegen
die Vorgabe prüfen statt gegen „sieht richtig aus". Über die zwölf Zeilen der Tafel stimmen
Entfernung und Peilung **auf die angezeigte Stelle**:

| Vorgabe | Anzeige |
|---|---|
| SYN7788 auf 33 NM / 268°, Squawk 7700 | `33.0 · 268° · 7700`, rot |
| SYN5560 weitestes bei 49 NM / 191° | `WEITESTES ZIEL 49 NM SYN5560 191°` |
| 17 Ziele, davon 1 ohne Position, 1 auf 62 NM | `15 von 17 empfangen` |
| jüngster Rekord 14 min vor der Aufnahme | `43.0 NM · vor 14 min` |

Das Ziel auf 62 NM steht absichtlich in der Szene: Ein Filter, den kein Datensatz je
erreicht, ist ungeprüft.

## Gegenproben

Beide haben eine vorher feststehende Antwort, und beide Detektoren wurden **erst rot
gemacht**, bevor ihr Grün zählt (`tools/gegenprobe.py`).

**A — Kennungen.** 105 Kennungen der synthetischen Quelle, wortgenau gegen die echte
`aircraft.json` und `range.json`: **kein Treffer**. Kalibrierung: ein echtes Callsign
(`THY8BC`) in die Prüfmenge geschmuggelt → **1 Treffer, rot wie gefordert**.

**B — Ortsdaten.** Kein Bild trägt einen Metadatenblock: die PNGs haben weder `eXIf` noch
`tEXt`/`iTXt`/`zTXt`. Kalibrierung an einem selbstgebauten JPEG mit GPS → **rot**, und zwar
mit `EXIF-Tag 0x8825 (GPS-IFD)`.

Der erste Entwurf dieses Detektors suchte das GPS-Tag als Byte-Muster und löste bei der
Kalibrierung **nicht** aus, obwohl GPS drinstand — ein Zweig, der ohne den erzwungenen
Fehlerfall nie betreten worden wäre. Er parst den TIFF-Kopf jetzt wirklich.

## Zwei Darstellungsfehler, die dabei aufgefallen sind

**1. Höhenprofil: das äußerste Achsenlabel steht außerhalb der Leinwand.** `profile.js:121`
zeichnet die Ringbeschriftung stur bei `x + 5`. Der äußerste Ring ist per Konstruktion immer
gleich der Reichweite, liegt also bei x = 692 von 700 — das Label `50 NM` beginnt bei 697,
braucht rund 33 px und ragt **30 px** hinaus. Gerechnet für alle drei Stufen: 10, 50 und 80 NM
ergeben denselben Überstand, der Fehler tritt also **immer** auf. Im Bild ist von `50 NM` nur
die `5` übrig.

Das ist dieselbe Fehlerklasse wie EDFJ am Radarrand am 27.07. — dort weicht die Beschriftung
inzwischen auf die Seite aus, auf der Platz ist (`radar.js`, `passtRechts`). Das Geschwister
auf der Nachbarseite ist damals nicht mitgezogen worden.

**2. `Verstaerkung` statt `Verstärkung`** auf der Empfangsseite (`stats.js:60`). Einziger
Digraph im sichtbaren UI-Text; `Daemon` daneben ist ein Fachbegriff und bleibt.

## Der Wächter hat mich selbst erwischt

Die erste Fassung von `fotoszene.py` und `plazierung.py` trug die gerundete
Empfängerposition als Konstante — verboten durch CLAUDE.md, „auch keine gerundete Fassung".
`tests/keine-empfaengerposition.sh` meldete trotzdem grün, und zwar zu Recht: Er läuft über
`git ls-files`, und die Dateien waren noch nicht getrackt. Nach `git add` schlug er sofort an
und benannte beide Zeilen.

Behoben **vor** dem ersten Commit, nicht danach: Solange nichts gepusht ist, hinterläßt das
Entfernen keine Spur in der Historie. Beide Skripte holen die Position jetzt zur Laufzeit
(`receiver.json` des Geräts bzw. `ATC_RECEIVER_LAT`/`LON`) und brechen ab, wenn das
mißlingt — nachgeprüft mit einem erfundenen `ATC_HOST`: `NICHT PRUEFBAR`, Exit 2. Keine
stillschweigende Vorgabeposition.

Die Lehre für den Wächter selbst: **er sieht nur, was getrackt ist.** Wer neue Dateien prüft,
muß vorher `git add` sagen — sonst prüft er die alte Welt.

## Reproduzierbarkeit: die Szene, nicht das Bild

Ein zweiter Lauf mit identischer Szene liefert **kein bitgleiches** PNG: 91,3 % der Pixel
sind exakt gleich, 1,43 % weichen stark ab. Das sind die Uhr in der Kopfzeile und die Phase
der Keule — die CSS-Animation startet beim Mount, und der liegt hinter Modul- und
Schriftladen, also hinter echter Netzwerkzeit. Geometrie, Beschriftungen und alle Zahlen
sind identisch. Reproduzierbar ist die Szene, nicht das Einzelbild.

## Offen für die Veröffentlichung

- Die beiden Fehler oben sind Einzeiler, aber sie stehen im Bild. Vor Schritt 3 zu entscheiden.
- Die Systemseite zeigt **72,1 °C** und damit orange, weil das die eigene Abnahmegrenze ist.
  Der Wert ist echt gemessen und die Markenlogik arbeitet korrekt — die Frage ist nur, ob das
  ins README soll. Ein Bild bei kühlerem Gerät wäre in Minuten neu geschossen.
- Der Flugplatz-Layer läßt sich nur zur Laufzeit am Zahnrad abschalten, nicht über
  `console.json`. Ein aufgeräumtes Radarbild ohne Flugplätze ist headless deshalb nicht zu
  bekommen, ohne den Dialog zu bedienen.

## Reproduzieren

```bash
D=/var/tmp/foto-$(date +%F-%H%M%S); cp -r /var/www/html/atc "$D"
mkdir -p "$D/skyaware/data"
curl -sf http://127.0.0.1/skyaware/data/stats.json > "$D/skyaware/data/stats.json"
python3 tools/fotoszene.py --basis "$D" --seite radar
```

Der produktive Pfad wird dabei nur gelesen; Kiosk und lighttpd bleiben unangetastet
(nachgeprüft: `atc-console` aktiv, echte `aircraft.json` 0,8 s alt, kein Testserver offen).
