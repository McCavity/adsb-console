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

- **Die exakte Empfängerposition gehört nicht ins Repo.** Sie steht auf dem Gerät in
  `/etc/default/dump1090-fa` und ist faktisch eine Wohnadresse. Kein Testfixture, kein
  Beispiel-Config, kein Kommentar enthält sie; Tests verwenden erfundene Koordinaten.
- **Keine Fremdquelle zur Laufzeit.** Keine CDN-Schrift, keine Kartenkacheln, keine
  externe Bibliothek. Alles wird lokal ausgeliefert. Diese Eigenschaft wird bei der
  Abnahme durch Ziehen des Netzsteckers geprüft, nicht behauptet.
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
  js/geo.js      reine Rechenfunktionen, ohne DOM und ohne Zustand — hier liegen die Tests
daemon/    Schreiber-Daemon, nur Python-Standardbibliothek
config/    console.json — Seitenschalter und Standzeiten
tests/     node --test für geo.js, unittest für den Daemon
```
