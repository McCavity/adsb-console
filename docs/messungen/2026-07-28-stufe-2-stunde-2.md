# Zweite Stunde — und die Korrektur der ersten

> 2026-07-28, `adsapp01`. 120 Meßpunkte im 30-Sekunden-Abstand, 18:21:20 bis 19:21:05,
> sechs Seiten im Regelbetrieb. **Ohne vorausgehende Abkühlung** — das war der Zweck.

## Warum dieser Lauf stattfand

Das Protokoll der ersten Stunde behauptete, die Kurve steige und das thermische
Gleichgewicht sei nicht zu zeigen, weil die Aufwärmphase im Meßfenster gelegen habe.
**Beides war falsch.** Dieser Lauf hat es aufgedeckt.

## Ergebnis

| Kriterium | Ergebnis |
|---|---|
| `total.local.samples_dropped` bleibt 0 | **gehalten** — alle 120 Punkte |
| `get_throttled` bleibt `0x0` | **gehalten** — alle 120 Punkte |
| Temperatur unter 72 °C | **gehalten** — Maximum **71,1 °C**, Marge **0,9 K** |

| Größe | Wert |
|---|---|
| Temperatur min / max / Mittel | 65,7 / 71,1 / **68,22 °C** |
| Punkte ≥ 71 °C | 1 von 120 |
| Punkte ≥ 70 °C | 8 von 120 |
| Last Mittel | 1,38 |
| Speicher | 592–663 MB |

## Korrektur 1: Kein Lauf startete kalt

Das erste Protokoll schrieb, die Messung habe „aus dem abgekühlten Zustand (erster Punkt
64,2 °C)" begonnen. **Der erste Punkt war 68,1 °C** — dieselbe Temperatur wie hier. Die
64,2 °C waren das **Minimum** an Position 11, mitten im Lauf. Minimum und Anfangswert
verwechselt.

```
Lauf 1, erste fünf Punkte:  16:07:50 68,1 · 67,2 · 67,2 · 66,2 · 67,6
Lauf 2, erste fünf Punkte:  18:21:20 68,1 · 67,6 · 67,2 · 66,2 · 69,6
```

Das Meßskript des ersten Laufs hatte einen dreiminütigen Nachlauf eingebaut; bis zum
ersten Punkt war das Gerät längst im Betriebsband. Die Erklärung „Aufwärmphase im
Meßfenster" hatte nie eine Grundlage.

## Korrektur 2: Die steigende Kurve war Rauschen

| | Lauf 1 | Lauf 2 |
|---|---|---|
| Standardabweichung der Einzelwerte | 1,05 K | 0,98 K |
| **mittlerer Sprung zwischen zwei Punkten** | **1,15 K** | **1,16 K** |
| größter Sprung | 2,9 K | 3,9 K |

**Der mittlere Sprung von einem Meßpunkt zum nächsten ist größer als die gesamte Drift,
die das erste Protokoll behauptet hat.** Eine Gerade durch solche Daten liefert eine
Steigung, die man nicht vom Rauschen trennen kann — und genau das habe ich getan, in
beide Richtungen gedeutet.

Das ruhigere Maß sind Zehn-Minuten-Blöcke. Über **beide Läufe hintereinander**, also gut
zweieinhalb Stunden:

| Block | °C | Block | °C |
|---|---|---|---|
| 1.1 | 66,97 | 2.1 | 67,69 |
| 1.2 | 67,58 | 2.2 | 68,24 |
| 1.3 | 67,49 | 2.3 | 68,27 |
| 1.4 | 67,46 | 2.4 | 68,05 |
| 1.5 | 68,14 | 2.5 | 68,55 |
| 1.6 | 68,06 | 2.6 | 68,53 |

Ohne den ersten Block (Nachlauf nach dem Kiosk-Neustart): **Spanne 67,46 bis 68,55 °C über
zweieinhalb Stunden, Standardabweichung der neun Blockmittel 0,377 K.**

**Das ist ein Gerät im thermischen Gleichgewicht.** Die Aussage, die das erste Protokoll
nicht treffen zu können glaubte, läßt sich treffen — sie stand nur hinter dem falschen
Maß.

## Korrektur 3: Die Messung ist unterabgetastet

Neu gefunden, und der eigentliche Grund für die scheinbare Schwankung:

**Der Meßabstand von 30 s teilt den Karussell-Umlauf von 120 s.** Jeder Meßpunkt trifft
deshalb immer dieselben vier Phasen des Umlaufs. Aufgeschlüsselt über beide Läufe:

| Phase | Mittel | min | max |
|---|---|---|---|
| **1** (jeder 4. Punkt) | **68,98 °C** | 67,2 | **71,1** |
| 2 | 67,78 °C | 66,2 | 70,6 |
| 3 | 67,31 °C | 64,2 | 69,1 |
| 4 | 67,60 °C | 65,2 | 69,6 |

**1,67 K systematischer Unterschied zwischen den Phasen** — mehr als die gesamte
Blockspanne über zweieinhalb Stunden. Phase 1 fängt die Radarseite, die einzige mit
Dauer-Animation und mit 45 von 120 Sekunden der größte Einzelblock des Umlaufs. Alle
Spitzen liegen dort. Die Temperatur korreliert positiv mit der Last (r = +0,31), was dazu
paßt.

**Für künftige Läufe:** einen Meßabstand wählen, der die Umlaufdauer **nicht** teilt —
etwa 37 s. Sonst mißt man vier feste Phasen statt eines Verlaufs, und ob die Spitzen oder
die Täler in der Reihe landen, ist Zufall der Startzeit.

## Was sich damit über die Marge sagen läßt

Im Mittel liegt das Gerät stabil bei **rund 68 °C**, vier Kelvin unter der Abnahmegrenze.
**Die Marge, auf die es ankommt, ist aber die am Maximum**, und die betrug in diesem Lauf
**0,9 K** — schlechter als die 1,9 K des ersten Laufs.

Der Unterschied zwischen den beiden Läufen (Mittel 67,62 gegen 68,22 °C) liegt bei rund
1,6 Standardabweichungen der Blockmittel. **Er ist zu klein, um ihn zuzurechnen**, und ich
tue es deshalb nicht — genau dieser Griff nach einer Erklärung hat das erste Protokoll
falsch gemacht. Möglich sind Raumtemperatur, angesammelte Wärme über zweieinhalb Stunden
oder schlicht die Phasenlage der Abtastung.

Was bleibt: **Die Spitzen erreichen 71 °C, und sie tun es in der Phase, die die Radarseite
fängt.** Das ist die Größe, die im Hochsommer zuerst reißen wird — nicht der Mittelwert.

## Was auch dieser Lauf nicht zeigt

- **Den Tag und die Nacht.** Zwei Stunden an einem Julinachmittag und -abend.
- **Die Zurechnung.** Weder zwischen den beiden Läufen noch zwischen den drei neuen
  Seiten. Dafür bräuchte es Läufe mit eingefrorener Konfiguration.
- **Einen sauberen Verlauf**, solange der Meßabstand die Umlaufdauer teilt.

## Rohdaten

`/tmp/stufe2-stunde-2.csv` auf dem Gerät, 120 Zeilen, dieselben Spalten wie beim ersten
Lauf.

**Ein Fehler im Skriptkopf ist zu vermerken:** Dort steht, die Konsole laufe „seit über
einer Stunde durch". Der Kiosk wurde um 18:10:57 neu gestartet, als die Konfiguration aus
dem Repo zurückgespielt wurde — zehn Minuten vor Meßbeginn. Die tragende Bedingung (keine
vorausgehende Abkühlung) war erfüllt, die Zeitangabe nicht.
