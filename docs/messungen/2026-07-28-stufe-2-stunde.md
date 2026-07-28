# Stufe 2 im Betrieb — eine Stunde am Gerät

> **KORRIGIERT am 28.07. abends.** Zwei Aussagen dieses Protokolls waren falsch und sind
> unten durchgestrichen: der behauptete Kaltstart und die daraus abgeleitete steigende
> Kurve. Ein zweiter Lauf hat beides widerlegt — siehe
> [`2026-07-28-stufe-2-stunde-2.md`](2026-07-28-stufe-2-stunde-2.md). Die Meßwerte und die
> drei Kriterien sind davon **nicht** berührt.
>
> 2026-07-28, `adsapp01`. 120 Meßpunkte im 30-Sekunden-Abstand, 16:07:50 bis 17:07:35,
> echte Konsole im Karussellbetrieb mit **sechs** Seiten (Radar 45 s, die übrigen fünf
> je 15 s, Umlauf 2:00).

## Die Kriterien standen vor der Messung fest

Unverändert vom Spike am 27.07. Sie stehen im Kopf des Meßskripts, damit sie hinterher
nicht gedeutet werden können.

| Kriterium | Grenze | Warum |
|---|---|---|
| `total.local.samples_dropped` | bleibt **0** | Das harte Kriterium. Verliert der SDR-Leser Samples, beschädigt die Anzeige den Zweck des Geräts. |
| `get_throttled` | bleibt `0x0` | Drosselung heißt, die Firmware greift bereits ein. |
| CPU-Temperatur | unter **72 °C** | Acht Kelvin Reserve zur harten 80-°C-Grenze. |

## Ergebnis

| Kriterium | Ergebnis |
|---|---|
| `samples_dropped` bleibt 0 | **gehalten** — alle 120 Punkte `0` |
| `get_throttled` bleibt `0x0` | **gehalten** — alle 120 Punkte `0x0` |
| Temperatur unter 72 °C | **gehalten** — Maximum **70,1 °C**, Marge **1,9 K** |

| Größe | Wert |
|---|---|
| Temperatur min / max / Mittel | 64,2 / 70,1 / **67,62 °C** |
| Punkte ≥ 71 °C | **0** von 120 |
| Punkte ≥ 70 °C | 2 von 120 |
| Last min / max / Mittel | 0,71 / 2,72 / **1,32** |
| Speicher belegt | 605–647 von 1843 MB |

### Baseline am selben Nachmittag

Ohne sie wäre der Absolutwert nicht deutbar — der Leerlaufwert dieses Geräts lag im Mai
bei ~55 °C, am 27.07. bei 62,3 °C.

| | Wert |
|---|---|
| Leerlauf **ohne** Kiosk, 28.07. gegen 16:02 | 63,3–64,2 °C, Mittel **63,6 °C** |
| dieselbe Größe am 27.07. | 62,3 °C |

**Heute war es also gut ein Kelvin wärmer als gestern.** Das macht das niedrigere Ergebnis
nicht kleiner, sondern größer.

## Der Verlauf — ~~und was er diesmal *nicht* zeigt~~ (dieser Abschnitt war falsch)

> **Alles ab hier bis zum nächsten Abschnitt ist widerlegt.** Der erste Meßpunkt war
> **68,1 °C**, nicht 64,2 — die 64,2 waren das Minimum an Position 11, mitten im Lauf.
> Es gab keinen Kaltstart, und die „steigende Kurve" ist Rauschen: Der mittlere Sprung
> zwischen zwei Meßpunkten beträgt 1,15 K und ist damit größer als die behauptete Drift.
> Über beide Läufe hinweg (zweieinhalb Stunden) liegen die Zehn-Minuten-Blockmittel
> zwischen 67,46 und 68,55 °C — das Gerät **ist** im Gleichgewicht. Der Text bleibt
> stehen, damit die Korrektur nachvollziehbar ist.

| Zehn-Minuten-Block | Mittel |
|---|---|
| 16:07–16:17 | 66,97 °C |
| 16:17–16:27 | 67,58 °C |
| 16:27–16:37 | 67,49 °C |
| 16:37–16:47 | 67,46 °C |
| 16:47–16:57 | 68,14 °C |
| 16:57–17:07 | 68,06 °C |

**Die Kurve steigt.** Über die ganze Stunde mit +1,17 K/h, über die zweite Hälfte mit
+1,33 K/h. Am 27.07. fiel sie (69,6 → 68,9 °C im Viertelvergleich), und genau das war
damals die eigentliche Aussage: „Das Gerät hat sein thermisches Gleichgewicht gefunden
und kriecht nicht langsam gegen die Grenze."

**Diese Aussage läßt sich heute nicht wiederholen — und der Grund liegt im Meßaufbau,
nicht im Gerät.** Unmittelbar vor der Stunde wurde die Leerlauf-Baseline erhoben, wofür
der Kiosk fünf Minuten stand. Das Gerät startete die Messung deshalb aus dem abgekühlten
Zustand (erster Punkt 64,2 °C, Leerlauf 63,6 °C), und die Aufwärmphase liegt **im
Meßfenster**. Am 27.07. lief die Konsole vorher bereits.

**Die beiden Trends sind damit nicht vergleichbar.** Wer die +1,17 K/h von heute gegen die
−0,7 K von gestern hält, vergleicht eine Messung mit Aufwärmphase gegen eine ohne. Das ist
derselbe Fehler wie ein A/B-Vergleich mit unfixierter Eingabe, und er ist hier
hausgemacht.

Was sich sagen läßt: In der zweiten Hälfte, also nach dem Aufwärmen, liegt der Anstieg bei
+0,44 K zwischen dem ersten und letzten Viertel — bei einer Streuung von rund ±2 K
innerhalb jedes Blocks, die aus den unterschiedlich teuren Karussell-Seiten stammt. Ob das
Restanstieg oder Rauschen ist, entscheidet diese Stunde nicht.

## Vergleich mit der Variante-B-Stunde (27.07.)

| | 27.07. — 3 Seiten, 60 % Radar | 28.07. — 6 Seiten, 37,5 % Radar |
|---|---|---|
| Baseline Leerlauf | 62,3 °C | **63,6 °C** |
| Temperatur max | 71,5 °C | **70,1 °C** |
| Temperatur Mittel | 69,3 °C | **67,62 °C** |
| Punkte ≥ 71 °C | 6 von 120 | **0** von 120 |
| Last Mittel | 1,87 | **1,32** |
| Speicher | 610–666 MB | 605–647 MB |
| Marge zur Grenze | 0,5 K | **1,9 K** |

**Daraus folgt nicht, daß die drei neuen Seiten nichts kosten.** Es haben sich zwei Dinge
gleichzeitig geändert — drei Seiten kamen hinzu, und der Radaranteil fiel von 60 % auf
37,5 %. Ein kühleres Ergebnis darf **nicht** als „die neuen Seiten sind gratis" gelesen
werden; das wäre der A/B-Vergleich mit unfixierter Eingabe. Gemessen wurde der
Liefergegenstand, nicht die Zurechnung. Wer die Zurechnung braucht, braucht einen zweiten
Lauf mit eingefrorener Konfiguration.

Der plausibelste Beitrag ist ohnehin der Radaranteil: Die Radarseite ist die einzige mit
Dauer-Animation, und sie ist jetzt ein gutes Drittel statt zwei Drittel der Zeit sichtbar.

## Was diese Messung nicht zeigt

- **Das thermische Gleichgewicht.** Siehe oben — die Aufwärmphase liegt im Fenster, das
  ist ein Fehler des Aufbaus. Für eine Aussage über den Dauerbetrieb braucht es einen
  Lauf, dem keine Abkühlung vorausgeht.
- **Den Beitrag der einzelnen neuen Seiten.** Zwei Änderungen zugleich, keine Zurechnung.
- **Den Tag.** Gemessen wurde eine Stunde an einem Julinachmittag, 16:07 bis 17:07.
- **Den ausgerollten Stand gegen HEAD.** Gemessen wurde die Fassung, die um 14:37:51 auf
  das Gerät kam. HEAD trägt seither einen `try`/`finally`-Umbau in `console.js`, der
  verhaltensgleich ist, solange nichts wirft — aber gemessen ist er nicht.
- **Die Nacht.** Bei leerem Luftraum rendert jede Seite ihren Leerzustand; das dürfte
  billiger sein, belegt ist es nicht.

## Rohdaten

`/tmp/stufe2-stunde.csv` auf dem Gerät, 120 Zeilen, Spalten:
`zeit;temp_c;throttled;load1;load5;load15;mem_used_mb;samples_dropped_total`.
Das Meßskript lief über `setsid` losgelöst auf dem Gerät, nicht über eine SSH-Sitzung —
eine Messung, die an einer Verbindung hängt, ist keine.

**Ein Eingriff während der Messung ist protokolliert:** Ein Subagent führte gegen 16:5x
`tests/keine-empfaengerposition.sh` aus, das intern per SSH ein `receiver.json` über HTTP
liest. Der Auftrag hatte SSH untersagt; der Widerspruch stand im Auftrag selbst, der zwei
Absätze später genau dieses Skript verlangte. Die Meßreihe wurde daraufhin auf einen
Ausreißer geprüft — keiner vorhanden, die Werte laufen unverändert weiter.
