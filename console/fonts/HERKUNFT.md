# Herkunft der gebundelten Schrift

**B612 Mono Regular**, aus `https://github.com/polarsys/b612`,
Pfad `fonts/ttf/B612Mono-Regular.ttf`, geholt am 2026-07-28.

Lizenz: SIL Open Font License 1.1 — der vollständige Text liegt als `OFL.txt`
daneben, die Markenhinweise als `TRADEMARKS.md`. Beide wurden vor der Übernahme
gelesen, nicht angenommen.

SHA256 der Schriftdatei: b98cb96cc8a6206dae08c063d60902df7e6d40f86139ebdb97256704253c9c69

B612 wurde von Airbus für Cockpitanzeigen entworfen. Sie wird hier **nur im
Radarkreis** benutzt (Kontakt-Overlays, Flugplatzkennungen, Ringbeschriftung);
Kacheln, Tabellen und alle übrigen Seiten bleiben bei `ui-monospace`.

Die Datei ist einmal beim Bauen eingefroren worden, genau wie
`console/data/airports.json`. **Zur Laufzeit wird nichts nachgeladen** — das
wird bei der Abnahme durch Ziehen des Netzsteckers geprüft, nicht behauptet.
