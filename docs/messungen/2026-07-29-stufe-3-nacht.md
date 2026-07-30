# Wärmelauf Stufe 3 — die Nacht vom 29. auf den 30.07.

> **Ergebnis in einem Satz:** Das Temperaturkriterium ist gerissen (Maximum 76,4 °C gegen
> Grenze 72), `samples_dropped` und `get_throttled` blieben über alle 2.317 Punkte auf 0 —
> und die Ursache ist die **Umgebung**, nicht die Konsole (R² = 0,84 gegen die
> Raumtemperatur, Karussell-Aufschlag nur 2,3 K). Ausführlich unter [Ergebnis](#ergebnis).

> Begonnen 2026-07-29 17:43 auf `adsapp01`, **sieben Seiten**, Umlauf 135 s (2:15),
> Radaranteil 33 %. **Um 18:06 auf 24 Stunden verlängert**, Ende 30.07. gegen 18:06 —
> rund 2370 Punkte in **einer durchgehenden Reihe**.
> **Dieser Abschnitt ist vor dem Lauf geschrieben.** Die Ergebnisse stehen weiter unten
> und werden nachgetragen — eine Grenze, die man nach der Messung verschiebt, ist keine.

## Die Kriterien, vorher festgeschrieben

| Kriterium | Grenze |
|---|---|
| `total.local.samples_dropped` | bleibt **0** — das harte Kriterium |
| `get_throttled` (beide Hälften) | bleibt `0x0` |
| CPU-Temperatur | unter **72 °C** |

Unverändert seit dem Spike vom 27.07. Die 72 °C sind die **Abnahmegrenze dieses
Projekts**, nicht die der Hardware: Der Firmware-Soft-Limit liegt bei 80 °C, und genau
deshalb trägt die Systemseite die 60-°C-Marke dokumentarisch und nicht als Farbschwelle.

## Der Ausgangszustand — und er reißt das Temperaturkriterium schon

**Vor dem Lauf gemessen, 17:42 bis 17:45, sieben Punkte im 23-Sekunden-Abstand:**

```
71,1 · 71,6 · 71,6 · 73,5 · 72,1 · 71,1 · 71,6 °C     Spanne 2,4 K, Mittel ~71,9
```

Dazu die ersten beiden Zeilen des Laufs selbst: **74,01 °C** und **72,06 °C**.

**Die Konsole läuft im Regelbetrieb bereits über der Abnahmegrenze.** Am 28.07. lag das
Maximum über 120 Punkte bei 71,1 °C, die Marge also bei 0,9 K. Sie ist verbraucht.

Die beiden anderen Kriterien halten dabei: `throttle` ist in **beiden** Hälften — „jetzt"
und „seit dem Boot" — auf 0, `samples_dropped` ist in `last1min` und `total` 0.

## Warum die Konfiguration trotzdem unverändert bleibt

Naheliegend wäre, jetzt die Standzeiten zu entschärfen. **Das wäre derselbe Fehler, den
§7.1 des Stufe-2-Entwurfs schon einmal benannt hat:** Dann änderten sich zwei Dinge
gleichzeitig — die neue Seite *und* die Konfiguration —, und dem Ergebnis wäre hinterher
keine Ursache mehr zuzurechnen. Der Riß ist das Ergebnis. Gemessen wird der
Liefergegenstand.

## Was dieser Lauf gegenüber allen früheren zusätzlich kann

Auf Hennings Vorschlag werden **Außen- und Raumtemperatur mitgeschrieben**. Ohne sie wäre
ein Grenzriß in dieser Nacht nicht zuzurechnen: „Die Konsole ist zu teuer geworden" und
„es sind 37 °C draußen" sehen in einer reinen CPU-Reihe identisch aus und haben völlig
verschiedene Konsequenzen. Frühere Läufe (27.07., 28.07.) tragen diese Spalten nicht und
sind deshalb nur eingeschränkt vergleichbar.

**Stand bei Meßbeginn:** außen **36,67 °C**, Raum **30,4 °C**, und laut Henning schwappt
ab heute eine Hitzewelle aus Frankreich herüber.

### Die Außentemperatur kommt nicht aus ioBroker — und das ist ein eigener Befund

Naheliegend wäre `mqtt.0.davis.weather.temperature` gewesen. **Der Wert dort ist
unbrauchbar:** Er springt im Wechsel zwischen zwei Sensoren. Über zehn Abtastungen in zwei
Minuten am 29.07. gemessen:

```
36,61 · 36,61 · 20,79 · 20,79 · 36,67 · 36,67 · 36,67 · 20,79 · 36,67 · 36,67 °C
```

Die Feuchte springt parallel zwischen 24 % und 52,8 %. An der Quelle sind es sauber
getrennte Größen — `dwsapp01` liefert sie über zwei verschiedene Endpunkte:

| Quelle | Wert |
|---|---|
| `dwsapp01:8000/api/latest` — Davis ISS, außen | **36,67 °C**, 26 % rF |
| `dwsapp01:8000/api/indoor` — BME280 am Gerät | **20,8 °C**, 52,8 % rF |

Der zweite Wert paßt auf 0,2 K zu dem, was die Asset-DB nach der Verlegung des BME280 am
24.07. notiert (20,6 °C / 49 %). **Beide werden in dasselbe MQTT-Topic geschrieben.** Alles,
was in ioBroker daran hängt, sieht eine Sägezahnkurve zwischen 20 und 37 °C. Das ist ein
Befund über das Homelab, nicht über dieses Projekt, und gehört dort behoben — hier wird
deshalb **direkt an der Quelle** gemessen.

## Der Meßaufbau

`/var/tmp/stufe3-nacht.sh` auf dem Gerät, Ausgabe `/var/tmp/stufe3-nacht.csv`.

**Die ausgewerteten Rohdaten liegen als [`2026-07-29-stufe-3-nacht.csv`](2026-07-29-stufe-3-nacht.csv)
neben diesem Dokument** (2.317 Punkte, 205 kB) — erstmals in diesem Repo, weil die Auswertung
mit Stundenmitteln und Regression nicht mehr aus dem Fließtext nachvollziehbar wäre. Wer die
Zahlen unten prüfen will, soll sie nachrechnen können.

**Meßabstand 37 s**, und das ist kein runder Wert aus Bequemlichkeit: 30 s teilen 120 s,
und genau daran war die Messung vom 28.07. unterabgetastet — jeder Punkt traf dieselben
vier Phasen des Umlaufs, mit **1,67 K systematischem Unterschied** zwischen ihnen, und aus
der so entstandenen Zickzacklinie wurde ein Trend gelesen, den es nicht gab. 27 und 45
teilen 135, **37 nicht**: Die Phase wandert durch.

Vierzehn Spalten je Punkt:

| Spalte | Quelle |
|---|---|
| `cpu_c`, `load1`, `mem_mb`, `uptime_s`, `throttle_now`, `throttle_ever` | `atc/data/system.json` (Daemon) |
| `sd_1min`, `sd_total` | `skyaware/data/stats.json` (dump1090) |
| `aussen_c`, `aussen_rh` | `dwsapp01:8000/api/latest` |
| `keller_c` | `dwsapp01:8000/api/indoor` |
| `raum_a_c`, `raum_b_c` | zwei Zigbee-Sensoren über ioBroker |

**Zu `raum_a` und `raum_b`** — am 29.07. von Henning zugeordnet:

| Spalte | Sensor | Ort |
|---|---|---|
| `raum_a_c` | `…be8afd` | in einem unbenutzten, offenen Mini-Gewächshaus auf einem Regal an der gegenüberliegenden Wand, **kurz unter der Zimmerdecke**. Mißt Raumluft, aber oben. |
| `raum_b_c` | `…d3cb76` | rund 3 m entfernt, **etwa auf Gerätehöhe** (rund 30 cm höher) |

**`raum_b` ist der Bezugswert für die Zurechnung**, nicht `raum_a`: Gebraucht wird die
Luft, die das Gerät ansaugt, und die steht auf Gerätehöhe.

**Keiner der beiden steht neben `adsapp01`, und das ist richtig so.** Ein Sensor direkt am
Gerät würde dessen Abwärme mitmessen — genau das ist dem BME280 auf `dwsapp01` am 24.07.
passiert (**+14 °C**, 21 → 35 °C, weil er zu nah an Pi und Display saß), und behoben wurde
es dort nicht durch einen Offset, sondern durch physische Verlegung. Ein Referenzwert, der
die Abwärme der gemessenen Sache enthält, kann über die Umgebung nichts mehr aussagen.

**Die Differenz der beiden Sensoren ist selbst eine Größe:** 0,85 K bei Meßbeginn (Decke
wärmer als Gerätehöhe) ist normale Schichtung. Wächst dieser Abstand, staut sich Wärme
oben — das kündigt an, was am Gerät ankommt, bevor es dort ankommt.

## Warum 24 Stunden und nicht drei Läufe

Henning schlug am Abend zusätzliche Messungen gegen Mitternacht, in den frühen
Morgenstunden und am heißesten Punkt des Folgetages vor. Die ersten beiden waren bereits
enthalten — die Reihe ist **lückenlos**, Mitternacht und Morgengrauen sind Ausschnitte
daraus, nicht eigene Läufe. Der Nachmittag fehlte, und statt einen dritten Lauf
danebenzustellen, wurde die laufende Reihe verlängert.

**Drei getrennte Läufe hätten drei Nähte**, an denen Startzeit, Phasenlage und
Gerätezustand neu gesetzt werden — und jede Naht ist eine Stelle, an der sich ein Fehler
verstecken kann. Eine durchgehende Reihe zeigt den Tagesgang, statt ihn aus Fragmenten zu
rekonstruieren. Der Preis ist eine größere Datei; sie ist rund 280 kB groß.

**Was der Nachmittag beitragen soll:** Der 30.07. ist laut Vorhersage der heißeste Tag der
Hitzewelle. Damit fällt das Maximum der Kurve mit dem Maximum der Umgebungstemperatur
zusammen, und die Frage „liegt es an der Konsole oder an der Umgebung" bekommt ihren
schärfsten Fall — den, an dem sich die beiden Erklärungen am deutlichsten unterscheiden.

## Ergebnis

**Nachgetragen 2026-07-30 nach Laufende.** Die Prüfliste von oben wurde zuerst abgearbeitet:

| Prüfung | Befund |
|---|---|
| Reihe durchgelaufen? | Prozeß sauber beendet (`/proc/169977` weg, Datei wächst nicht mehr) |
| Genau ein Kopf? | ja, genau einer |
| Fenster | **29.07. 18:05:57 – 30.07. 18:05:49 = 24,00 h**, **2.317 Punkte** |
| Abstand | min/median/max **37 / 37 / 78 s** — ein einziger Aussetzer (06:41, ein übersprungener Punkt) |

> **Zum Fenster:** Die Datei enthielt zusätzlich **35 Punkte vom 29.07. 17:43–18:05**, aus dem
> ersten, noch auf 14 h gesetzten Start. Sie sind **nicht verunreinigt** — gleiches Skript,
> gleiche Konfiguration, nur andere Laufzeitvorgabe — wurden aber abgeschnitten, damit das
> ausgewertete Fenster exakt 24 h ist. Ungeschnittenes Original liegt auf dem Gerät als
> `/var/tmp/stufe3-nacht-ungeschnitten-2026-07-30-182528.csv`. Ursache war
> `if [[ ! -f "$AUS" ]]`: der Kopf wird nur bei fehlender Datei geschrieben, der Neustart
> hängt sonst wortlos an. **Für künftige Läufe ein eindeutiger Dateiname**
> (`stufe3-$(date +%F-%H%M%S).csv`) — dieselbe Lehre wie bei Sicherungszielen.

### Die drei Kriterien

| Kriterium | Grenze | Ergebnis | |
|---|---|---|---|
| `samples_dropped` (`total` **und** `last1min`) | 0 | **0 über alle 2.317 Punkte** | ✅ |
| `get_throttled`, beide Hälften | `0x0` | **`throttle_now` und `throttle_ever` durchgehend 0** | ✅ |
| CPU-Temperatur | < 72 °C | **Maximum 76,4 °C**, 32,8 % der Punkte ≥ 72 | ❌ |

**Das Temperaturkriterium ist gerissen, das harte Kriterium nicht — und das ist die
eigentliche Aussage des Laufs.** Kein einziger Punkt erreichte 77 °C, keiner 80 °C.

```
CPU max   76,4 °C   30.07. 15:56   (außen 39,8 °C, raum_b 31,34 °C)
CPU min   63,8 °C   30.07. 07:00   (außen 17,7 °C, raum_b 28,02 °C)
Mittel / Median      70,2 / 70,6 °C
außen    17,3 … 39,8 °C      raum_b   27,21 … 31,73 °C
```

### Die Frage, für die der Lauf gebaut wurde: Umgebung, nicht Konsole

Zwei Größen entscheiden es, und beide sind vom Karussell unabhängig:

- Über **25 Stundenmittel** folgt die CPU-Temperatur der Raumtemperatur auf Gerätehöhe mit
  **R² = 0,84**. Die Kurve ist ein sauberer Tagesgang: Minimum um 07:00 bei kühlster Nacht,
  Maximum um 15:56 am heißesten Punkt des heißesten Tages der Hitzewelle.
- Der **Karussell-Aufschlag** — Abstand vom Stundenmaximum zum Stundenmittel — beträgt im
  Mittel nur **2,3 K**. Die sieben Seiten kosten gut zwei Kelvin; die übrigen zwölf zwischen
  Nacht- und Nachmittagswert kommen von draußen.

Ohne die von Henning vorgeschlagenen Umgebungsspalten stünde hier „76,4 °C, Kriterium
gerissen" — und die Suche hätte an der Konsole begonnen.

**Was hier bewußt nicht steht:** Die Regression liefert `CPU = 1,88 · raum_b + 15,0`, woraus
sich „bei 24 °C Raum nur ~60 °C" ableiten ließe. Diese Zahl wird **nicht** behauptet. Raum-
und Außentemperatur laufen an einem einzelnen Tag fast im Gleichtakt; die Regression kann
die beiden nicht trennen, und die Steigung 1,88 ist deshalb kein physikalischer Koeffizient.
24 °C liegt zudem **außerhalb** des gemessenen Bereichs (Minimum 27,21 °C). Für „im
Normalsommer unkritisch" braucht es einen zweiten Lauf bei anderem Wetter — das Format
dafür steht jetzt.

### Schichtung

`raum_a` (Decke) minus `raum_b` (Gerätehöhe): Mittel **0,39 K**, Maximum 1,36 K. Bei
Meßbeginn waren es 0,85 K. Der Abstand ist also **nicht gewachsen** — es staut sich keine
Wärme oben auf, die noch unterwegs wäre.

### Unabhängige Bestätigung von außen

Um **16:10:20 MESZ** kam eine FlightAware-Warnung „PiAware Receiver 'Bad Vilbel - Heilsberg'
Overheating", ausgelöst „within the past hour". Das lokale Maximum lag um **15:56** — mitten
in diesem Fenster. Zwei voneinander unabhängige Instrumente haben dasselbe Ereignis gesehen;
FlightAwares Schwelle liegt unter 76,4 °C. Die Mail selbst enthält keine Meßwerte.

### Bewertung der Abnahmegrenze

Die 72 °C waren **vor** dem ersten Lauf gesetzt, als niemand die Zahlen kannte — ein Proxy
für „wird zu heiß". Der Lauf zeigt: Der Proxy schlägt an, während die Größen, an denen
tatsächlich etwas verlorengeht, sich nicht bewegen. Zur Drosselgrenze der Hardware (80 °C)
blieben **3,6 K**.

Die Grenze wird hier **nicht** nachträglich verschoben — eine Grenze, die man nach der
Messung anpaßt, ist keine. Sie bleibt als Abnahmegrenze dokumentiert und als **gerissen**
vermerkt; die Entscheidung über ein künftiges Kriterium ist eine eigene, ausdrückliche, und
sie ist jetzt mit Daten statt mit Vermutung zu treffen.
