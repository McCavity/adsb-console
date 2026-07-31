# adsb-console

Eine ATC-Konsole für ein 7"-Touchpanel am eigenen ADS-B-Empfänger: ein Radarschirm und
sechs weitere Seiten in einem Karussell, die zeigen, was der Empfänger gerade sieht.

Die Konsole ist ein **Leser**. Sie liest die JSON-Ausgaben von `dump1090-fa` und ändert
nichts am ADS-B-Stack — der Feed ist der Zweck des Geräts, die Anzeige ist es nicht.

![Radarseite der Konsole: PPI mit umlaufender Keule, Flugplätzen und Bahnen, ein rot
hervorgehobenes Ziel mit Notfall-Squawk 7700 und der Datenblock daneben](docs/bilder/radar.png)

> [!note]
> **In diesen Bildern sind Standort und Verkehr gestellt.** Der Empfänger steht in
> Wirklichkeit nicht dort, und keiner der Flüge hat je stattgefunden — Kennungen
> (`SYN####`) und Hex-Adressen sind erfunden.
>
> **Warum London:** Heathrow, Gatwick, Stansted, Luton und City liegen gemeinsam im
> 50-NM-Kreis, dazu Biggin Hill und Northolt — 50 Plätze und 41 Bahnen in einem Bild.
> Diese Dichte an Großflughäfen zeigt den Flugplatz-Layer so, wie er gemeint ist. Und sie
> löst nebenbei ein Problem: Aus einem Radarbild ist der Empfängerstandort rechenbar
> (Ringe auf den Empfänger zentriert, Maßstab auf der Seite, Flugplätze mit bekannten
> Koordinaten). Ein gestellter Standort schneidet diesen Kanal ab, statt ihn klein zu
> rechnen.
>
> **Warum überhaupt gestellt:** Nachts fliegt nichts und tagsüber steht zufällig da, was
> da steht — ein Notfall-Squawk, ein HEAVY und ein voller Schirm lassen sich nicht
> abwarten. Wie die Bilder entstanden sind, steht in
> [`docs/messungen/2026-07-31-fotosession.md`](docs/messungen/2026-07-31-fotosession.md);
> der Generator ist [`tools/fotoszene.py`](tools/fotoszene.py). Nur die Systemseite zeigt
> **echte** Meßwerte dieser Hardware — eine erfundene CPU-Temperatur wäre eine Behauptung
> im Gewand eines Belegs.

## Stand

**Alle sieben Seiten laufen auf dem Gerät, alle vier Ausbaustufen sind am Panel
abgenommen.** 215 Frontend-Tests und 44 Daemon-Tests, ein Wächter gegen die
Empfängerposition im Repo.

| Stufe | Inhalt | Abnahme am Gerät |
|---|---|---|
| 1 | Radar, Ziele, Empfang, Schreiber-Daemon, Kiosk-Autostart | [27.07.2026](docs/abnahme/2026-07-27-stufe-1.md) |
| 2 | Einzelziel, Höhenprofil, System | [28.07.2026](docs/abnahme/2026-07-28-stufe-2.md) |
| 3 | Reichweite (Polar) | [30.07.2026](docs/abnahme/2026-07-30-stufe-3.md) |
| Radar-Ansicht | Reichweitenstufen 10/50/80 NM, Flugplatz-Layer, Einstellungsdialog | [31.07.2026](docs/abnahme/2026-07-31-radar-ansicht.md) |

Die Abnahmen sind keine Häkchenlisten: Sie werden **gegen die Absicht** bedient — Schritte
doppelt ausgeführt, mitten im Ablauf abgebrochen, Werte an den falschen Ort gelegt. Der
vorgesehene Weg beweist nur, daß es ihn gibt.

- Entwürfe: [`docs/specs/`](docs/specs/) — Stufe 1 bis 3 und die Radar-Ansicht
- Messungen: [`docs/messungen/`](docs/messungen/) — Positionsquelle, Panel-Drehung,
  Animationskosten, Schrift, Wärme, Frischeanzeige, Fotosession
- Abnahmen: [`docs/abnahme/`](docs/abnahme/)

## Die Idee in drei Sätzen

Ein kleiner Schreiber-Daemon (nur Python-Standardbibliothek) pollt `aircraft.json`,
führt Reichweiten-Rekorde je Himmelsrichtung in SQLite und legt zwei JSON-Dateien in
den Docroot des ohnehin laufenden lighttpd. Das Frontend ist reine Statik — kein
zweiter Webserver, kein Framework, keine externe Bibliothek, keine Quelle aus dem Netz
zur Laufzeit. Ein Chromium-Kiosk unter labwc zeigt es auf dem Panel.

## Seiten

Reihenfolge im Karussell. Der **Titel** steht in der Kopfzeile des Panels, der
**Schlüssel** ist der Name in `config/console.json` — beide auseinanderzuhalten spart die
Sucherei, die einen sonst erwischt, wenn man „Empfang" abschalten will und `stats` meint.

| Titel | Schlüssel | Standzeit | Inhalt |
|---|---|---|---|
| Radar | `radar` | 45 s | PPI mit umlaufender Keule, Nachglühen, Flugplätzen und Bahnen; Reichweite 10/50/80 NM am Zahnrad umschaltbar |
| Einzelziel | `target` | 15 s | volles Datenblatt zum beim Betreten eingefrorenen Ziel: Geschwindigkeit (GS/IAS/TAS/Mach), Höhe samt Zielflugfläche, Lage, Ort, Empfangs- und Positionsgüte |
| Höhenprofil | `profile` | 15 s | Seitenriß — Entfernung × Flugfläche, ein Punkt je Ziel — mit den sechs Bändern als Zählspalte daneben |
| Reichweite | `polar` | 15 s | Reichweite je Sektor als Windrose — Allzeit-Rekord und Stundenmaximum, mit Trophäe, zwölf Richtungen und dem zuletzt gefallenen Rekord |
| Ziele | `board` | 15 s | die zwölf nächsten Ziele nach Entfernung, samt derer ohne Position |
| Empfang | `stats` | 15 s | Nachrichtenrate, Signalpegel, Verstärkung, Track-Güte |
| System | `system` | 15 s | Temperatur, Load, Speicher, Drosselung, Dienste |

Ein Umlauf dauert damit 2:15. Jede Seite läßt sich in `config/console.json` einzeln
abschalten; eine Berührung hält das Karussell 60 Sekunden an.

### Die übrigen sechs Seiten

<details>
<summary><b>Ziele</b> — die zwölf nächsten, Notfall rot, HEAVY markiert</summary>

![Zielliste: zwölf Zeilen mit Callsign, Flugfläche, Geschwindigkeit, Kurs, Entfernung und
Peilung; die Notfallzeile rot samt Squawk 7700, darunter die Zeile für Ziele ohne
Position](docs/bilder/ziele.png)

Der Filter sitzt auf der eingestellten Reichweite: Ein Ziel, das das Radar als außer
Reichweite behandelt, taucht hier nicht fünfzehn Sekunden später als volles Datenblatt auf.
</details>

<details>
<summary><b>Einzelziel</b> — 23 Felder zum eingefrorenen Ziel</summary>

![Datenblatt eines Ziels in sechs Kacheln: Geschwindigkeit, Höhe, Lage, Ort, Empfang und
Positionsgüte](docs/bilder/einzelziel.png)

Die Seite friert ihr Ziel beim Betreten ein. Zwei Ziele bei 12,3 und 12,4 NM würden sonst
im Sekundentakt tauschen, und ein Datenblatt, dessen Gegenstand springt, ist unlesbar.
</details>

<details>
<summary><b>Höhenprofil</b> — Seitenriß mit Zählspalte</summary>

![Seitenriß: Entfernung waagerecht, Flugfläche senkrecht, ein Punkt je Ziel; rechts die
sechs Flugflächenbänder als Balken mit Anzahl](docs/bilder/hoehenprofil.png)

Die Kachel „nicht im Bild" erklärt die Differenz zwischen Bändern und Punkten: Ziele mit
Höhe, aber ohne Position, und Ziele außerhalb der Reichweite. Eine Zählung, deren Summe
nicht aufgeht, wirft mehr Fragen auf, als sie beantwortet.
</details>

<details>
<summary><b>Reichweite</b> — Windrose aus Rekord und letzter Stunde</summary>

![Polardiagramm mit 36 Sektoren: gefüllte Fläche für den Allzeit-Rekord, eine Linie für das
Stundenmaximum; rechts zwölf Richtungen als Balkenpaare](docs/bilder/reichweite.png)

Zwei Spuren, weil eine nichts über heute sagt. Wo die Stundenlinie aus der Rekordfläche
ragt, ist gerade ein Rekord gefallen.
</details>

<details>
<summary><b>Empfang</b> — Nachrichtenrate und Signalpegel</summary>

![Empfangsstatistik in drei Zeitfenstern: Nachrichten pro Sekunde, akzeptierte Nachrichten,
starke Signale, Peak, Signal und Rauschen in dBFS](docs/bilder/empfang.png)

Drei Fenster nebeneinander (1, 5, 15 Minuten), weil ein Einzelwert nicht sagt, ob er
Ausreißer oder Zustand ist.
</details>

<details>
<summary><b>System</b> — Temperatur, Last, Drosselung, Dienste</summary>

![Systemseite mit CPU-Temperatur samt Markenbalken, Last, Speicher und Platte, SDR-Leser,
Drosselungsflags jetzt und seit Boot, Dienstliste und Daemon-Alter](docs/bilder/system.png)

Drei Marken, aber nur zwei Farbschwellen: 60 °C ist der Firmware-Vorgabewert und bloß ein
Strich, 72 °C die Abnahmegrenze dieses Projekts, 80 °C die harte Grenze. Eine Anzeige, die
im Regelbetrieb dauernd Alarmfarbe zeigt, wird nach drei Tagen nicht mehr gelesen.

Die Drosselungsflags kennen **drei** Zustände, nicht zwei: Ein fehlender Wert ist keine
Entwarnung. Und „Daemon geschrieben vor" wird ab 30 s rot — das ist die Anzeige, die einen
stehengebliebenen Schreiber verrät, während alle anderen Zahlen noch plausibel aussehen.
</details>

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
