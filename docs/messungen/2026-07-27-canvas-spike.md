# Meß-Spike: Was kostet die Radar-Animation auf dem Gerät?

> 2026-07-27, `adsapp01` (Raspberry Pi 4, 1843 MB), echter Chromium-Kiosk auf dem
> 7"-Panel. 10 Meßpunkte Baseline, 60 Meßpunkte Animation, je 30 s Abstand.

## Warum überhaupt gemessen wurde

Die Radarseite ist die einzige Seite mit Dauer-Animation, und sie läuft auf einem Gerät,
das nebenher vier Dienste betreibt und dessen eigentlicher Zweck ein ADS-B-Feed ist. Die
Konsole ist Zugabe; der Feed ist der Grund, warum das Gerät existiert. Ob die Animation
bezahlbar ist, war deshalb eine Meßfrage — kein Geschmacksurteil und keine
Erfahrungsübertragung vom Schwesterprojekt.

## Die Grenzen standen vor der Messung fest

| Kriterium | Grenze | Warum |
|---|---|---|
| `samples_dropped` | bleibt **0** | Das harte Kriterium. Verliert der SDR-Leser Samples, beschädigt die Anzeige den Zweck des Geräts. |
| `get_throttled` | bleibt `0x0` | Drosselung heißt, die Firmware greift bereits ein. |
| CPU-Temperatur | **unter 72 °C** | Acht Kelvin Reserve zur harten 80-°C-Grenze. |

Die Spike-Seite war **absichtlich teurer** gebaut als die geplante Radarseite: volle
620×620-Fläche, 30 Bilder je Sekunde, Phosphor-Abklingen über den ganzen Schirm, 30
Blips. Wer den günstigsten Fall mißt, mißt am Risiko vorbei.

## Ergebnis

| | Baseline (stehende Seite) | Animation |
|---|---|---|
| Temperatur min / max | 61,3 / 65,7 °C | 66,7 / **72,0** °C |
| Temperatur Mittel | 62,7 °C | 69,1 °C |
| Mittel der letzten 20 Punkte | — | 70,0 °C |
| Load Mittel / Spitze | 0,39 / 0,47 | 2,75 / **3,49** |
| `get_throttled` | `0x0` durchgehend | `0x0` durchgehend |
| `samples_dropped` | 0 | **0** |

| Kriterium | Ergebnis |
|---|---|
| `samples_dropped` bleibt 0 | **gehalten** |
| `throttled` bleibt `0x0` | **gehalten** |
| Temperatur unter 72 °C | **gerissen** — Maximum 72,0 °C, Marge 0,0 K |

## Entscheidung: Variante B

Nach der vorab vereinbarten Regel reicht ein gerissenes Kriterium. Gebaut wird
**Variante B**: die Keule als einzelnes Element mit `conic-gradient` und CSS-Animation,
die Blips als Elemente mit phasenversetzter CSS-Animation, beide vom Compositor bewegt.
JavaScript läuft nur noch einmal je Sekunde beim Dateneingang.

Die Versuchung, hier anders zu entscheiden, war real: 72,0 ist die Rundung eines Wertes
knapp darunter, das harte Kriterium hielt, und die Spike-Seite war teurer als die echte.
Jedes dieser Argumente ist für sich richtig. Zusammengenommen hätten sie eine Grenze
aufgeweicht, die genau für diesen Moment vorher aufgeschrieben wurde — eine Grenze, die
man nach der Messung verschiebt, ist keine.

Die Alternative wurde ausdrücklich als Entscheidung vorgelegt (zweite Messung mit den
echten Parametern, oder Grenze bewußt anheben) und verworfen: **Variante B, wie
vereinbart.**

## Zwei Einschränkungen, die später leicht vergessen werden

1. **Die Marge hängt an der Raumtemperatur.** Der Leerlaufwert dieses Geräts lag im Mai
   bei ~55 °C, heute bei 62,3 °C — rund sieben Kelvin Unterschied allein aus den
   Umgebungsbedingungen. Eine Messung an einem kühlen Tag hätte dasselbe Kriterium
   bestehen lassen, und dieselbe Animation würde im Hochsommer weiter reißen. Die Zahlen
   hier gelten für die Bedingungen dieses Nachmittags, nicht allgemein.
2. **Die Spike-Seite war absichtlich teurer als die geplante.** Variante A könnte mit den
   echten Parametern (weniger Bilder je Sekunde, kleinere Fläche) durchaus unter der
   Grenze bleiben. Das ist kein Grund, dieses Ergebnis anders zu lesen — es wäre eine
   **neue** Messung, keine andere Deutung der vorliegenden.

## Was diese Messung nicht zeigt

- Das Verhalten über Tage. Gemessen wurden 30 Minuten unter Vollast.
- Die Kosten von Variante B. Die wird nach demselben Verfahren gemessen, bevor sie
  freigegeben wird — sonst wäre der Rückfall genau die unbelegte Annahme, gegen die
  dieser Spike gebaut wurde.
- Den Einfluß des Karussells: Die Animation läuft nur, solange die Radarseite sichtbar
  ist. **Korrektur vom 28.07.:** Der ursprüngliche Satz nannte hier „ein Drittel der
  Zeit" — das war eine Annahme, keine Messung, und traf schon für den Meßcommit dieses
  Spikes nicht zu (drei registrierte Seiten, 60 % Radaranteil; siehe
  `docs/messungen/2026-07-27-variante-b-stunde.md`). Mit den sechs Seiten der Stufe 2
  sind es 37,5 %.
