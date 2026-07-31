# Variante B im Betrieb — eine Stunde am Gerät

> 2026-07-27, `adsapp01`. 120 Meßpunkte im 30-Sekunden-Abstand, echte Konsole im
> Karussellbetrieb (Radar 45 s, Board und Statistik je 15 s).

## Warum diese Messung existiert

Variante B ist die Rückfallposition, nachdem der Canvas-Spike die Temperaturgrenze riß.
Eine Rückfallposition ist aber nur eine Behauptung, solange sie nicht dieselbe Prüfung
bestanden hat — sonst hätte der Spike die Frage nur verschoben statt beantwortet.

Gemessen wurde deshalb nicht an einer synthetischen Testseite, sondern an der **fertigen
Konsole im Regelbetrieb**. Das ist der ehrlichere Prüfling: Er enthält alles, was später
wirklich läuft, einschließlich der Seiten neben dem Radar.

## Ergebnis

| Kriterium (unverändert vom Spike) | Ergebnis |
|---|---|
| `samples_dropped` bleibt 0 | **gehalten** |
| `get_throttled` bleibt `0x0` | **gehalten** |
| Temperatur unter 72 °C | **gehalten** — Maximum 71,5 °C, Marge 0,5 K |

| Größe | Wert |
|---|---|
| Temperatur min / max / Mittel | 66,7 / 71,5 / 69,3 °C |
| erstes Viertel → letztes Viertel | 69,6 → **68,9 °C** |
| Punkte ≥ 71 °C | 6 von 120 |
| Load min / max / Mittel | 1,10 / 3,37 / 1,87 |
| Speicher belegt | 610–666 von 1843 MB |

## Vergleich mit dem Spike

| | Spike (Variante A) | Konsole (Variante B) |
|---|---|---|
| Temperatur max | 72,0 °C | 71,5 °C |
| Temperatur Mittel | 69,1 °C | 69,3 °C |
| Load Mittel | 2,75 | 1,87 |

**Der Gewinn liegt in den Spitzen und in der CPU-Reserve, nicht in der mittleren
Wärme.** Die Mittelwerte sind praktisch gleich; die Last ist ein Drittel niedriger. Wer
nur die Maximalspalte liest, überschätzt den Unterschied.

## Was der Verlauf zeigt und ein Maximum nicht zeigen kann

Erstes Viertel 69,6 °C, letztes Viertel 68,9 °C: Die Kurve **steigt nicht**. Das Gerät
hat sein thermisches Gleichgewicht gefunden und kriecht nicht langsam gegen die Grenze.
Das ist die eigentliche Aussage dieser Stunde — ein Momentwert oder eine
Fünf-Minuten-Messung hätte sie nicht liefern können, und die Frage nach dem Gehäuse und
der Kühlung ist ohnehin eine Verlaufsfrage.

## Einschränkungen

- **Die Marge ist dünn und hängt an der Raumtemperatur.** 0,5 K. Der Leerlaufwert dieses
  Geräts lag im Mai bei ~55 °C, an diesem Nachmittag bei 62,3 °C — rund sieben Kelvin
  Unterschied allein aus der Umgebung. Im Hochsommer kann derselbe Aufbau reißen. Dann
  gilt dieselbe Regel wie beim Spike: messen, nicht schönreden.
- Gemessen wurde eine Stunde, nicht ein Tag. Über Nacht (kein Verkehr, leerer Schirm)
  dürfte das Gerät kühler laufen; belegt ist das nicht.
- **Korrektur vom 28.07.: Die Radarseite war 60 % der Zeit sichtbar, nicht ein Drittel.**
  Der ursprüngliche Satz war nach den eigenen Zahlen dieses Dokuments falsch. `console.js`
  filtert `activePages` gegen die **registrierten** Renderer; am Meßcommit `be74d8a`
  registrierte `index.html` genau drei Seiten (Radar, Board, Statistik). Bei Standzeiten
  von 45 + 15 + 15 s ergibt das einen Umlauf von 75 s und einen Radaranteil von 45/75 =
  60 %.

  Das macht diese Stunde zu einem **härteren** Prüfling als den Regelbetrieb: Mit den
  sechs Seiten der Stufe 2 fällt der Radaranteil auf 45/120 = 37,5 %. **Daraus folgt
  nicht, daß die Konsole seither kühler läuft** — das wäre die Behauptung anstelle der
  Messung. Es folgt nur, daß die 0,5 K Marge unter ungünstigeren Bedingungen erarbeitet
  wurde als notiert.
