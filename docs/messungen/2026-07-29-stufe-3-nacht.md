# Wärmelauf Stufe 3 — die Nacht vom 29. auf den 30.07.

> Begonnen 2026-07-29 17:43 auf `adsapp01`, **sieben Seiten**, Umlauf 135 s (2:15),
> Radaranteil 33 %. Geplantes Ende 30.07. gegen 07:45.
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

**Zu `raum_a` und `raum_b`:** Es sind zwei Aqara-Sensoren, `…be8afd` und `…d3cb76`, die am
29.07. 30,42 bzw. 29,57 °C und 34,6 bzw. 34,7 % rF lasen. **Welcher der beiden neben
`adsapp01` steht, ist noch nicht zugeordnet** — die Meßwerte allein unterscheiden sie
nicht, und ein Sensor, den man aus zwei Kandidaten errät, ist keine Messung. Beide werden
mitgeschrieben; die Zuordnung wird nachgetragen.

## Ergebnis

> Wird nach dem Lauf nachgetragen.
