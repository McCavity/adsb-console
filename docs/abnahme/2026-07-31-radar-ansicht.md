# Abnahme Radar-Ansicht — Block 1 und 2

> Datum: 2026-07-31, 18:14–18:22
> Gerät: `adsapp01`, Raspberry Pi 4 Model B Rev 1.5, 7"-DSI-Panel, Debian 13 trixie
> Stand: Branch `session/2026-07-31-radar-ansicht`, 19 Commits, 210 Tests / 0 Fehler
> Entwurf: [`docs/specs/2026-07-31-radar-ansicht-entwurf.md`](../specs/2026-07-31-radar-ansicht-entwurf.md)

**Status: Block 1 und 2 abgenommen** (Fazit in Abschnitt 9). Rendering, Ausrollen und Glyph
sind belegt, die elf Bedienprüfungen am Touchpanel bestanden (Abschnitt 7) und die
Wärmemessung bei 80 NM ist gelaufen (Abschnitt 8).

> [!note]
> Bis zum 31.07.2026 stand hier noch „teilweise abgenommen … stehen aus", während dasselbe
> Dokument zwanzig Zeilen weiter unten beides als erledigt auswies. Eine Kopfzeile, die dem
> eigenen Inhalt widerspricht, ist genau die Sorte Statuszeile, gegen die dieses Projekt
> sonst anschreibt — aufgefallen erst beim Nachziehen des README für die Veröffentlichung.

## 1. Ausgangslage (read-only, vor jedem Eingriff)

| Größe | Wert |
|---|---|
| Laufzeit | 3 d 21 h |
| CPU-Temperatur | **71,5 °C** (Kriterium 72 °C) |
| `get_throttled` | `0x0` |
| Maßstab | 50 NM |

Zwei Annahmen aus dem Plan haben sich am Gerät als falsch erwiesen und sind hier
festgehalten, damit die nächste Session sie nicht wiederholt:

- **`git` ist auf `adsapp01` nicht installiert.** Der Baum unter `/home/pi/adsb-console` ist ein
  `rsync`-Spiegel, kein Klon — sein Stand ist nicht per `git log` abfragbar, sondern nur über
  Dateihashes.
- **Der Docroot ist `/var/www/html/atc`**, nicht `/var/www/html/console`.

## 2. Vorher-Nachweis: der Ringfilter (Aufgabe 2)

Auf einer **eingefrorenen Kopie** des ausgelieferten Standes (`/var/tmp/vorher-…`, produktiver
Pfad unangetastet), `range_nm` auf 10 gestellt, eigener `http.server` auf 8099, Aufnahme
headless im Chromium des Geräts. Datenquelle: eine Momentaufnahme von `aircraft.json`
(29 Ziele, 14 mit Position) — **dieselbe Datei** wurde für den Nachher-Lauf verwendet, damit
nicht die Systemdrift ins Ergebnis wandert.

### Was gemessen wurde

| | vorher | nachher |
|---|---|---|
| Maßstabskachel | `Ringe 10 · 25 · 50` | **`Ringe 10`** |
| sichtbare Ringe im Kreis | nur der Außenring | nur der Außenring |

### ⚠️ Korrektur am Plan: Schritt 1 belegt etwas anderes als vorhergesagt

Der Plan erwartete *„zwei Ringe außerhalb des Kreises"*. **Das war falsch gerechnet.** Bei
`range_nm: 10` liegen die Ringe 25 und 50 bei 2,5- bzw. 5-fachem Radius — also weit außerhalb
der 620-px-Leinwand. Sie werden gezeichnet, aber **abgeschnitten und damit unsichtbar**.

Der Defekt war deshalb nie ein sichtbarer Überstand, sondern etwas Subtileres: **Die
Maßstabskachel behauptete drei Ringe, von denen zwei gar nicht im Bild sein konnten.** Eine
Anzeige, die über den eigenen Zustand falsch berichtet — dieselbe Fehlerklasse wie das
`decay_s`-Feld, das `radar.js:294` beschreibt.

Das Bild selbst ist damit weiter gültig; nur die Deutung im Plan war es nicht. Wer eine
Vorhersage in einen Prüfplan schreibt, ohne sie zu rechnen, prüft am Ende gegen die eigene
Erwartung statt gegen die Sache.

**Nebenbefund, nicht von diesem Branch verursacht:** Bei 10 NM drängen sich die Ziele am
östlichen Rand, und ihre Beschriftungen laufen über die Leinwandkante in die Datenspalte
hinein (`TAP72LP FL049 2021` über `ZIELE MIT POSITION`). Das Ausweichen in `radar.js:93`
greift nur nach links, nicht nach oben oder unten. Auf beiden Bildern gleich vorhanden, also
älter als dieser Branch. Eigener Punkt.

## 3. Ausrollen

Über den im README dokumentierten Weg, nicht über ein ad-hoc-Rezept:

1. `rsync -a --delete --exclude '.superpowers' ./ adsapp01:/home/pi/adsb-console/`
   → **16 Frontend-Dateien dateiweise hashgleich** mit dem Arbeitsbaum verifiziert.
2. Frontend-Schritt mit vorheriger Sicherung
   (`/var/tmp/sicherung-docroot-2026-07-31-181845.tar.gz`, 108 551 Bytes).
3. `systemctl restart atc-console`.

**Gegenprobe über HTTP, nicht im Dateisystem** — die Abschrift ist nicht das Original. Neun
Dateien geprüft, alle deckungsgleich:

```
OK  js/ansicht.js   js/console.js   js/pages/radar.js
OK  js/pages/polar.js   js/pages/board.js   js/pages/target.js
OK  js/geo.js   css/console.css   index.html
```

## 4. Zahnrad-Glyph — objektiv, nicht per Blick

`fonts-noto-color-emoji` wurde in Stufe 2 bewußt aus dem Installer entfernt. `⚙` (U+2699) ist
das einzige Nicht-ASCII-Zeichen der neuen Oberfläche, also war offen, ob es überhaupt eine
Kontur hat. Gemessen wurde die Renderbreite bei `22px system-ui, sans-serif`:

| Zeichen | Breite |
|---|---|
| `⚙` U+2699 | **19,72 px** |
| U+E000 (Private Use, garantiert konturlos) | 13,20 px |
| `M` (Kontrolle nach oben) | 18,98 px |

Das Zahnrad mißt wie ein echter Buchstabe, nicht wie ein Ersatzkasten. **Das Kontrollzeichen
ist der eigentliche Punkt:** Ohne eine Größe, deren Wert man vorher kennt, wären 19,72 px eine
Zahl ohne Aussage.

Am laufenden Panel bestätigt: Das Zahnrad steht im Kopf links neben der Uhr und ist **grün**
— die Palettenkorrektur aus der Schlußprüfung greift.

## 5. Normalbetrieb nach dem Ausrollen

Bild vom echten Panel (`grim` über `XDG_RUNTIME_DIR=/run/atc-console`, `WAYLAND_DISPLAY=wayland-0`):

| Größe | Wert |
|---|---|
| Maßstab | 50 NM, Ringe 10 · 25 · 50 — **unverändert gegenüber `main`** |
| Ziele mit Position | 12 von 25 |
| Nachrichten | 64/s |
| Flugplätze | gezeichnet |
| `get_throttled` | `0x0` |

Die Regressionsprobe zu Befund A der Schlußprüfung ist damit auch am Gerät bestanden: Mit der
geltenden `console.json` verhält sich der Branch identisch zum Stand vor der Änderung.

## 6. Meßstand abgebaut

Beide eingefrorenen Kopien gelöscht (sie enthielten `receiver.json`), `http.server` auf 8099
beendet und über `ss` gegengeprüft, `glyph.html` entfernt. Produktive Konsole `active`.

⚠️ **Ein Fehlgriff, festgehalten:** `pkill -f "http.server 8099"` hat die eigene SSH-Sitzung
getroffen — die Zeichenkette stand in der eigenen Kommandozeile. Dieselbe Falle wie am
30.07. (`pgrep -f` fand seine eigene Kommandozeile), diesmal nicht bloß irreführend, sondern
tödlich für den laufenden Befehl. Die produktive Konsole blieb unversehrt. Beim nächsten Mal
über den Port auflösen (`ss -tlnp`) statt über ein Muster.

## 7. Bilder

Nicht im Repo abgelegt, sondern im Sitzungs-Scratchpad
(`…/scratchpad/abnahme/`): `vorher-10nm.png`, `nachher-10nm.png`, `panel-live.png`.

**Grund:** Alle drei zeigen den Radarschirm mit Flugplätzen und Maßstab und sind damit genau
das Material, aus dem der Empfängerstandort rechenbar ist. Sie gehören in den
Doku-Durchgang vor der Veröffentlichung und nicht vorher unbesehen ins Repo. Der Loop dazu ist
in [[open-loops]] erfaßt.

## 8. Offen

### Bedienprüfung am Touchpanel — ✓ 31.07. durch Henning, alle elf bestanden

Konnte nicht ferngesteuert werden: Es gibt keinen Weg, Berührungen einzuspeisen
(`--remote-debugging-port` ist bewußt nicht gesetzt, und für eine Abnahme wird er auch nicht
angeschaltet).

- [x] Zahnrad antippen → Dialog öffnet
- [x] Reichweite 10 / 50 / 80 durchschalten, **und wieder zurück auf 50**
- [x] Flugplätze aus, **und wieder an**
- [x] Zwei schnelle Umschaltungen hintereinander
- [x] Dialog offen lassen, 60 s warten → Karussell läuft weiter und schließt ihn
- [x] Einmal im 50-s-Takt tippen → Dialog bleibt offen, schließt danach trotzdem
- [x] Wischen bei offenem Dialog
- [x] Auf eine andere Seite blättern → Zahnrad verschwindet
- [x] Höhenprofil bei 10 NM: beschriftet 10 NM
- [x] Reichweite-Seite bei 10 NM: Gitter unverändert (siehe Korrektur in Entwurf 4.3)
- [x] Tafel und Einzelziel bei 10 NM: kein Ziel jenseits von 10 NM mehr

**Unabhängig davon am Gerät nachgemessen** (`grim`, gezielter Ausschnitt der Maßstabskachel,
drei Aufnahmen im 45-s-Abstand, damit mindestens eine die Radarseite trifft): Bei aktiver
80-NM-Stufe zeigt die Kachel `80 NM · Ringe 20 · 50 · 80`.

Das belegt nebenbei die ganze Stufenmechanik am realen Gerät, nicht nur im Test: Die
80-NM-Stufe trägt ihre eingebauten Ringe, während `console.json` mit `rings_nm: [10, 25, 50]`
ausschließlich die 50-NM-Stufe überschreibt — genau das Verhalten aus Befund A der
Schlußprüfung.

### Wärmemessung bei 80 NM — ✓ 31.07., 18:38–19:08

60 Punkte im 30-Sekunden-Takt, Stufe am Panel gesetzt und **vor dem Start unabhängig
gegengeprüft** (`grim`-Ausschnitt der Maßstabskachel: `80 NM · Ringe 20 · 50 · 80`) — nicht
angenommen, daß sie steht.

| Größe | Wert |
|---|---|
| CPU min / max | 69,6 / **74,0 °C** |
| Mittel / Median | 71,8 / 72,0 °C |
| über 72 °C | 14 von 60 Punkten (23 %) |
| über 75 °C | **0** |
| `get_throttled` | durchgehend `0x0` |

**Die 80-NM-Stufe kostet keine meßbare Wärme.** Der Vergleich zum 24-h-Lauf vom 30.07. (auf
50 NM): dort **76,4 °C** Maximum und 32,8 % der Punkte über 72. Heute abend auf der
*größten* Stufe: 74,0 °C und 23 %. Die größere Reichweite liegt damit **unter** dem
Referenzlauf der kleineren.

Der Grund steht in den mitgeschriebenen Zielzahlen — und ohne sie wäre er nicht auffindbar
gewesen:

| | min | max | Mittel |
|---|---:|---:|---:|
| Ziele ≤ 50 NM | 4 | 18 | 9,5 |
| Ziele ≤ 80 NM | 4 | 19 | 10,6 |
| **Aufschlag 80 gegen 50** | **0** | **4** | **1,1** |

Die Sorge der Schlußprüfung war, daß 80 NM deutlich mehr Blips bedeutet und damit mehr
laufende CSS-Animationen. **Im Mittel ist es ein einziges Ziel.** Der beherrschende Faktor
bleibt die Umgebungstemperatur — der Befund vom 30.07. (R² = 0,84) wird davon nicht berührt.

⚠️ **Was diese Messung ausdrücklich nicht sagt:** Sie lief an einem Freitagabend mit dünnem
Verkehr (im Mittel 9,5 Ziele innerhalb 50 NM). Zur Mittagszeit mit dichtem Verkehr wäre der
Aufschlag zwischen 50 und 80 NM größer, und damit auch sein Wärmebeitrag. Aus einem ruhigen
Abend „unkritisch" zu machen, wäre derselbe Fehlschluß wie aus einem einzelnen Tag einen
Vorfall — er ist am 25.07. schon einmal passiert. Wer die Frage wirklich beantworten will,
wiederholt den Lauf zur Hauptverkehrszeit.

Rohdaten: `waerme-80nm.csv` im Sitzungs-Scratchpad, 60 Punkte, sieben Spalten.

---

## 9. Fazit

Die Abnahme ist bestanden. Elf Bedienprüfungen am Panel, das Ausrollen über HTTP
gegengeprüft, der Zahnrad-Glyph objektiv gegen ein Kontrollzeichen gemessen, die
Stufenmechanik am Gerät belegt, und die Wärmefrage beantwortet. Zwei Vorhersagen aus Plan und
Entwurf haben der Messung nicht standgehalten und sind an Ort und Stelle korrigiert (der
Ring-Überstand in Abschnitt 2, die Anwesenheitsspur in der Repo-Durchsicht).

Offen bleibt nur, was bewußt ausgelagert ist: die Fotosession mit synthetischer Quelle und
der Doku-Durchgang vor der Veröffentlichung.
