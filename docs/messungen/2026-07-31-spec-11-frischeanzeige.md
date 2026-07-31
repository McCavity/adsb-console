# Spec 11 — überlebt eine statische synthetische Quelle die Frischeanzeige?

> 31.07.2026 · Gerät `adsapp01` · Chromium 150.0.7871.181 (Debian 13, aarch64)
> Anlaß: Spec 11 des Radar-Entwurfs — blockiert die Fotosession für die Veröffentlichung
> Ergebnis: **Ja, die Kopfzeile überlebt sie** — kein Generator nötig.
> Aber die **Systemseite** tut es nicht: „Daemon geschrieben vor" wird ab 30 s **rot**.

## Die Frage

Setzt der Store `aircraftAt` nur bei **geänderten** Daten statt bei jedem **erfolgreichen**
Abruf, dann steht nach 60 Sekunden „keine Daten seit HH:MM" in der Kopfzeile und die Seite
bekommt die `stale`-Klasse (`console.js:89`, `data.js:107`) — auf **jedem** Foto. Dann müßte
ein Generator die Datei fortschreiben, statt sie statisch zu lassen.

Der Code sagt: `state.aircraftAt = Date.now()` steht in `data.js:60` **unbedingt** im
Erfolgszweig, nicht hinter einem Vergleich. Das ist ein Lesebefund, keine Messung — die
Anzeige hängt zusätzlich daran, daß der Abruf über 60+ Sekunden hinweg überhaupt gelingt.

## Meßstand

Eingefrorene Kopie des **ausgelieferten** Docroots unter `/var/tmp/spec11-2026-07-31-193844`
(`cp -r /var/www/html/atc`), darunter ein selbst angelegter `skyaware/data/`-Unterbaum: `DATA`
ist der absolute Pfad `/skyaware/data/`, und `receiver.json` (`data.js:88`) wie `stats.json`
(`data.js:69`) sind **nicht** über `?source=` umlenkbar. Die Zielquelle ist eine
handgeschriebene, unveränderliche `aircraft.json` mit sechs erfundenen Kennungen; ihr
`now`-Feld ist eingefroren — genau der Fall, um den es geht.

Ausgeliefert von einem eigenen `python3`-Server auf `127.0.0.1:8099+`, der **jeden Abruf
zählt** und auf Wunsch `aircraft.json` nach N Treffern mit 503 abweist. Gemessen mit dem
Chromium des Geräts, `--headless --dump-dom`; ausgewertet wird der DOM, nicht ein Bild.

Der produktive Pfad wurde nur gelesen. Der Kiosk und `lighttpd` blieben unangetastet
(`systemctl is-active atc-console` → `active`, echte `aircraft.json` 0,8 s alt, 25 Ziele).
Die vermessene Kopie ist der Repo-Stand: `data.js`, `console.js`, `pages/system.js`,
`pages/polar.js` sind hashgleich mit dem Arbeitsbaum.

### Kalibrierung 1 — geht die virtuelle Uhr überhaupt?

`--virtual-time-budget` beschleunigt die Seitenuhr; ohne Beleg ist das eine Annahme. Eine
Probeseite, die nichts tut als `Date.now() - start` und ihre Ticks anzuschreiben:

| Budget | Seite sah | Ticks | Realzeit |
|---|---|---|---|
| 70 000 ms | `verstrichen_ms=70000` | 70 | 2,486 s |

Exakt 70 Sekunden Seitenzeit in 2,5 Sekunden Realzeit, `setInterval` feuerte 70×. Die Uhr
ist echt beschleunigt, nicht ignoriert.

Gegenprobe im Betrieb, unabhängig von jeder Anzeige: die **Abrufzählung** des Servers. Bei
70 s Budget zählte er 70× `aircraft.json` (1/s), 14× `stats.json` (1/5 s: initial + 13) und
2× `range.json` (1/60 s: initial + t=60). Bei 128 s: 128 / 26 / 3. Gerechnet und getroffen.

### Kalibrierung 2 — kann der Stand überhaupt ROT melden?

Ein Meßstand, der nie ROT war, ist unkalibriert. Derselbe eingefrorene Stand, dieselbe
statische Datei, ein einziger Unterschied: `aircraft.json` kommt nur dreimal, danach 503.
Damit ist `aircraftAt != null`, und „keine Daten seit HH:MM" kann per Konstruktion **nur**
erscheinen, wenn auf der Seitenuhr wirklich 60 s vergangen sind.

## Läufe

Fahrplan aus der ausgelieferten `console.json` (Radar 45 s, sonst 15 s, Umlauf 135 s):
Radar [0,45) · Einzelziel [45,60) · Höhenprofil [60,75) · Reichweite [75,90) · Tafel
[90,105) · Empfang [105,120) · System [120,135). Jedes Budget wurde so gewählt, daß die
gewünschte Seite sichtbar **und** die 60-Sekunden-Schwelle längst überschritten ist.

| Lauf | Budget | Seite | Quelle | Anzeige | Punkt |
|---|---|---|---|---|---|
| A — statisch | 70 s | Höhenprofil | `aircraft` | `0 s` | `fresh` |
| **B — Kalibrierung** | 70 s | Höhenprofil | `aircraft` | **`keine Daten seit 19:39`** | **`stale`** |
| Reichweite | 85 s | Reichweite | `range` | `24 s` | `aging` |
| Empfang | 112 s | Empfang | `stats` | `1 s` | `fresh` |
| System | 128 s | System | `system` | `7 s` | `fresh` |
| Radar, 2. Umlauf | 160 s | Radar | `aircraft` | `0 s` | `fresh` |

Die Seitenklasse folgte dem Punkt in jedem Lauf (`page active fresh` bzw. `page active
stale`). Der `aging`-Punkt auf der Reichweite-Seite ist **kein** Artefakt der synthetischen
Quelle: `range.json` wird alle 60 s abgerufen, der Punkt ist also auch im Produktivbetrieb
fünf von sechs Sekunden bernsteinfarben.

**Antwort auf Spec 11: ja.** Alle fünf Alterungsquellen der Kopfzeile überleben eine
statische Datei, weil jede ihren Zeitstempel bei **jedem erfolgreichen Abruf** neu setzt
(`data.js:60,70,74,81`). Die Fotodaten dürfen statisch sein.

## Was die Messung nebenbei gefunden hat

Die Kopfzeile ist nicht die einzige Fläche, die eine Uhr liest. Drei Werte im **Seiteninhalt**
rechnen einen Zeitstempel **aus der Datei** gegen die echte Uhr:

1. **`system.json.written_at` → „Daemon geschrieben vor N s", rot ab 30 s**
   (`pages/system.js:102,166`). Gemessen: **217 s, Klasse `red`.** Das ist der einzige Wert,
   der einen echten Alarmzustand ins Bild setzt — ein Foto der Systemseite wäre unbrauchbar.
2. **`range.json` → „vor N min"** (`pages/polar.js:560`). Keine Schwelle, keine Farbe, aber
   eine eingefrorene Datei zeigt irgendwann „vor 340 min". Über `?range=` steuerbar.
3. `aircraft[].seen` → „zuletzt N s" auf der Einzelziel-Seite. Liest **keine** Uhr, bleibt
   einfach stehen. Unauffällig.

### Der Nachweis, daß die Reparatur trägt

Ein Vorschlag ohne Messung ist eine Behauptung. Derselbe Lauf, **eine** geänderte Variable:
`written_at` so gesetzt, daß es zum Aufnahmezeitpunkt der Seite 5 s alt ist.

| `written_at` | Daemon-Wert | Klasse |
|---|---|---|
| eingefroren (Kopie vom 19:36) | `217` s | `red` |
| frisch zum Aufnahmezeitpunkt | `6` s | *keine* |

Die 30-Sekunden-Schwelle hängt am Abstand und an nichts sonst.

## Folge für die Fotosession

- `aircraft.json`, `stats.json`, `receiver.json`, `range.json` dürfen **statisch** sein.
- `system.json` braucht ein `written_at`, das zum Auslösen jünger als 30 s ist — entweder
  unmittelbar vor der Aufnahme neu geschrieben oder von einem Dreizeiler alle 5 s
  fortgeschrieben. Das Feld wird sonst nirgends gelesen, der Eingriff ist folgenlos.
- Für die Reichweite-Seite gehört ein `seen_at` nahe der Aufnahmezeit in die synthetische
  `range.json`, sonst steht dort eine absurde Minutenzahl.
