# adsb-console

Eine ATC-Konsole für ein 7"-Touchpanel am eigenen ADS-B-Empfänger: ein Radarschirm und
sechs weitere Seiten in einem Karussell, die zeigen, was der Empfänger gerade sieht.

Die Konsole ist ein **Leser**. Sie liest die JSON-Ausgaben von `dump1090-fa` und ändert
nichts am ADS-B-Stack — der Feed ist der Zweck des Geräts, die Anzeige ist es nicht.

## Stand

**Stufe 1 läuft seit dem 27.07.2026 auf dem Gerät** — Radar, Board und Statistik, mit
Schreiber-Daemon und Kiosk-Autostart. Stufe 2 (Einzelziel, System, Höhenprofil) und
Stufe 3 (Reichweiten-Polar) folgen.

- Entwurf: [`docs/specs/2026-07-27-atc-konsole-design.md`](docs/specs/2026-07-27-atc-konsole-design.md)
- Abnahme am Gerät: [`docs/abnahme/2026-07-27-stufe-1.md`](docs/abnahme/2026-07-27-stufe-1.md)
- Messungen (Positionsquelle, Panel-Drehung, Animationskosten): [`docs/messungen/`](docs/messungen/)

## Die Idee in drei Sätzen

Ein kleiner Schreiber-Daemon (nur Python-Standardbibliothek) pollt `aircraft.json`,
führt Reichweiten-Rekorde je Himmelsrichtung in SQLite und legt zwei JSON-Dateien in
den Docroot des ohnehin laufenden lighttpd. Das Frontend ist reine Statik — kein
zweiter Webserver, kein Framework, keine externe Bibliothek, keine Quelle aus dem Netz
zur Laufzeit. Ein Chromium-Kiosk unter labwc zeigt es auf dem Panel.

## Seiten

| Seite | Inhalt |
|---|---|
| Radar | PPI mit umlaufendem Sweep, Nachglühen, Flugplätzen und Bahnen |
| Board | Zielliste nach Entfernung, samt der Ziele ohne Position |
| Einzelziel | das nächste Ziel groß, mit Squawk, FL, IAS/TAS/Mach, RSSI |
| Statistik | Nachrichtenrate, Signalpegel, Verstärkung, Track-Güte |
| Polar | Reichweite je Sektor mit Rekordhalter |
| Höhenprofil | Verteilung über die Flugflächen |
| System | Temperatur, Load, Speicher, Drosselung, Dienste |

Jede Seite läßt sich in `config/console.json` einzeln abschalten.

## Installation

Auf dem Gerät, aus dem Repository-Wurzelverzeichnis, **in dieser Reihenfolge** — der
Kiosk-Installer verweigert sich ohne den Systembenutzer, den erst der Daemon-Installer
anlegt:

**1. Daemon** (legt den Systembenutzer `atc`, `/var/www/html/atc/` und
`/var/lib/atc-console/` an, installiert und startet `atc-daemon.service`, weist am Ende
per HTTP nach, daß `system.json` tatsächlich geschrieben wird):

```bash
sudo ./install-daemon.sh
```

**2. Konsole** (Panel angeschlossen), Kiosk-Installation:

```bash
sudo ./install-console.sh --rotate 90 --output DSI-1
```

**Der Wert `90` ist für dieses Panel am Gerät gemessen** — Beschriftung gelesen *und*
alle vier Ecken angetippt (siehe [`docs/messungen/2026-07-27-panel-rotation.md`](docs/messungen/2026-07-27-panel-rotation.md)).
Auf anderer Hardware ist er neu zu bestimmen und nicht zu übernehmen: labwc dreht
Toucheingaben nicht mit der Ausgabe mit, und ein gedrehtes Bild über einer ungedrehten
Touchfläche sieht mit den Augen völlig richtig aus.

Der Schreiber-Daemon läuft unabhängig vom Kiosk weiter, auch wenn dieser neu installiert
oder neugestartet wird.

## Lizenz

MIT — siehe [LICENSE](LICENSE).
