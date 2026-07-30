# Höhenbudget der Datenspalte — am Panel nachgemessen

> 30.07.2026 · Gerät `adsapp01` · Chromium 150.0.7871.181
> Anlaß: §3.4 des Stufe-3-Entwurfs — „6 px Reserve, und Chromium auf dem Pi kann andere
> Zeilenhöhen liefern als der Meßbrowser"
> Ergebnis: **6,00 px, exakt wie entworfen. Kein Eingriff. Rückzug beziffert und
> bereitgelegt.**

Meßstand, Kalibrierung und Vorbehalte wie in [`2026-07-30-panel-schrift.md`](2026-07-30-panel-schrift.md)
— eingefrorene Kopie des Ausgelieferten, dieselbe `range.json` für jeden Lauf, gemessen an
der **laufenden Seite** über ein zusätzliches Modul in einer Kopie der `index.html` (die
Seite selbst unverändert; `diff` gegen das Original ist genau eine Zeile).

## Der Ausgangszustand

| | |
|---|---|
| `.polar-spalte`, nutzbare Höhe | 598 px |
| Kacheln 119 + 365 + 84, zwei Lücken à 12 | 598 px |
| Zeilenkachel innen (ohne Polsterung) | 337,00 px |
| Inhalt: Label + 12 Zeilen à 20 px + 11 Abstände à 6 px | 331,00 px |
| **frei** | **6,00 px** (2,84 oben / 2,86 unten) |

Die Zeilenhöhe auf dem Pi ist **20,00 px** — dieselbe wie im Entwurfsbrowser. Die Sorge aus
§3.4 hat sich also nicht bewahrheitet; die 6 px sind keine Schätzung mehr, sondern der
gemessene Wert auf dem Zielgerät.

**Je Zeile sind das 0,5 px.** Eine Schriftmetrik, die eine Zeile um 1 px höher macht,
reißt das Budget um 6 px.

## Wie es bricht, wenn es bricht

Absichtlich falsch bedient: jede der zwölf Zeilen um *k* px wachsen lassen.

| k | Zeilenkachel | Spalte `scrollHeight` | Folge |
|---|---|---|---|
| 0 | 366,7 | 598 (= Spaltenhöhe) | Sollzustand |
| 1 | 373,0 | 604 | Spalte läuft 6 px über, Puls-Kachel rutscht bis auf 676,3 — 0,3 px unter die Bühnenkante |
| 3 | 397,0 | 628 | Puls-Kachel liegt in der Punktreihe |
| 5 | 421,0 | 652 | Puls-Kachel läuft unter die 720-px-Kante und wird beschnitten |

**Nichts wird abgeschnitten, solange nur ein wenig fehlt** — die Kachel wächst mit ihrem
Inhalt (Flex-Element mit `min-height: auto`), und die Spalte schiebt nach unten heraus.
Keine Scrollleiste, kein abgeschnittener Text: Die *Puls*-Kachel wandert. Das ist die gute
Nachricht am Bruchbild — der Fehler zeigt sich als verrutschte Kachel, nicht als
verstümmelte Zahl. Die schlechte: Er zeigt sich erst am Panel, nicht im Test.

## Der Rückzug, beziffert

Eine schmalere Trophäe ist eine CSS-Zeile (`.pol-troph { font-size: … }`, heute 46 px).
Gemessen, was sie einbringt:

| Trophäe | Kachel 0 | gewonnen | frei in der Zeilenkachel | je Zeile |
|---|---|---|---|---|
| 46 px (heute) | 121,3 | — | 6,00 | 0,50 |
| 42 px | 117,1 | 4,20 | 10,00 | 0,83 |
| **38 px** | 112,9 | **8,41** | **14,00** | **1,17** |
| 34 px | 108,7 | 12,61 | 18,00 | 1,50 |
| 30 px | 104,5 | 16,80 | 23,00 | 1,92 |

**38 px ist die Marke, die zählt**: Sie fängt genau den Fall auf, der überhaupt zu
befürchten war — eine um 1 px höhere Zeile (1,17 px Luft je Zeile). Zweite Variante, falls
die Trophäe ihre Größe behalten soll: Der Untertitel darunter ist **20,00 px** hoch; sein
Wegfall bringt mehr als jede Verkleinerung, kostet aber die Angabe „Bereich · FL · Halter ·
Datum".

## Entscheidung

**Kein Eingriff.** Die Zahl, gegen die der Rückzug gebaut werden sollte, ist auf dem
Zielgerät gemessen und stimmt mit dem Entwurf überein. Ein Rückzug, der nicht gebraucht
wird, aber angetreten wird, ändert das Bild ohne Anlaß.

Der Rückzug gilt damit als **bereitgelegt, nicht ausgeführt**: eine Zeile, eine gemessene
Wirkung, hier nachschlagbar. Das ist die Forderung aus §3.4 („muß vor der Geräteabnahme
bereitliegen, nicht erst danach gebaut werden") — bereitliegen heißt beziffert, nicht
eingebaut.
