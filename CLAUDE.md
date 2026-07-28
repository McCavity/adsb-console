# CLAUDE.md

Hinweise für Claude Code in diesem Repository. Menschen lesen zuerst
[README.md](README.md), dann die Spec unter `docs/specs/`.

## Was das Projekt ist

Eine Kiosk-Anzeige („ATC-Konsole") für ein 7"-DSI-Touchpanel an einem
Raspberry Pi 4, der einen ADS-B-Empfänger betreibt. Der maßgebliche Entwurf ist
[`docs/specs/2026-07-27-atc-konsole-design.md`](docs/specs/2026-07-27-atc-konsole-design.md)
— er enthält die am Gerät gemessenen Randbedingungen samt Meßverfahren. Diese Zahlen
sind nicht dekorativ: Maßstab, Standzeiten und Abbruchkriterien leiten sich aus ihnen ab.

## Nicht verhandelbar

- **Die exakte Empfängerposition gehört nicht ins Repo** — sie ist faktisch eine
  Wohnadresse. Kein Testfixture, kein Beispiel-Config, kein Kommentar enthält sie, auch
  keine gerundete Fassung; Tests verwenden erfundene Koordinaten.
  Gelesen wird sie zur Laufzeit aus den Argumenten `--lat`/`--lon` des laufenden
  `dump1090-fa` (`/proc/<pid>/cmdline`) — **nicht** aus `/etc/default/dump1090-fa`: Dort
  heißen die Schlüssel `RECEIVER_LAT`/`RECEIVER_LON` und sind auf diesem Gerät leer. Die
  frühere Behauptung an dieser Stelle hat einen Critical gekostet; siehe
  `docs/messungen/2026-07-27-positionsquelle.md`.
- **Keine Fremdquelle zur Laufzeit.** Keine CDN-Schrift, keine Kartenkacheln, keine
  externe Bibliothek. Alles wird lokal ausgeliefert. Diese Eigenschaft wird bei der
  Abnahme durch Ziehen des Netzsteckers geprüft, nicht behauptet.
  Die einzige gebundelte Fremddatei ist `console/fonts/B612Mono-Regular.ttf` (SIL OFL 1.1,
  Herkunft und Prüfsumme in `console/fonts/HERKUNFT.md`) — sie wird **nur im Radarkreis**
  benutzt und wie `console/data/airports.json` einmal beim Bauen eingefroren. Die Herkunft
  ist belegt, nicht behauptet: SHA256 geprüft gegen einen frischen Download der
  Originalquelle und gegen die am Gerät ausgelieferte Fassung, alle drei identisch.
- **Kein Umbau am ADS-B-Stack.** Weder `dump1090-fa` noch die Feeder noch die
  lighttpd-Konfiguration werden angefaßt. Die Konsole liest nur.
- **`get_throttled` hat zwei Hälften.** Bits 0–3 sind „jetzt", Bits 16–19 „seit dem
  Boot einmal". Sie bleiben in Daten und Anzeige getrennt; das Zusammenwerfen hat auf
  dem Schwesterprojekt schon einen Fehlalarm erzeugt.

## Arbeitsweise

- **Am Gerät messen, nicht annehmen.** Das gilt besonders für die Displaydrehung: Die
  Textkonsole dreht `fbcon=rotate:`, der Compositor braucht seine eigene Transformation,
  und Toucheingaben drehen unter labwc **nicht** automatisch mit (eigene
  `calibrationMatrix`, aus demselben Wert abgeleitet).
- **Vor der Freigabe absichtlich falsch bedienen.** Kaputte Konfiguration, getöteter
  Daemon, leerer Luftraum, gezogenes Netzkabel — die Liste steht in §10.3 der Spec.
- **Jeder Test wird einmal absichtlich rot gesehen**, bevor ihm geglaubt wird.
- Anzeigesprache ist Deutsch, Fachbegriffe (Squawk, Track, FL, Heavy) bleiben englisch.
  Einheiten durchgehend nautisch: NM, Knoten, Flugfläche.

## Struktur

```
console/   Statik-Frontend (HTML/CSS/JS, gebundelter Font, statische Flugplatzdaten)
  js/geo.js          reine Rechenfunktionen, ohne DOM und ohne Zustand — hier liegen die Tests
  js/pages/target.js   Einzelziel — volles Datenblatt zum eingefrorenen Ziel
  js/pages/profile.js  Höhenprofil — Seitenriß über der Entfernung
  js/pages/system.js   System — Temperatur, Last, Dienste, samples_dropped
  fonts/             B612 Mono, gebundelt, nur im Radarkreis (fonts/HERKUNFT.md)
daemon/    Schreiber-Daemon, nur Python-Standardbibliothek
config/    console.json — Seitenschalter und Standzeiten
tests/     node --test für geo.js und die Seiten-Module, unittest für den Daemon
```
