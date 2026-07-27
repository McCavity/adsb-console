# Panel-Drehung und Touch-Ausrichtung — am Gerät gemessen

> 2026-07-27, `adsapp01` mit 7"-DSI-Touchpanel. Gemessen von Henning am Panel,
> nicht aus der Vorlage übernommen.

## Ergebnis

| | |
|---|---|
| Ausgabetransformation | **90°** (`wlr-randr --output DSI-1 --transform 90`) |
| libinput-`calibrationMatrix` | `0 -1 1 1 0 0` (aus demselben Wert abgeleitet) |
| Panel-Nativmodus | 720×1280 Portrait, Leserichtung Querformat 1280×720 |
| Ausgabe | `DSI-1` an `card1` |

## Wie geprüft wurde

Der Kiosk zeigte eine Testseite mit vier beschrifteten Ecken (`OBEN LINKS`,
`OBEN RECHTS`, `UNTEN LINKS`, `UNTEN RECHTS`) und einer Anzeige in der Mitte, die nach
jedem Antippen meldet, in welchem Quadranten der Treffer **tatsächlich** landete.

1. **Sichtprüfung:** In der linken oberen Ecke stand `OBEN LINKS`. Die Drehung stimmt.
2. **Fingerprüfung:** Alle vier Ecken angetippt, jeder gemeldete Treffer entsprach der
   berührten Ecke.

Der zweite Schritt ist der eigentliche Nachweis. Ein gedrehtes Bild über einer
ungedrehten Touchfläche sieht mit den Augen vollkommen korrekt aus — labwc dreht
Toucheingaben **nicht** mit der Ausgabe mit, das muß die `calibrationMatrix` separat
leisten. Auf dem Schwesterprojekt dwsapp01 war genau diese Diskrepanz der Fehler, den
keine Sichtprüfung gefunden hatte.

## Zum Startwert

Aufgerufen wurde `install-console.sh --rotate 90`, also mit dem Wert von dwsapp01. Er
erwies sich hier als richtig — das ist ein Prüfergebnis, keine Übernahme. Dort war die
zuerst naheliegende Annahme (180°, abgeleitet aus `fbcon=rotate:3`) um 180° falsch;
deshalb wird der Wert grundsätzlich am Panel bestimmt und nicht aus dem
Schwesterprojekt kopiert.

## Nebenbefunde derselben Installation

- seatd läuft auf Debian 13 als `seatd -g video`; der Socket `/run/seatd.sock` gehört
  der Gruppe `video`. Die Entdeckung am Socket (statt einer geratenen Namensliste) hat
  das korrekt gefunden.
- Der Render-Node `/dev/dri/renderD128` gehört einer **eigenen** Gruppe `render`.
- Der Dienstnutzer `atc` wurde beiden Gruppen hinzugefügt.
- Speicher mit laufendem Kiosk: 551 von 1843 MB belegt, 1292 MB verfügbar.
- Temperatur mit **statischer** Testseite: 65,2 °C gegenüber 62,3 °C im Leerlauf, also
  **+3 K allein für einen stehenden Chromium**. Bis zur Abbruchgrenze des Meß-Spikes
  (72 °C) bleiben damit 7 K für die Radar-Animation.
