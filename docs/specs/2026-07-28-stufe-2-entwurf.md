# ATC-Konsole Stufe 2 — Einzelziel, Höhenprofil, System

> Datum: 2026-07-28
> Status: Entwurf, freigegeben — Umsetzung offen
> Gerät: `adsapp01`
> Grundlage: [`2026-07-27-atc-konsole-design.md`](2026-07-27-atc-konsole-design.md) (Stufe 1, in Betrieb)

Dieses Dokument ergänzt den Hauptentwurf um die drei Seiten der Stufe 2 und räumt die
sechs Punkte ab, die der Schluß-Review der Stufe 1 bewußt vertagt hat. Wo es dem
Hauptentwurf widerspricht, ist es maßgeblich; die betroffenen Abschnitte dort werden in
derselben Umsetzung nachgezogen (§6 unten führt sie einzeln auf).

## 1. Was am 28.07. am Gerät gemessen wurde

Alle Zahlen dieses Abschnitts stammen aus einem read-only-Lauf gegen `adsapp01` am
28.07. vormittags. Sie tragen mehrere Entwurfsentscheidungen und stehen deshalb hier,
nicht in einer Fußnote.

### 1.1 Felddeckung — die Grundlage der Einzelziel-Seite

Ein Schnappschuß aus `aircraft.json`: 30 Ziele, davon **18 mit Position**. Gezählt wurde
über die Ziele mit Position, weil nur die auf den neuen Seiten erscheinen.

| Feld | von 18 | Feld | von 18 |
|---|---|---|---|
| `alt_baro`, `alt_geom` | 18 | `ias`, `mach`, `mag_heading` | 14 |
| `gs`, `track`, `squawk` | 18 | `tas`, `roll` | 13 |
| `baro_rate` | 18 | `geom_rate` | 12 |
| **`nav_altitude_mcp`** | **18** | `track_rate` | 11 |
| `nav_qnh` | 18 | **`flight` (Callsign)** | **14** |
| `nic`, `rc`, `nac_p`, `sil` | 18 | `nav_modes` | 2 |
| `rssi`, `messages`, `seen` | 18 (alle 30) | | |

Zwei Konsequenzen:

- **`nav_altitude_mcp` ist mit 18 von 18 vollständig belegt.** Das ist die im Autopiloten
  eingestellte Zielflugfläche. Sie trägt die Einzelziel-Seite: `FL349 sinkend → FL260`
  nennt eine Absicht, `FL349` nennt nur einen Zustand. Der Hauptentwurf kennt das Feld
  nicht.
- **Vier von achtzehn positionierten Zielen haben kein Callsign.** Die Seite filtert sie
  nicht weg; sie setzt den `hex` in die Überschrift. Wegfiltern hieße, den Empfang
  schönzurechnen — derselbe Fehler, den §6.2 des Hauptentwurfs beim Board ausdrücklich
  vermeidet.

### 1.2 Höhenverteilung über eine Stunde

Aus den 120 `history_*.json`, Spanne 60 min, **1808 Positionen mit `alt_baro`**.

| Band | Positionen | Anteil | Mittel je Schnappschuß |
|---|---|---|---|
| FL000–FL050 | 310 | 17,1 % | 2,6 |
| FL050–FL100 | 95 | 5,3 % | 0,8 |
| FL100–FL200 | 42 | 2,3 % | **0,3** |
| FL200–FL300 | 226 | 12,5 % | 1,9 |
| FL300–FL400 | 1029 | **56,9 %** | 8,6 |
| über FL400 | 106 | 5,9 % | 0,9 |

**Der Balken-Entwurf aus §6.6 des Hauptentwurfs scheitert an diesen Zahlen.** Ein Band
hält 57 %, ein anderes im Mittel 0,3 Ziele. Sechs Balken, von denen einer immer lang und
einer immer leer ist, sehen Minute für Minute gleich aus.

### 1.3 Seitenriß — die Struktur, die der Balken vernichtet

Von denselben 1808 Positionen liegen **1724 innerhalb von 50 NM**. Sie hier nach
Entfernung **und** Höhe gerastert (Zeilen FL, Spalten Entfernung in 5-NM-Schritten):

```
           0   5  10  15  20  25  30  35  40  45 NM
  FL400    7  16  14  14  15  10   2   5   1   2
  FL360   23  72  65  79  56  42  46  37  23  11
  FL320    9  60  76  64  65  75  23  41  27  13
  FL280    0  15  28  26   8  13  13  12  14   9
  FL240    0  15   9  20   5   3   3   1   3   3
  FL200    0  22  20  16  12   9   4   3   0   0
  FL160    0   1  17   5   5   1   0   1   2   0
  FL120    0   1   0   4   1   0   0   0   0   0
  FL080    9   4  10   0   0   0   0   0   0   0
  FL040   36  81  17   2   0   0   2   1   0   0
  FL000   59 180   4   0   0   0   0   0   1   0
```

Zwei klar getrennte Populationen mit einer Lücke dazwischen:

- ein **Reiseflugband** FL320–FL400, das über die vollen 50 NM durchläuft (Überflüge),
- ein **Flughafenkegel** innerhalb von 10 NM unterhalb FL050 — 180 Positionen allein bei
  5–10 NM / FL000, und jenseits von 15 NM unterhalb FL200 praktisch nichts,
- dazwischen der dünne Sinkkorridor, FL160–FL280 zwischen 5 und 25 NM.

Die Bänderzählung summiert die Entfernung weg und macht aus dieser Struktur sechs
Zahlen. Der Seitenriß zeigt sie. Er ist zugleich die klassische Ergänzung zum PPI:
Draufsicht und Aufriß, die eine Frage, die der Kreis grundsätzlich nicht beantworten
kann.

### 1.4 Das Meßmittel, das erst falsch maß

Der erste Lauf über die History-Dateien meldete **0 Positionen bei 120 gelesenen
Schnappschüssen und einer Zeitspanne von 0 min**. Die Dateien waren in Ordnung (HTTP
200, je rund 10 KB, voll belegt).

Der Fehler lag im Meßmittel: Die Dateien sind mehrzeilig formatiert, das Skript las
**zeilenweise**. Durch kam je Datei genau die letzte Flugzeugzeile — ein Objekt ohne
`aircraft`-Schlüssel und ohne `now`. Daher 120 „Schnappschüsse", daher Spanne 0, daher
die saubere Null. Das Werkzeug funktionierte einwandfrei und beantwortete eine andere
Frage als die gestellte.

Der zweite Lauf trägt eine Gegenprobe, deren Antwort vorher feststand: **es müssen 120
Dokumente mit `aircraft`-Schlüssel und 0 unlesbare sein.** Erst danach wurden die Zahlen
oben gelesen. Ohne diese Gegenprobe wäre der Balken-Entwurf mit der Begründung
„nachts fliegt eben nichts" durchgewinkt worden.

## 2. Die Auswahlregel für die Einzelziel-Seite

Die Regel des Radar-Datenblocks (`waehleZiel` in `radar.js`) läuft im Sekundentakt. Neben
dem Schirm ist das folgenlos. Als eigene Seite mit 15 s Standzeit und einem Callsign in
78 px ist es ein Fehler: Zwei Ziele bei 12,3 und 12,4 NM tauschen im Sekundentakt, und
ein Datenblatt, dessen Gegenstand springt, ist unlesbar.

Die Seite friert ihr Ziel deshalb **beim Betreten** ein. Als reine Funktion in `geo.js`,
ohne DOM und ohne Zustand:

`kandidaten` sind die bereits um Entfernung und Peilung angereicherten Ziele mit
Position, wie `radar.js` sie heute aufbaut — nicht die rohen `aircraft.json`-Einträge.

```
waehleDatenblattZiel(kandidaten, bisher) →
  1. Notfall übersteuert:  gibt es Ziele mit isEmergency(), das nächstgelegene davon
  2. sonst bleibt bisher,  solange sein hex noch in kandidaten steht
  3. sonst:                das nächstgelegene mit Position
  (leere Liste → null)
```

Drei Zweige, **keine geratene Konstante**, vollständig ohne Browser testbar. Das ist die
Lehre aus dem Karussell-Fehler der Stufe 1: Die Zeitsteuerung war an einem Tag zweimal
falsch, beide Male gefunden von einer Stoppuhr und nicht von einem Test — als reine
Funktion fängt ein Test heute beide Varianten.

**Der Rückweg ist ausdrücklich asymmetrisch.** Verschwindet der Notfall-Squawk wieder,
springt die Seite *nicht* zurück: Das Ziel steht noch in `kandidaten`, also greift Regel 2.
Das ist gewollt und wird bei der Abnahme als solches geprüft, nicht als Fehler notiert.

## 3. Der Seitenvertrag bekommt `onEnter`

`console.js` kennt heute `mount` (einmal beim Start) und `render` (bei jedem Datenpaket).
Ein Haken für „diese Seite wird gerade sichtbar" fehlt. Beide neuen Seiten brauchen ihn,
aus je eigenem Grund:

- Die Einzelziel-Seite friert ihr Ziel beim Betreten ein (§2). Ohne Haken müßte sie den
  Zeitpunkt aus `render` heraus erraten.
- **Die Systemseite hat einen Fehler, den der jetzige Aufbau zwangsläufig erzeugt:**
  `pollSystem` läuft alle 10 s und steigt bei unsichtbarer Seite sofort aus
  (`data.js`). Beim Betreten kommen die ersten Daten also bis zu 10 s später — bei 15 s
  Standzeit zwei Drittel der Standzeit mit altem Stand oder Gedankenstrichen.

`registerPage` bekommt daher ein **optionales** `onEnter(el, config, state)`, das
`renderCurrent()` beim Seitenwechsel aufruft. Ein Haken, zwei Probleme, kein Sonderweg.

Das ist ein Eingriff in den Code, der die am Panel abgenommene Karussell-Logik trägt. Er
wird deshalb **zuerst** gebaut und mit der Stoppuhr geprüft, bevor Seiten darauf
aufsetzen.

## 4. Die drei Seiten

Layout unverändert: 1280×720 quer, 56 px Kopfzeile, Rumpf, 44 px Indikatorreihe.
**Nichts scrollt.** Was nicht paßt, ist ein Layoutfehler.

### 4.1 Einzelziel — das volle Datenblatt

Ersetzt §6.3 des Hauptentwurfs vollständig.

**Warum neu gefaßt:** §6.3 in der alten Fassung ist heute fast vollständig Wiederholung.
Der Datenblock rechts auf der Radarseite zeigt bereits Callsign, Heavy, FL, Entfernung,
Peilung, Flugzeugsymbol nach Track, GS, Kurs, Steig-/Sinkrate und Squawk — ein Drittel
der Karussellzeit. Die alte Liste fügt dem genau drei Felder hinzu (IAS/TAS/Mach, RSSI,
Nachrichtenzahl). Eine ganze Seite für drei Felder ist keine Seite, sondern eine
Dublette.

Die Seite zeigt stattdessen, was der Radarkreis **grundsätzlich nicht** zeigen kann,
gruppiert nach Frage statt nach Feldname:

| Block | Felder |
|---|---|
| Kopf | Callsign, ersatzweise `hex` · Heavy · Squawk · Notfall rot |
| Geschwindigkeit | GS · IAS · TAS · Mach |
| Höhe | `alt_baro` als FL · `alt_geom` · **Zielflugfläche** (`nav_altitude_mcp`) · `baro_rate` / `geom_rate` |
| Lage | `track` · `mag_heading` · `roll` · `track_rate` |
| Ort | Entfernung · Peilung · `nav_qnh` |
| Empfang | RSSI · Nachrichten · `seen` |
| Positionsgüte | `nic` · `rc` · `nac_p` · `sil` |

**Ausdrücklich ausgeschlossen: die Differenz `track` − `mag_heading` als „Windversatz".**
Sie liegt nahe und wäre falsch. `track` ist rechtweisend, `mag_heading` mißweisend; die
Differenz enthält die Mißweisung mit. Das wäre ein Instrument, dessen Etikett eine andere
Frage nennt als die, die es beantwortet. **Beide Werte stehen nebeneinander, es wird
keine Differenz gebildet und keine benannt.**

Fehlende Felder zeigen einen Gedankenstrich, niemals eine 0. Leerzustand wie auf der
Radarseite: „keine Ziele in Reichweite" mit weiterlaufender Nachrichtenrate — sie
unterscheidet „nichts fliegt" von „Empfänger tot".

### 4.2 Höhenprofil — Seitenriß mit Bandspalte

Ersetzt §6.6 des Hauptentwurfs. Layout wie die abgenommene Radarseite: Bild links,
Datenspalte rechts.

**Der Seitenriß**

- **x = Entfernung, 0 bis `cfg.radar.range_nm`** — bewußt derselbe Wert aus derselben
  Konfiguration wie das Radar, mit senkrechten Gitterlinien bei `cfg.radar.rings_nm`
  (10 · 25 · 50 NM). Wer auf dem Radar einen Ring sieht, findet ihn hier als Linie
  wieder; ein umgestellter Maßstab verschiebt beide Seiten gemeinsam.
- **y = FL000 bis FL450**, waagerechtes Gitter alle FL100. Gemessenes Stundenmaximum war
  FL409.
- **Ein Ziel über FL450 wird an den oberen Rand geklemmt und markiert, nicht
  weggelassen.** Ein Ziel, das aus dem Bild fällt, sieht aus wie kein Ziel.
- Ein Punkt je positioniertes Ziel mit `alt_baro`. Notfall rot.
- **Keine Beschriftung im Bild.** Bei 18 Punkten kollidieren die Callsigns; die Zahlen
  stehen in der Spalte.

**Die Bandspalte**

Die sechs Bänder aus §6.6 (0–5, 5–10, 10–20, 20–30, 30–40, > 40 in Tausend Fuß) mit
ihren Zählwerten — die Zusage des Hauptentwurfs bleibt damit erfüllt. Darunter eine
eigene Zeile **„mit Höhe, ohne Position: n"**. Der Seitenriß kann diese Ziele nicht
setzen, weil ihm die x-Achse fehlt; sie zu verschweigen wäre derselbe Fehler, den §6.2
beim Board ausdrücklich vermeidet. Im Schnappschuß waren es 2 von 20 Zielen mit Höhe.

### 4.3 System

Folgt §6.7 des Hauptentwurfs mit zwei begründeten Abweichungen.

- **Drei Temperaturmarken statt zwei.** §6.7 nennt 60 °C (Firmware-Soft-Limit) und 80 °C
  (hart). Das Gerät läuft im Regelbetrieb bei **66,7–71,5 °C**, also dauerhaft über 60.
  Eine Anzeige, die dabei ständig Alarmfarbe zeigt, lehrt das Falsche und wird nach drei
  Tagen nicht mehr gelesen. Marken: 60 dokumentarisch, **72 als Abnahmegrenze dieses
  Projekts**, 80 hart. **Farbwechsel erst bei 72 und 80.**
- **`samples_dropped` kommt aus `stats.json`, nicht aus `system.json`** — siehe §5.
  Angezeigt in **zwei Werten**, `last1min` und `total`, genau parallel zu
  `get_throttled`: „jetzt" und „seit Start".

Unverändert und nicht verhandelbar: **`throttle` in zwei getrennten Blöcken** „jetzt" und
„seit Boot". Das Zusammenwerfen hat auf dem Schwesterprojekt einen Fehlalarm erzeugt.

Weiter auf der Seite: Load mit `cpu_count` daneben (damit „2,75" lesbar wird), RAM, Disk,
Uptime, `core_clock_hz`, `core_volts`, Status der fünf Dienste.

**`written_at` wird zum Alter der Seite.** Bleibt der Daemon stehen, altert die
Systemseite sichtbar, statt Zahlen von vorgestern als aktuell auszugeben. Das Feld wird
heute geschrieben und von niemandem gelesen (§5).

`null` ist überall ein Gedankenstrich, niemals eine 0. Eine 0 meldet einen gemessenen
Zustand.

## 5. Die vertagten Punkte aus dem Schluß-Review

| # | Sache | Entscheidung |
|---|---|---|
| 1 | `samples_dropped` fehlt in `system.json` | **Nicht in den Daemon.** Er liest `stats.json` überhaupt nicht (`grep` über `atc_daemon.py`: kein Treffer); das Feld dort zu ergänzen hieße, ihm eine neue Dateiabhängigkeit samt Fehlerpfad zu geben — für einen Wert, den das Frontend alle 5 s ohnehin holt. Die Systemseite liest ihn direkt aus `stats.json` (`<fenster>.local.samples_dropped`), in zwei Werten. Aus §5.3 des Hauptentwurfs fliegt das Feld raus, §6.7 bleibt erfüllt. |
| 2 | `written_at` in der Datei, nicht in der Spec, nirgends gelesen | **In die Spec**, als Schreibzeitpunkt des Daemons. Es ist die einzige Größe, an der die Systemseite „Daemon tot" von „Daemon frisch" unterscheiden kann, ohne der Browseruhr zu trauen. |
| 3 | `emergency.highlight` nur im Radar verdrahtet | **Auch im Board** (`board.js` prüft heute ungefiltert `isEmergency`) und von Anfang an in der Einzelziel-Seite. `false` muß alle drei stumm schalten, sonst schaltet der Schalter nur die halbe Konsole. |
| 4 | `decay_s` still auf 0,98 × `sweep_s` gedeckelt | **Deckelung bleibt, Spec wird korrigiert.** In Variante B hängt das Verglimmen an der sweep-gekoppelten CSS-Animation; ein `decay_s` über einem vollen Umlauf ist dort nicht darstellbar. Die Zusage „verblaßt über `decay_s` = 6 s" in §6.1 wird auf die Wahrheit umgeschrieben, statt die Deckelung zu verstecken. |
| 5 | Der gebundelte Font existiert nicht | **Zusage streichen — mit einer Ausnahme.** `ui-monospace` bleibt für Kacheln, Tabellen und alles übrige. **B612 wird im Radarkreis erprobt** (Kontakt-Overlays, Flugplatzkennungen, Ringbeschriftung). Lizenz **am Text geprüft**, nicht angenommen; Datei einmal beim Bauen eingefroren wie `airports.json`, zur Laufzeit null Fremdquellen. `fonts-noto-color-emoji` fliegt aus `install-console.sh`. Der Rückzug ist eine CSS-Zeile und wird am Panel entschieden, nicht am Mac. |
| 6 | §8: „keine Daten seit HH:MM" und Leerzustand mit Uhrzeit | **Im Code umsetzen**, nicht streichen. Die Spec-Fassung ist die ehrlichere: Eine Uhrzeit sagt, seit wann; „keine Daten" sagt es nicht. |
| 7 | §10.2 nennt einen Test, den es nicht gibt | **Test schreiben.** Bestätigt: `test_geo.mjs` hat die Großkreis-Tests, aber keinen Empfänger→EDDF-Test. Mit erfundener Empfängerposition. |
| 8 | §7.1: 200-ms-Wisch richtungsabhängig, CSS hat nur die 180-ms-Blende | **Umsetzen.** Es ist eine CSS-Transition, und die Geste soll sich wie eine Geste anfühlen. |
| 9 | `state.receiver` ungeprüft | **Zwei `typeof`-Prüfungen** (`data.js`). Ein `receiver.json` mit Text statt Zahl macht heute jede Entfernungsangabe zu `NaN` — sichtbar erst auf dem Panel. |

### 5.1 Ein zehnter Punkt: die falsche Zahl im Meßprotokoll

`docs/messungen/2026-07-27-variante-b-stunde.md` schließt mit dem Satz, die Radarseite
sei „rund ein Drittel der Zeit sichtbar" gewesen, „wie im Regelbetrieb". **Das ist nach
den eigenen Zahlen desselben Dokuments falsch.**

- `console.js` filtert `activePages` gegen die **registrierten** Renderer.
- Am Meßcommit `be74d8a` selbst nachgesehen: `index.html` registrierte genau drei Seiten
  — Radar, Board, Statistik.
- Standzeiten 45 + 15 + 15 = 75 s Umlauf. Das Radar war **60 %** der Zeit sichtbar.

Das dreht die Wärmefrage für Stufe 2: Die 0,5 K Marge wurden unter einer **härteren**
Bedingung erarbeitet als dem Regelbetrieb, den Stufe 2 herstellt (sechs Seiten,
45/120 = 37,5 % Radaranteil). **Daraus folgt nicht, daß Stufe 2 kühler läuft** — das wäre
die Behauptung anstelle der Messung. Es folgt nur, daß der Ausgangspunkt besser ist als
das Protokoll sagt. Das Protokoll wird korrigiert, mit Rechenweg und Konsequenz.

**Zur Seitenzahl:** Nach Stufe 2 laufen **sechs** Seiten, nicht sieben — Radar, Board,
Einzelziel, Statistik, Höhenprofil, System. `polar` steht in `PAGE_ORDER` und in
`console.json` auf `true`, hat aber bis Stufe 3 keinen Renderer und wird von
`console.js` herausgefiltert. Umlauf 45 + 5 × 15 = **120 s = 2:00**.

## 6. Was im Hauptentwurf nachgezogen wird

Die Umsetzung ändert diese Stellen in `2026-07-27-atc-konsole-design.md`, damit kein
Dokument etwas Falsches behauptet:

| Abschnitt | Änderung |
|---|---|
| §4.2 (Repo-Zuschnitt) | `fonts/` — Zweck präzisieren: nur der Radarkreis |
| §5.3 (`system.json`) | `samples_dropped` raus, `written_at` rein |
| §6.1 (Radar) | `decay_s`-Deckelung benennen; Font-Zusage auf den Radarkreis begrenzen |
| §6.3 (Einzelziel) | vollständig ersetzt durch §4.1 dieses Dokuments |
| §6.6 (Höhenprofil) | vollständig ersetzt durch §4.2 dieses Dokuments |
| §6.7 (System) | dritte Temperaturmarke; Quelle von `samples_dropped` |
| §7.1 (Karussell) | 200-ms-Wisch — bleibt Zusage, wird umgesetzt |
| §8 (Degradation) | „keine Daten seit HH:MM" — bleibt Zusage, wird umgesetzt |
| §10.2 (Tests) | Empfänger→EDDF-Test — bleibt Zusage, wird umgesetzt |
| §11 (Stufung) | Stufe 2 auf den hier beschriebenen Inhalt |

`CLAUDE.md`: die Font-Zusage im Abschnitt „Nicht verhandelbar" auf den Radarkreis
begrenzen. „Keine Fremdquelle zur Laufzeit" bleibt unverändert und wird erneut durch
Ziehen des Netzsteckers geprüft.

## 7. Verifikation

### 7.1 Die Wärmekriterien — festgelegt, bevor gemessen wird

| Kriterium | Grenze |
|---|---|
| `total.local.samples_dropped` | bleibt **0** — das harte Kriterium |
| `get_throttled` | bleibt `0x0` |
| CPU-Temperatur | unter **72 °C** |

Unverändert vom Spike vom 27.07. **Eine Grenze, die man nach der Messung verschiebt, ist
keine.**

**Meßaufbau:** eine Stunde, 120 Punkte im 30-s-Abstand, echte Konsole, **sechs Seiten**
(Polar folgt erst in Stufe 3), Umlauf 2:00. Davor am **selben Nachmittag** Leerlauf ohne
Kiosk und statische Seite als
Baseline — ohne sie ist der Absolutwert nicht deutbar: Der Leerlaufwert dieses Geräts lag
im Mai bei ~55 °C, am 27.07. bei 62,3 °C, also rund sieben Kelvin Unterschied allein aus
der Umgebung.

**Was diese Messung prinzipiell nicht beantwortet:** ob die drei neuen Seiten billig
sind. Es ändern sich **zwei** Dinge gleichzeitig — drei Seiten kommen hinzu, und der
Radaranteil fällt von 60 % auf 37,5 %. Ein kühleres Ergebnis darf **nicht** als „die neuen
Seiten kosten nichts" gelesen werden; das wäre der A/B-Vergleich mit unfixierter Eingabe.
Gemessen wird der Liefergegenstand, nicht die Zurechnung. Wer die Zurechnung braucht,
braucht einen zweiten Lauf mit eingefrorener Konfiguration.

Reißt ein Kriterium, ist der Rückfall **keine Neuentwicklung, sondern eine
Konfigurationsentscheidung**: Standzeiten und Radaranteil stehen in `console.json`. Die
wird dann ihrerseits nach demselben Verfahren gemessen. Und es ist Hochsommer — die
Marge betrug 0,5 K.

### 7.2 Tests im Repo

`node --test tests/*.mjs` — **mit Dateimuster, nie blank.** Ein blankes `node --test`
findet in diesem Repo keine Datei und meldet trotzdem `fail 0`. **Gelesen wird die Zahl
der ausgeführten Tests, nicht nur die der Fehler.** Null Fehler bei null Tests ist kein
Ergebnis.

- `waehleDatenblattZiel`: Notfall übersteuert · eingefrorenes Ziel bleibt · verschwundenes
  Ziel wird ersetzt · leere Liste ergibt `null` · mehrere Notfälle ergeben den nächsten.
- **Empfänger → EDDF** mit erfundenen Koordinaten — die offene Schuld aus §10.2.
- Seitenriß: Bandzuordnung an den Grenzen (genau 5000 ft, genau 40 000 ft) · Klemmen über
  FL450 · Zählung „mit Höhe, ohne Position" · Umrechnung NM auf x-Pixel.
- Formatierung: `null` ergibt einen Gedankenstrich, nirgends eine 0.
- **Jeder Test wird einmal absichtlich rot gesehen**, indem eine Formel gebrochen wird.
  Ein Test, der nie rot war, ist unkalibriert.

Was die Testsuite **nicht** leisten kann, steht in der Abnahme der Stufe 1: Vierzehn
Befunde, keinen davon fand ein Test. Neun kamen vom Blick aufs Panel.

### 7.3 Abnahme am Gerät — absichtlich gegen die Absicht bedient

Der vorgesehene Weg beweist nur, daß es ihn gibt.

1. **Ziel verschwindet mitten in der Standzeit** (präparierte Quelle): Die
   Einzelziel-Seite wählt neu, statt ein leeres Blatt stehenzulassen.
2. **Notfall-Übersteuerung im Stehen:** Squawk 7700 erscheint, während die Seite ein
   anderes Ziel zeigt → sie springt um. **Rückweg:** Squawk weg → die Seite *bleibt* bei
   diesem Ziel (Regel 2). Gewollt, wird als solches abgehakt.
3. **Ziel ohne Callsign:** `hex` steht in der Überschrift, kein Gedankenstrich.
4. **Ziel über FL450 und Ziel bei 0,0 NM** (präpariert): geklemmt und markiert bzw. auf
   der Achse — nicht verschwunden.
5. **B612 an den Bildrändern.** Befund 5 der Stufe-1-Abnahme war eine abgeschnittene
   Flugplatzkennung am östlichen Rand — mit der **schmaleren** Schrift. Geprüft wird am
   östlichen und westlichen Rand, nicht in der Bildmitte.
6. **Netzstecker erneut ziehen** — jetzt mit gebundeltem Font. Genau die Zusage, die man
   beim ersten Mal einhält und beim zweiten Mal vergißt.
7. **Daemon töten:** Die Systemseite altert sichtbar über `written_at`, die anderen sechs
   Seiten laufen weiter. Wieder starten: erholt sich.
8. **Leerzustand aller drei neuen Seiten** — „keine Ziele" darf nicht wie ein Defekt
   aussehen, und die Nachrichtenrate muß weiterlaufen.
9. **Karussell mit sechs Seiten**, Umlauf **2:00** mit der Stoppuhr. Zugleich die
   Gegenprobe auf die Filterregel: `polar` steht in `console.json` auf `true`, darf aber
   **keinen** Punkt in der Indikatorreihe bekommen — sechs Punkte, nicht sieben. Und die
   Touch-Übernahme noch einmal: 60 s **von der sichtbaren Seite** aus. Sie war der eine
   Durchfaller der Stufe 1 und hängt jetzt an drei zusätzlichen Seiten.
10. **Kaputte Konfiguration erneut** — jetzt mit sechs registrierten Seiten: alle auf
    `false`, unbekannter Seitenname, JSON-Syntaxfehler. Vorgabewerte, kein weißer Schirm.
11. **Vor jedem Layout-Urteil sicherstellen, daß die geladene Fassung die gebaute ist.**
    Beim letzten Bau ein Beinahe-Fehlurteil an einer gecachten Datei.

## 8. Risiken, benannt

- **B612 im Radarkreis ist ein Versuch, kein Beschluß.** Der Radarkreis ist die engste
  Textfläche der Konsole; eine breitere Schrift verschärft genau den Randabschnitt, der
  in Stufe 1 schon einmal auftrat. Der Rückzug ist eine CSS-Zeile — aber die Entscheidung
  fällt am Panel.
- **`onEnter` faßt die abgenommene Karussell-Logik an.** Zuerst bauen, mit der Stoppuhr
  prüfen, dann erst Seiten daraufsetzen.
- **Die Temperaturmarge ist dünn und es ist Hochsommer.** 0,5 K, und sie hängt an der
  Raumtemperatur.
- **Die Polar-Seite (Stufe 3) bleibt offen.** Sie braucht ohnehin Laufzeit, bis die
  Rekorde aussagefähig sind.

## 9. Nicht in Stufe 2

- Polar-Seite mit Rekordhaltern — Stufe 3.
- Auswahl eines Ziels per Fingertipp. Eine Wandanzeige, die von selbst das Richtige
  zeigt, schlägt eine, deren Zustand jemand zurücksetzen müßte.
- Spurhistorie, MLAT als zweite Zielklasse, Nachtabsenkung, umschaltbarer Radar-Maßstab —
  unverändert zurückgestellt (§12 des Hauptentwurfs).
