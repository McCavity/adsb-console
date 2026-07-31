# Radar-Ansicht: Reichweitenstufen, Layer und Einstellungsdialog — Entwurf

> Datum: 2026-07-31
> Status: entworfen, nicht umgesetzt
> Gerät: `adsapp01` — Raspberry Pi 4 Model B Rev 1.5 mit 7"-DSI-Touchpanel
> Vorgänger: `docs/specs/2026-07-29-stufe-3-entwurf.md` (Stufe 3, seit 30.07.2026 in Betrieb)

## 1. Ziel

Die Konsole ist heute ein Karussell ohne Eingabe: Sie zeigt sieben Seiten in fester
Reihenfolge, und die einzige Bedienung ist Wischen und Tippen zum Anhalten. Dieser Entwurf
fügt **zwei Bedienmöglichkeiten auf der Radarseite** hinzu und schafft dafür die Stelle, an
der weitere Einstellungen später andocken:

1. **Reichweite umschaltbar** — 10 / 50 / 80 NM, mit mitwandernden Ringen.
2. **Flugplätze ein- und ausblendbar** — als erster *Layer*, nicht als Sonderfall.
3. **Einstellungsdialog** über ein Zahnrad im Kopf, seitenbezogen.

Anlaß ist die geplante Veröffentlichung des Repos und eine Arbeitsprobe auf
`henning.halfpap.io`. Der Weg dorthin ist aber ein anderer als zunächst gedacht — siehe
Abschnitt 3.

## 2. Abgrenzung

**Nicht Teil dieses Entwurfs**, bewußt und je mit eigener Entwurfssitzung:

- **Zielauswahl per Berührung** (Liste statt Kacheln, Tipp = Hervorhebung, Doppeltipp =
  Einzelseite). Das kehrt eine dokumentierte Entscheidung um: `radar.js:296` begründet die
  automatische Auswahl wörtlich mit *„Eine Wandanzeige, die von selbst das Richtige zeigt,
  schlägt eine, deren Zustand jemand zurücksetzen müßte."* Eine Umkehr ist legitim, zieht
  aber Folgefragen nach sich (Rückfall der Auswahl, Ziel verläßt die Reichweite, Zustand am
  nächsten Morgen).
- **Weitere Layer** — Städte, Sektoren, Lufträume, An- und Abflugrouten, Holdings. Der
  Layer-Begriff wird hier eingeführt, damit sie später dazugelegt statt eingebaut werden.
- **Zeitangaben in sinnvollen Intervallen** (Minuten / Stunden / Tage statt nur Minuten).
  Kleine, unabhängige Änderung; gehört nicht in diesen Zuschnitt.

## 3. Der Weg zur Veröffentlichung: synthetische Quelle statt Publikationsmodus

### 3.1 Die Ausgangsfrage

Aus dem Radarbild ist der Empfängerstandort rechenbar (Befund vom 30.07.2026: Ringe auf den
Empfänger zentriert, Maßstab auf der Seite, ~30 Flugplätze mit bekannten Koordinaten,
0,161 NM/px). Der erste Entwurf war deshalb ein **Publikationsmodus**: ein Schalter, der
Flugplätze, Kennungen und Zeitangaben gleichzeitig ausblendet.

### 3.2 Warum er verworfen wurde

Zwei Befunde haben den Zuschnitt gekippt.

**Erstens ist der Kanal breiter als die Flugplätze.** Die Blips tragen Callsign und Squawk
(`radar.js:235`, `:239`); über die öffentliche Flughistorie ist die Position eines
identifizierten Ziels zum Zeitpunkt X abrufbar. Zwei Ziele mit Peilung und Entfernung genügen
zur Kreuzpeilung, und der Kopf der Konsole liefert Uhrzeit und Datum gleich mit. Ein
Schalter, der nur die Flugplätze nimmt, meldet Grün und beantwortet eine andere Frage.

**Zweitens trägt die Reichweite-Seite den schärferen Kanal, nicht den schwächeren.** Die
Notiz vom 30.07. (*„die Reichweite-Seite trägt das nicht"*) galt der Radar**geometrie**;
niemand hatte nachgesehen, was die Trophäentafel danebenschreibt. `polar.js:47`
(`halterName()`) zeigt zu jedem Sektorrekord das **Callsign, ersatzweise die Hex-Kennung**,
und `polar.js:520` schreibt `datumKurz(g.seenAt)` — ein **Datum, im Text der Kachel, nicht in
der Kopfzeile**. Damit stehen dort beieinander: Peilung (10°-Sektor), exakte Entfernung in
NM, Identität und Zeitpunkt. Das ist keine Kreuzpeilung mehr, sondern eine **direkte
Inversion**: Position des Flugzeugs zum Zeitpunkt nachschlagen, `max_nm` entlang der
Gegenpeilung zurückgehen. Ein einziger Rekord genügt; auf der Seite stehen zwei benannte
(„Größter Empfang" und „Zuletzt gefallen").

Ein Blur über die Kopfzeile erreicht diese Angaben nicht.

**Drittens ist die Menge gleichzeitig sichtbarer Flüge selbst ein Zeitstempel.** Fünf bis
fünfzehn Callsigns mit Flightleveln sind über die öffentliche Historie nahezu eindeutig
datierbar. Die Uhr wegzunehmen entfernt den bequemen Schlüssel, nicht die Information.

### 3.3 Was stattdessen gilt

Für die Bilder ist nicht wichtig, **welche** Ziele zu sehen sind, sondern **daß es die Seiten
gibt und wie sie aussehen**. Daraus folgt der Weg: keine echten Daten nachträglich verhüllen,
sondern gar keine echten Daten ins Bild lassen.

`data.js:55` und `:73` lesen ihre Quellen bereits über `quellUrl(...)` aus den
**URL-Parametern** (`?source=…&range=…`). Die Möglichkeit ist also da und kostet **keine
Zeile Code in der Konsole**. Für die Fotosession wird die Konsole auf eine handgeschriebene
`aircraft.json` und `range.json` mit erfundenen Kennungen gezeigt.

Das schlägt den Publikationsmodus in drei Punkten:

- **Es kann nicht halb vergessen werden.** Entweder die Quelle ist synthetisch oder nicht —
  es gibt keinen Zustand, der teilweise wirkt, und kein Bild, auf dem ein Blur fehlt.
- **Die Bilder werden besser.** Die Szene wird gestellt: ein Notfall-Squawk für die rote
  Hervorhebung, ein HEAVY, ein volles Board, ein satter Reichweitenrekord — statt zu hoffen,
  daß zufällig etwas Vorzeigbares fliegt. Nachts fliegt gar nichts.
- **Es ist mit einer Gegenprobe prüfbar**, deren Antwort vorher feststeht (Abschnitt 10).

**Was echt bleibt und deshalb den Schalter braucht: die Flugplätze.** Sie werden aus der
echten Empfängerposition gerechnet (`radar.js:58`) und stehen auch auf einem Bild mit
erfundenen Zielen richtig. Der Layer-Schalter ist damit die einzige Schutzmaßnahme, die
wirklich in die Konsole gehört — alles andere ist Betriebsmerkmal.

### 3.4 Folgen für den Entwurf

Damit entfallen gegenüber dem ersten Zuschnitt: der globale Publikationszustand, das
Ausblenden von Kennungen an acht Fundstellen auf vier Seiten, das Verhüllen der Uhrzeit an
drei Stellen (`console.js:74` „keine Daten seit HH:MM", `:171` Uhr, `:172` Datum) — und der
10-Minuten-Verfall, weil es keinen gefährlichen Zustand mehr gibt, der verfallen müßte.
`ansicht.js` (Abschnitt 5) lebt ohnehin nur im Speicher; der nächtliche Reload um 4:00
(`console.js:188`) setzt Reichweite und Layer von selbst zurück.

## 4. Erhobene Befunde

Am 31.07.2026 durch Greps über `console/js/` erhoben, nicht angenommen. Sie tragen die
Entwurfsentscheidungen.

### 4.1 Tippen ist bereits belegt

`console.js:158` — ein `pointerup` ohne Wischbewegung ruft `planeWechsel('beruehrung')` und
hält das Karussell 60 Sekunden an. Die ursprüngliche Idee „Tipp auf den Radarschirm schaltet
die Reichweite" würde direkt darauf treten. Deshalb das Zahnrad (Abschnitt 8).

### 4.2 Der Hintergrund wird genau einmal gezeichnet

`radar.js:135` — `drawnBg` ist ein Boolean. Der Grund steht im Kommentar bei `:124`: Eine
Canvas-Schrift, die zum Zeichenzeitpunkt noch nicht geladen ist, fällt lautlos auf die
Ersatzschrift zurück. Ein „einfach immer neu zeichnen" wäre also die falsche Antwort.

### 4.3 Reichweite und Ringe haben mehr Konsumenten als das Radar

| Datei | Stellen | Bedeutung |
|---|---|---|
| `radar.js` | `:35`, `:36`, `:43`, `:45`, `:59`, `:61`, `:70`, `:74`, `:153`, `:218`, `:225`, `:367`, `:368` | Ringe, Peilstrahlen, Flugplatzfilter, Blip-Projektion, Vektorlänge, Maßstabskachel |
| `profile.js` | `:94`, `:105`, `:106`, `:107`, `:112`, `:146` | Der Seitenriß rechnet auf derselben Reichweite |
| `polar.js` | `:446`, `:454` | Innere Ringe bewußt an `cfg.radar.rings_nm` gekoppelt |

`profile.js` und `polar.js` **müssen mitwandern**. Der Kommentar in `polar.js:382` sagt die
Absicht wörtlich: *„wer den Radarmaßstab umstellt, verschiebt beide Seiten gemeinsam"*. Bliebe
`profile.js` auf der Konfiguration, zeigte der Seitenriß 50 NM, während das Radar auf 10 steht
— zwei Seiten desselben Geräts, die sich widersprechen.

### 4.4 Ein latenter Defekt

`radar.js:35` zeichnet **alle** `rings_nm` ohne Filter gegen `range_nm`. Das fällt heute nicht
auf, weil `[10, 25, 50]` zufällig zu `range_nm: 50` paßt. Bei Reichweite 10 lägen zwei von
drei Ringen außerhalb des Kreises. `polar.js` (`ringe()`, `:390`) filtert an derselben Stelle
bereits korrekt mit `r < skala`.

Der Defekt ist heute unsichtbar, weil seine Bedingung nie eintritt. Er wird durch dieses
Vorhaben erst herstellbar.

## 5. `ansicht.js` — der Laufzeit-Zustand

Ein reines Modul: kein DOM, keine Uhr, kein Zustand außerhalb des übergebenen Objekts.
Dasselbe Muster wie `carousel.js`, und aus demselben Grund: Dessen Kommentarkopf hält fest, daß beide historischen Fehler der Karussell-Logik in
der Entscheidung saßen, nicht im DOM, und daß eine Stoppuhr am Panel sie finden mußte, solange
sie nur in der Closure lebte.

```
erzeugeAnsicht()                 -> leerer Zustand (keine Überschreibungen)
setzeStufe(z, index)             -> Reichweitenstufe wählen
schalteLayer(z, id, an)          -> 'airports' ist die erste Instanz
gilt(z, config)                  -> die einzige Frage, die Seiten stellen
```

`gilt()` löst Bootvertrag und Überschreibungen in **eine flache Antwort** auf:

```js
{ range_nm, rings_nm, layer: { airports: true|false } }
```

Damit rechnet **keine Seite** zwei Quellen selbst gegeneinander. Das ist die Eigenschaft, auf
die es ankommt: `config` bleibt der Bootvertrag — das, was `console.json` gesagt hat und was
`mergeConfig` gehärtet hat —, `ansicht` ist, was jemand am Panel gedreht hat. Wer beides in
`config` mischt, kann nach zwei Wochen nicht mehr sagen, welcher Wert woher stammt.

Der Zustand lebt im Speicher und wird nirgends geschrieben. `console.json` bleibt unverändert
die Vorgabe für den nächsten Start.

## 6. Reichweitenstufen

Die Stufen kommen in `DEFAULTS.radar.stufen`, damit die Ringe mitwandern:

```js
stufen: [ { range_nm: 10, rings_nm: [2, 5, 10] },
          { range_nm: 50, rings_nm: [10, 25, 50] },   // heutige Vorgabe
          { range_nm: 80, rings_nm: [20, 50, 80] } ]
```

**Eine Konfiguration darf durch die neue Funktion nicht unerreichbar werden.** Steht in
`console.json` ein `range_nm`, das auf keine Stufe paßt (etwa 35), wird es aus `range_nm` und
`rings_nm` als eigene Stufe **sortiert ergänzt**, nicht ignoriert. Paßt es auf eine
vorhandene Stufe, entsteht keine Dublette.

Beim Start ist die Stufe aktiv, die dem konfigurierten `range_nm` entspricht.

## 7. Layer

Der Flugplatz-Schalter wird als **erste Instanz eines Layers** gebaut, nicht als
hartverdrahtetes `if`. Kein Layer-Rahmenwerk auf Vorrat: Es genügt eine Registrierung mit
Kennung, Beschriftung und Zeichenfunktion, die heute genau einen Eintrag hat. Spätere Layer
(Städte, Sektoren, Lufträume, Anflug- und Holding-Muster) legen einen Eintrag dazu, statt die
Radarseite umzubauen.

Zeichnung und Filterung bleiben, wie sie sind: `drawAirports` filtert bereits gegen die
Reichweite (`radar.js:59`) und wandert damit ohne Änderung mit den Stufen mit.

## 8. Zahnrad und Dialog

**Auffindbarkeit.** Ein `⚙` im Kopf rechts, neben Uhrzeit und Datum. Es erscheint **nur auf
Seiten, die Einstellungen anbieten**: Seitenobjekte bekommen eine optionale Funktion
`einstellungen(config, ansicht)`, die eine kleine deklarative Liste zurückgibt (Beschriftung,
Typ, aktueller Wert, Rückruf). Fehlt sie, gibt es kein Zahnrad. Das ist der Anschlußpunkt für
spätere Layer, ohne daß jemand die Kopfzeile anfaßt.

Für die Radarseite sind es zunächst zwei Einträge: **Reichweite** (10 / 50 / 80 NM als
Segmentwahl) und **Flugplätze** (an / aus).

**Verhältnis zum Karussell — kein neuer Zeitgeber.** Das Öffnen des Dialogs ist eine
Berührung im Sinne der bestehenden Logik und pausiert über `planeWechsel('beruehrung')` 60
Sekunden. Jede Bedienung im Dialog ist ebenfalls eine Berührung und setzt die 60 Sekunden neu.
Wechselt das Karussell schließlich doch weiter, schließt sich der Dialog. Er kann damit **per
Konstruktion nicht offen steckenbleiben**, und die Regel dafür ist die, die seit dem 28.07. am
Panel bewiesen ist — statt einer zweiten, parallelen daneben.

**Der Dialog liegt als Overlay neben `#stage`, nicht darin.** Der `pointerup`-Handler auf
`stage` (`console.js:158`) läse Tipps im Dialog sonst als Wischversuche mit. Der Dialog meldet
seine Berührungen selbst.

**Hintergrund-Invalidierung.** Aus `drawnBg` wird eine **Signatur** aus Reichweite, Ringen und
Layer-Zustand; neu gezeichnet wird, wenn sie sich ändert. Der Grund für das einmalige
Zeichnen (Abschnitt 4.2) bleibt damit gewahrt.

## 9. Fehlerbehandlung

Leitsatz bleibt der aus `config.js:2`: *„Eine kaputte Datei führt zu einer laufenden Konsole
mit Vorgabewerten, niemals zu einem weißen Schirm."*

| Fall | Verhalten |
|---|---|
| `stufen` fehlt oder ist kaputt | Vorgaben. Jede Stufe braucht positives `range_nm` und ein Array positiver `rings_nm`; ungültige Einträge fallen raus |
| Keine Stufe überlebt die Härtung | Vorgaben — **nie eine leere Liste**. Ein Dialog mit null Wahlmöglichkeiten sähe aus wie ein Defekt |
| Konfiguriertes `range_nm` paßt auf keine Stufe | wird als eigene Stufe ergänzt (Abschnitt 6) |
| Stufenindex außerhalb des Bereichs | `gilt()` klemmt auf den gültigen Bereich. **Kein Sentinelwert**, der wie eine Messung aussieht |
| Ring größer als die Reichweite | wird nicht gezeichnet (behebt 4.4) |
| `einstellungen()` einer Seite wirft | kein Zahnrad, Konsole läuft weiter — dieselbe Haltung wie das `finally` in `goTo()` (`console.js:145`) |
| `airports.json` fehlt | `loadAirports()` fängt das ab. Der Schalter bleibt **bedienbar**; ihn auszugrauen wäre eine Selbstauskunft über einen Zustand, der sich beim nächsten Abruf ändern kann |
| `?source=` zeigt ins Leere | `getJSON` liefert `null`, die Seite meldet „KEINE ZIELE IN REICHWEITE". Fachlich richtig; für die Fotosession eine Falle, weil der Tippfehler erst am leeren Bild auffällt. Gehört in die Anleitung, nicht in den Code |

## 10. Test und Abnahme

### 10.1 Reine Modultests

Stufenwahl gültig und außerhalb · konfigurierte Reichweite 35 wird sortiert ergänzt ·
konfigurierte Reichweite 50 erzeugt **keine** Dublette · unbekannte Layer-Kennung wird
ignoriert statt angelegt · `gilt()` ohne Überschreibung ist identisch zur Konfiguration.

### 10.2 Kalibrierung

**Korrektur am 31.07. beim Schreiben des Umsetzungsplans:** Der erste Entwurf dieses
Abschnitts verlangte *„drei Tests, die vor dem Fix ROT sein müssen"*. Das war
vorgeschrieben, nicht gemessen — und zwei der drei können es gar nicht sein. Ein Test gegen
eine Funktion, die es noch nicht gibt, ist rot, weil der Import scheitert, nicht weil er
einen Defekt zeigt. Das ist genau die Sorte Bruch, die man in einen Plan schreibt, statt ihn
auszuführen.

Was **wirklich** rot werden kann:

1. **Höhenprofil und Radar melden dieselbe Reichweite.** ⚠️ **Zweite Korrektur, 31.07. nach der
   Umsetzung von Aufgabe 5:** Auch das stimmte nicht. Der Defekt war real und schwer —
   `profile.js` nahm `sicht` nicht einmal als Parameter an, das Umschalten hatte auf den
   Seitenriß **null** Wirkung (am Vorzustand `69eae6b` unabhängig verifiziert). Aber er saß in
   `render()`, also in DOM-Code, den diese Codebasis bewußt nicht automatisiert prüft. Der Test
   greift stattdessen die frisch **extrahierte** reine Funktion `profilReichweite` — und die gab
   es vorher nicht. Der Rot-Lauf war deshalb ein Importfehler, keine fehlgeschlagene Behauptung
   über einen falschen Wert.

   **Das ist strukturell, nicht der Einzelfall:** Steckt ein Defekt in DOM-Code, und ist das
   Herausziehen einer reinen Funktion Teil der Reparatur, dann *kann* der erste Rot-Lauf nur ein
   Importfehler sein. Aus Code, den es noch nicht gibt, ist keine Wert-Behauptung zu gewinnen.
   Wer so einen Lauf als „Beweis des Defekts" führt, verwechselt die Abwesenheit einer Funktion
   mit dem Nachweis eines Fehlverhaltens.

   Aussagekräftig ist hier allein der **kalibrierte** Rot-Lauf *nach* der Extraktion (Erwartung
   absichtlich auf 50 verstellt → `actual: 10`) — er beweist, daß der Test etwas behauptet. Den
   ursprünglichen Verhaltensdefekt beweist nur das Gerät.
2. **Ring > Reichweite (4.4) — am Gerät, nicht im Test.** Vor dem Filter die Reichweite auf
   10 NM stellen und ein `grim`-Bild ziehen: Ringe außerhalb des Kreises. Das ist der
   Nachweis; ein Modultest darüber ist danach eine Regression, keine Kalibrierung.
3. **Hintergrund-Signatur** — neue Funktion, also nur Neubau-Test. Wird als solcher benannt
   und nicht als Kalibrierung ausgegeben.

Jeder **neue** Test wird trotzdem einmal absichtlich rot gesehen (falsche Erwartung
eintragen, laufen lassen, zurückdrehen), bevor ihm geglaubt wird — das ist die
Repo-Konvention und bleibt.

### 10.3 Absichtlich falsch bedienen

Reichweite umschalten **und wieder zurück** (der Rückweg gehört zur Prüfung) · Dialog offen
lassen und 60 Sekunden warten: das Karussell muß weiterlaufen und ihn schließen · zwei schnelle
Umschaltungen hintereinander · wischen, während der Dialog offen ist · Zahnrad auf einer Seite
ohne Einstellungen (darf nicht da sein).

**Eigener Verdachtspunkt: umschalten, während die Keule läuft.** Die Blips bleiben stehen, der
Hintergrund wird neu gebaut, und `setPhase` (`radar.js:261`) rechnet seine Verzögerung gegen
`sweepStart`. Überstehen die Blips den Hintergrundwechsel nicht, leuchten sie danach am
falschen Azimut auf — genau die Fehlerklasse, die am 27.07. schon einmal am Panel gefunden
wurde.

### 10.4 Am Gerät

Auf einer **eingefrorenen Kopie** des Ausgelieferten wie am 30.07., nicht am produktiven Pfad ·
Deploy aus dem Spiegel `/home/pi/adsb-console`, **nicht** aus einem `/tmp`-Baum (der Befund vom
30.07.: ein Lauf von dort hätte die Konsole zwei Stufen zurückgesetzt) · `grim`-**Reihe über
einen Umlauf** statt einer Momentaufnahme · Schriftprüfung über die **Zeichenbreite**, nicht
über `document.fonts.check()` (meldet `true` für eine Familie, die es nicht gibt).

Wärme ist ein Meßpunkt, kein Argument: Greift die Signatur nicht, zeichnet der Hintergrund
sekündlich neu, und das wäre dort zu sehen.

### 10.5 Gegenprobe für die Fotosession

- Kein Callsign und kein Hex aus den erzeugten Bildern darf in der echten `aircraft.json` oder
  `range.json` vorkommen. Grep über beide, muß leer sein — **und einmal absichtlich mit einem
  echten Callsign gefüttert**, damit bewiesen ist, daß er anschlägt.
- EXIF: Fotos GPS-frei, der Detektor an einem selbstgebauten JPEG **mit** GPS kalibriert. Das
  Video trägt `com.apple.quicktime.location`.

## 11. Zu messen, nicht anzunehmen

**Überlebt eine statische synthetische Quelle die Frischeanzeige?** Setzt der Store
`aircraftAt` nur bei geänderten Daten statt bei jedem erfolgreichen Abruf, steht nach 60
Sekunden „keine Daten seit HH:MM" im Bild und die Seite bekommt die `stale`-Klasse
(`console.js:80`) — auf **jedem** Foto sichtbar. Das entscheidet, ob die Datei statisch sein
darf oder ein kleiner Generator sie fortschreiben muß. Vor dem Bau der synthetischen Daten zu
klären.

## 12. Erfolgskriterien

- [ ] Reichweite am Panel zwischen 10 / 50 / 80 NM umschaltbar, Ringe wandern mit
- [ ] Höhenprofil und Reichweite-Seite folgen der Umschaltung
- [ ] Flugplätze ein- und ausblendbar
- [ ] Zahnrad nur auf Seiten mit Einstellungen
- [ ] Dialog kann nicht offen steckenbleiben (60-Sekunden-Nachweis am Gerät)
- [ ] Der Kopplungstest (Höhenprofil/Radar) war vor der Änderung rot und ist danach grün
- [ ] Der Ring-Überstand bei 10 NM wurde vor dem Filter am Gerät im Bild gesehen
- [ ] Fotosession mit synthetischer Quelle gelaufen, Gegenprobe leer und der Grep einmal
      absichtlich rot gewesen
- [ ] Konsole nach der Session verifiziert zurück auf der echten Quelle
