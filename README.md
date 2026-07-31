# adsb-console

Eine ATC-Konsole für ein 7"-Touchpanel am eigenen ADS-B-Empfänger: ein Radarschirm und
sechs weitere Seiten in einem Karussell, die zeigen, was der Empfänger gerade sieht.

Die Konsole ist ein **Leser**. Sie liest die JSON-Ausgaben von `dump1090-fa` und ändert
nichts am ADS-B-Stack — der Feed ist der Zweck des Geräts, die Anzeige ist es nicht.

## Stand

**Stufe 1 läuft seit dem 27.07.2026 auf dem Gerät** — Radar, Board und Statistik, mit
Schreiber-Daemon und Kiosk-Autostart. **Stufe 2 (Einzelziel, Höhenprofil, System) ist
gebaut**; die Abnahme am Gerät steht noch aus. **Stufe 3 (Reichweiten-Polar) ist
gebaut**; die Abnahme am Gerät steht ebenfalls noch aus.

- Entwurf Stufe 1: [`docs/specs/2026-07-27-atc-konsole-design.md`](docs/specs/2026-07-27-atc-konsole-design.md)
- Entwurf Stufe 2: [`docs/specs/2026-07-28-stufe-2-entwurf.md`](docs/specs/2026-07-28-stufe-2-entwurf.md)
- Entwurf Stufe 3: [`docs/specs/2026-07-29-stufe-3-entwurf.md`](docs/specs/2026-07-29-stufe-3-entwurf.md)
- Abnahme am Gerät: [`docs/abnahme/2026-07-27-stufe-1.md`](docs/abnahme/2026-07-27-stufe-1.md)
- Messungen (Positionsquelle, Panel-Drehung, Animationskosten): [`docs/messungen/`](docs/messungen/)

## Die Idee in drei Sätzen

Ein kleiner Schreiber-Daemon (nur Python-Standardbibliothek) pollt `aircraft.json`,
führt Reichweiten-Rekorde je Himmelsrichtung in SQLite und legt zwei JSON-Dateien in
den Docroot des ohnehin laufenden lighttpd. Das Frontend ist reine Statik — kein
zweiter Webserver, kein Framework, keine externe Bibliothek, keine Quelle aus dem Netz
zur Laufzeit. Ein Chromium-Kiosk unter labwc zeigt es auf dem Panel.

## Seiten

Reihenfolge im Karussell:

| Seite | Inhalt |
|---|---|
| Radar | PPI mit umlaufendem Sweep, Nachglühen, Flugplätzen und Bahnen |
| Einzelziel | volles Datenblatt zum beim Betreten eingefrorenen Ziel: Geschwindigkeit (GS/IAS/TAS/Mach), Höhe samt Zielflugfläche, Lage, Ort, Empfangs- und Positionsgüte |
| Höhenprofil | Seitenriß — Entfernung × Flugfläche, ein Punkt je Ziel — mit den sechs Bändern als Zählspalte daneben |
| Polar | Reichweite je Sektor als Windrose — Allzeit-Rekord und Stundenmaximum, mit Trophäe, zwölf Richtungen und dem zuletzt gefallenen Rekord |
| Board | Zielliste nach Entfernung, samt der Ziele ohne Position |
| Statistik | Nachrichtenrate, Signalpegel, Verstärkung, Track-Güte |
| System | Temperatur, Load, Speicher, Drosselung, Dienste |

`polar` hat seit Stufe 3 einen eigenen Renderer (`console/js/pages/polar.js`) und läuft
mit den übrigen sechs — heute laufen alle sieben Seiten. Jede Seite läßt sich in
`config/console.json` einzeln abschalten.

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

## Eine Änderung ausrollen

Beide Installer lesen aus dem Repository-Baum, **in dem sie stehen** — die Quelle ist also
der Baum auf dem Gerät, nicht das Remote. Auf `adsapp01` liegt er unter
`/home/pi/adsb-console`. Er wird vom Arbeitsplatz aus gespiegelt:

```bash
rsync -a --delete --exclude '.superpowers' --exclude '.git' ./ adsapp01:/home/pi/adsb-console/
```

**`--exclude '.git'` ist seit dem 31.07.2026 dabei, und zwar mit Grund.** Der Spiegel
existiert, damit die Installer aus einem Baum lesen können — dafür braucht es die
Historie nicht. Ohne den Ausschluß gleicht rsync bei jedem Lauf rund zehntausend lose
Git-Objekte ab: Der Lauf dauerte Sekunden statt 1,1 s und erzeugte einen I/O-Sturm auf
einem Gerät mit 1,8 GB RAM. An genau so einem Lauf hing zeitlich der Totalausfall vom
31.07. (`docs/2026-07-31-ausfall-adsapp01.md`) — bewiesen ist der Zusammenhang **nicht**,
aber der Ausschluß kostet nichts und nimmt die Last weg. Nebenwirkung, die man kennen
muß: `--exclude` schützt auch vor `--delete`, das `.git` auf dem Gerät bleibt also als
Altlast liegen.

**Das Spiegeln ist der erste Schritt, nicht der optionale.** Bis zum 30.07.2026 lag auf
dem Gerät ein Baum vom Stand *Stufe 1* — in `/tmp`, also nach dem nächsten Neustart weg.
Ein `install-console.sh` von dort hätte die laufende Konsole zwei Stufen zurückgesetzt,
und genau deshalb wurden Änderungen bis dahin als Einzeldateien am Installer vorbei
kopiert.

**Nur das Frontend geändert** (HTML/CSS/JS unter `console/`) — das sind die Zeilen des
Installers, die den Docroot füllen, ohne Paketverwaltung, Benutzer und Units anzufassen:

```bash
ssh adsapp01 'cd /home/pi/adsb-console && sudo tar czf /var/tmp/sicherung-docroot-$(date +%F-%H%M%S).tar.gz -C /var/www/html atc && sudo cp -r console/. /var/www/html/atc/ && sudo chown -R atc:atc /var/www/html/atc && sudo systemctl restart atc-console'
```

Der Neustart ist nicht optional: Die Seite lädt sich im Betrieb **nie** neu (`data.js` —
ein fehlgeschlagener Abruf läßt die letzten Werte stehen und altern), also sieht das Panel
ohne ihn weiter die alte Fassung. Danach über HTTP gegenprüfen, nicht im Dateisystem
nachsehen — die Abschrift ist nicht das Original:

```bash
ssh adsapp01 'curl -s http://127.0.0.1/atc/js/pages/polar.js | sha256sum'
```

Zwei Eigenschaften dieses Wegs, die man kennen muß: `cp -r console/.` ist **additiv** — im
Repo gelöschte Dateien verschwinden im Docroot nicht von selbst. Und `console.json` wird
nicht angefaßt; die Konfiguration am Gerät überlebt jedes Ausrollen (so auch im Installer,
Zeile 361).

**Dienste, Rechte, Pakete oder die Drehung geändert** → der volle `install-console.sh`.
Er ist auf Wiederholung ausgelegt und startet den Dienst am Ende selbst neu, ruft aber
auch `apt-get install` für `chromium`, `labwc`, `seatd` und `wlr-randr` auf: Ein
Browserwechsel entwertet die am Gerät gemessenen Layout- und Wärmezahlen. Für eine
Frontend-Änderung ist er das falsche Werkzeug.

## Lizenz

MIT — siehe [LICENSE](LICENSE).
