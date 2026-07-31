# Abnahme Radar-Ansicht — Block 1 und 2

> Datum: 2026-07-31, 18:14–18:22
> Gerät: `adsapp01`, Raspberry Pi 4 Model B Rev 1.5, 7"-DSI-Panel, Debian 13 trixie
> Stand: Branch `session/2026-07-31-radar-ansicht`, 19 Commits, 210 Tests / 0 Fehler
> Entwurf: [`docs/specs/2026-07-31-radar-ansicht-entwurf.md`](../specs/2026-07-31-radar-ansicht-entwurf.md)

**Status: Block 1 und 2 teilweise abgenommen.** Rendering, Ausrollen und Glyph sind belegt.
Die Bedienprüfung am Touchpanel und die Wärmemessung bei 80 NM stehen aus.

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

**Bedienprüfung am Touchpanel** — kann nicht ferngesteuert werden, es gibt keinen Weg,
Berührungen einzuspeisen (`--remote-debugging-port` ist bewußt nicht gesetzt):

- [ ] Zahnrad antippen → Dialog öffnet
- [ ] Reichweite 10 / 50 / 80 durchschalten, **und wieder zurück auf 50**
- [ ] Flugplätze aus, **und wieder an**
- [ ] Zwei schnelle Umschaltungen hintereinander
- [ ] Dialog offen lassen, 60 s warten → Karussell läuft weiter und schließt ihn
- [ ] Einmal im 50-s-Takt tippen → Dialog bleibt offen, schließt danach trotzdem
- [ ] Wischen bei offenem Dialog
- [ ] Auf eine andere Seite blättern → Zahnrad verschwindet
- [ ] Höhenprofil bei 10 NM: beschriftet es 10 NM?
- [ ] Reichweite-Seite bei 10 NM: bleibt ihr Gitter unverändert? (**muß es** — siehe Korrektur
      in Entwurf 4.3)
- [ ] Tafel und Einzelziel bei 10 NM: kein Ziel jenseits von 10 NM mehr

**Wärmemessung bei 80 NM** (Block 3, eigener Lauf): 30 Minuten auf der größten Stufe, dazu die
Blip-Zahl bei 50 und bei 80 NM gegenübergestellt. Ausgangslage bei Abnahmeende: **74,5 °C**,
`throttled=0x0`. Die 72 °C sind bereits im Ausgangszustand gerissen — das ist der Befund vom
30.07. (Ursache ist die Raumtemperatur, R² 0,84) und keine Folge dieser Änderung.
