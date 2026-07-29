# ATC-Konsole Stufe 3 — Polar, die Reichweite

> Datum: 2026-07-29
> Status: Entwurf, freigegeben — Umsetzung offen
> Gerät: `adsapp01`
> Grundlage: [`2026-07-27-atc-konsole-design.md`](2026-07-27-atc-konsole-design.md) §6.5,
> [`2026-07-28-stufe-2-entwurf.md`](2026-07-28-stufe-2-entwurf.md) (in Betrieb seit 28.07.)

Dieses Dokument faßt §6.5 des Hauptentwurfs neu und ist ihm gegenüber maßgeblich. Es
beschreibt die **siebte und letzte Seite** der Konsole. Danach ist der Entwurf vom 27.07.
vollständig umgesetzt.

Stufe 3 enthält **nur** die Polar-Seite. `interrupt_carousel` und der Feld-Zwischenspeicher
je `hex` bleiben ausdrücklich draußen (§11) — mit zwei gleichzeitigen Änderungen ließe sich
der Wärmelauf nicht mehr zurechnen, und das ist derselbe Fehler, den §7.1 des
Stufe-2-Entwurfs schon einmal benannt hat.

## 1. Was am 29.07. gemessen wurde

Ein Abzug von `range.json` am 29.07. um **12:36:58** vom laufenden Gerät. Nicht aus dem
Bootstrap übernommen, nicht aus dem Gedächtnis: die Datei selbst gezogen. Sie trägt die
Entwurfsentscheidungen dieses Dokuments.

| Größe | Wert |
|---|---|
| Sektoren mit Allzeit-Rekord | **36 von 36** |
| Sektoren mit Stundenmaximum | **36 von 36** |
| Größter Rekord | **79,37 NM** — Sektor 1 (010–019°), `502d65`, FL390, 27.07. 18:21 |
| Kleinster Rekord | **16,25 NM** — Sektor 26 (260–269°), DLH8RY, FL380 |
| Stundenmaximum größtes / kleinstes | 59,42 / 8,76 NM |
| **Rekorde jenseits von 50 NM** | **13 von 36** |
| **Rekordhalter ohne Callsign** | **19 von 36** |
| Rekorde, die am Meßtag selbst fielen | **8 von 36** (zwischen 01:37 und 12:04) |

Vier Konsequenzen, jede trägt einen Abschnitt weiter unten:

- **13 Rekorde liegen jenseits des Radarmaßstabs.** Ein Kreis mit `radar.range_nm` = 50 NM
  klemmt mehr als ein Drittel der Werte — und zwar genau die, wegen derer die Seite
  existiert. Der Maßstab dieser Seite ist deshalb ein eigener (§2).
  **Der Rekordbestand hat die Messung überholt, die den 50-NM-Maßstab begründet hat:**
  §2.3 des Hauptentwurfs sah über eine Stunde ein Maximum von 69,1 NM und keine einzige
  Position jenseits von 75 NM. Zwei Tage Sammeln haben 79,4 NM ergeben. Das ist keine
  Korrektur an §2.3 — eine Stunde und ein Allzeit-Maximum beantworten verschiedene Fragen —
  sondern der Beleg dafür, daß genau diese Seite einen anderen Maßstab braucht als der
  Radarschirm.
- **Über die Hälfte der Rekordhalter hat kein Callsign.** §6.5 des Hauptentwurfs sagt
  „mit Datum, Callsign und Flugfläche des Rekordhalters" zu. Diese Zusage ist bei 19 von
  36 Sektoren nicht einlösbar; es gilt die Regel von Board und Einzelziel: **der `hex`
  steht in der Zeile, kein Gedankenstrich.**
- **Acht Rekorde fielen an einem einzigen Tag.** Die Seite ist nicht statisch, und eine
  Zeile „zuletzt gefallen" hat echten Inhalt (§3).
- **`hour_max` ist ein Objekt mit Zeichenketten-Schlüsseln**, `records` ein Array von
  Objekten. Beim Vorbereiten des Stufe-3-Bootstraps lief ein `max()` über die Schlüssel
  statt über die Werte und warf einen `TypeError`, der kurz für einen Datenfehler gehalten
  wurde. Es war ein Lesefehler. **Diese Form wird getestet, nicht kommentiert** (§5).

## 2. Der Kreis

Layout wie Radar und Höhenprofil: **Bild links, Datenspalte rechts.** 620 × 620 px, das ist
die Bühnenhöhe (720 minus 56 Kopf minus 44 Indikatorreihe).

**SVG, nicht Canvas.** Die Quelle wird alle 60 s geschrieben und die Seite hat keine
Animation. Eine Canvas-Renderschleife wäre auf diesem Gerät reine Wärme — und §7.1 des
Hauptentwurfs hält ausdrücklich fest, daß eine unsichtbare Canvas zu rendern hier auch eine
thermische Verschwendung ist.

### 2.1 Zwei Spuren, als Treppe

- **Allzeit-Rekord:** gefüllte, gedämpfte Fläche mit hellerer Kante.
- **Stundenmaximum:** helle Linie darin.

Der Rekord ist per Konstruktion die Hülle des Stundenwerts — beide speisen sich aus
demselben Datenstrom, der Rekord ist nur das Maximum über die längere Zeit. Deshalb ist er
die Fläche und die Stunde die Linie.

**Beides als Treppe über 36 Stufen konstanten Radius', nicht als geglättetes Polygon durch
die Sektormitten.** Ein Sektormaximum gilt für seine vollen 10°; eine Linie durch die
Mitten behauptete eine stetige Funktion der Peilung, die die Daten nicht hergeben. Das wäre
ein Instrument, dessen Bild eine feinere Frage beantwortet als die gemessene.

**Ein Sektor ohne Stundenwert reißt die Stundenlinie auf.** Er fällt **nicht** auf 0. Ein
Polygon, das im Zentrum durchhängt, behauptet „0 NM gemessen"; fehlende Werte sind in
dieser Konsole nie eine Null. Heute sind alle 36 Sektoren belegt — nachts wird die Lücke
der Regelfall sein, und genau dann muß die Anzeige recht behalten.

**Liegt ein Stundenwert über dem Rekord**, ragt die Linie aus der Fläche heraus. Das ist
kein Fehlerfall, sondern die ehrliche Anzeige eines zurückgesetzten Rekordbestands (neue
Datenbank, gelöschte Datei). Nichts wird geklemmt, nichts stürzt ab.

### 2.2 Der Maßstab wächst in 20-NM-Stufen

```
skalaNm = max(20, ceil(größterRekord / 20) * 20)     heute: 80 NM
```

Der Kreis klemmt damit **nie** — und was er zeigt, ist immer der volle Rekord. Bricht ein
Rekord die Stufe, wächst der Kreis einmalig und sichtbar; das ist ein Ereignis und darf
eines sein.

**Die Ringe des Radars bleiben als Gitter drin:** `cfg.radar.rings_nm` (10 · 25 · 50),
gefiltert auf das, was in die Skala paßt, dazu ein beschrifteter Außenring auf der
Skalenstufe. Wer auf dem Radar den 50-NM-Ring sieht, findet ihn hier wieder — dieselbe
Kopplung wie beim Höhenprofil, und sie hat sich bei der Stufe-2-Abnahme als Beleg bewährt,
daß eine Seite wirklich aus `cfg.radar` liest und nicht aus eigenen Zahlen.

Peilungsmarken bei 000, 090, 180, 270 laufen heute in `ui-monospace`, nicht in B612 wie im
Radarkreis. B612 ist für diese Seite offen und wird vor der Geräteabnahme entschieden: Die
gemessene Zeichenbreite (31,95 gegen 29,80 px mit dem Fallback) drückt den Abstand der
`090`-Marke zum Außenring auf 0,05 px, und `PEIL_SCHRIFT` wäre dann am Gerät neu zu messen.
Norden oben, im Uhrzeigersinn.

### 2.3 Eine Funktion wandert

`projectToCanvas` liegt heute in `radar.js`, ist aber eine reine Geometriefunktion ohne
DOM und ohne Zustand — nach der Repo-Konvention (`CLAUDE.md`, „Struktur") gehört sie nach
`geo.js`. Sie wird dorthin verschoben; `radar.js` und `tests/test_radar_geometry.mjs`
ziehen mit.

**Sie wird nicht kopiert.** Zwei Fassungen derselben Projektionsformel sind der Anfang
davon, daß zwei Teile derselben Konsole dieselbe Eingabe verschieden deuten. Der Eingriff
faßt die abgenommene Radarseite an und wird deshalb zuerst gebaut, mit grünem
`test_radar_geometry.mjs`, bevor die Polar-Seite darauf aufsetzt.

## 3. Die Spalte rechts

Drei Blöcke: eine Trophäe, die Physik, ein Puls.

### 3.1 Trophäe — der absolute Rekord

```
79.4 NM
Sektor 010–019°  ·  FL390  ·  502d65  ·  27.07. 18:21
```

Der Halter ist `callsign`, ersatzweise `hex` — bei 19 von 36 Sektoren ist das der
Regelfall, nicht die Ausnahme. Ein Gedankenstrich stünde dort nur, wenn **beide** fehlen.

Der Sektor wird als **Bereich** beschriftet (`010–019°`), nicht als Peilung.
`formatBearing` wird hier **nicht** benutzt: Sie macht aus 0 die 360, was für eine Peilung
richtig ist („drei-sechs-null") und für eine Bereichsuntergrenze falsch wäre.

### 3.2 Die zwölf Richtungen

Zwölf Kästen à 30°, **je genau drei Sektoren**, mit dem Maximum der Gruppe (Rekord und
Stunde) und einem Balken. Beschriftet mit Kompaßnamen **und** Gradbereich.

| Richtung | Bereich | Rekord NM | Stunde NM |
|---|---|---|---|
| NNO | 000–029° | **79.4** | 59.4 |
| NO | 030–059° | 58.6 | 49.4 |
| ONO | 060–089° | 54.8 | 37.1 |
| OSO | 090–119° | 51.4 | 42.7 |
| SO | 120–149° | 53.0 | 44.1 |
| SSO | 150–179° | 36.3 | 27.7 |
| SSW | 180–209° | 23.2 | 19.4 |
| SW | 210–239° | 22.6 | 22.6 |
| WSW | 240–269° | **19.8** | 17.3 |
| WNW | 270–299° | 26.2 | 18.0 |
| NW | 300–329° | 37.3 | 31.1 |
| NNW | 330–359° | 55.6 | 42.1 |

Stand 29.07. 12:36. **Das Verhältnis NNO zu WSW ist 4 : 1** — das ist die Aussage der
Seite, und sie steht damit in Zahlen neben dem Bild.

Zahlen in diesem Abschnitt und in §3.1 stehen mit Dezimalpunkt, nicht Komma — konsistent
mit dem Code (`zahlNm` nutzt `toFixed`, ebenso `board.js`, `radar.js` und `target.js` in der
übrigen Konsole). Eine konsoleweite Umstellung auf `toLocaleString('de-DE')` wäre möglich,
ist aber nicht Gegenstand dieser Stufe.

Hat eine Gruppe für die letzte Stunde **keinen** Wert (alle drei Sektoren leer), steht dort
ein **Gedankenstrich**, keine 0 — dieselbe Regel wie bei der aufgerissenen Linie im Kreis.
Nachts wird das der Regelfall für den Westen sein.

Eine Richtung ohne Stundenwert zeigt die Zahl als Gedankenstrich **und keinen Balken**. Ein
Balken der Länge Null ist die einzige Stelle der Seite, an der ein fehlender Wert doch eine
Pixelaussage macht — und das ist bewußt so: Kein Balken heißt kein Balken, nicht „0 NM
gemessen".

**Warum zwölf und nicht acht.** §2.3 des Hauptentwurfs nennt acht 45°-Sektoren. **45° teilt
36 Zehn-Grad-Sektoren nicht** — es kämen 4,5 heraus, in der Praxis also abwechselnd vier
und fünf Sektoren je Gruppe. Für eine **Maximum**-Statistik ist das ein systematischer
Fehler und kein Schönheitsfehler: Eine Gruppe aus fünf Sektoren hat mehr Gelegenheiten,
hoch zu liegen, als eine aus vier. Die Balken wären untereinander nicht vergleichbar. Am
echten Bestand nachgerechnet: N bekäme vier Sektoren, NO fünf.

Dreiergruppen ab 0° teilen exakt. Ihre Grenzen liegen dann aber auf 0/30/60/90…, und genau
dort liegen N, O, S und W — **die vier Kardinalrichtungen werden zu Grenzen statt zu
Namen.** Eine auf Nord zentrierte Gruppe müßte von 345° bis 015° laufen, und 345 ist keine
Sektorgrenze. Das ist nicht wählbar, sondern folgt aus dem 10°-Raster des Daemons.

Die Namen sind deshalb die zwölf verbleibenden Striche des 16-Strich-Kompasses. Vier davon
treffen die Kastenmitte punktgenau (NO 45°, SO 135°, SW 225°, NW 315°), die anderen acht
liegen 7,5° daneben. **Der Name ist die Merkhilfe, der Gradbereich ist die Tatsache** —
deshalb steht in jeder Zeile beides. Ein Etikett allein nennte eine etwas andere Richtung
als die gemessene.

Die acht Werte aus §2.3 des Hauptentwurfs bleiben dort als historische Messung stehen. Sie
werden **nicht** zum Anzeigeformat.

### 3.3 Puls — zuletzt gefallen

Eine Zeile:

```
zuletzt gefallen:  Sektor 230–239°  ·  22,6 NM  ·  504e61  ·  vor 32 min
```

Acht der 36 Rekorde fielen am Meßtag. Diese Zeile ist der einzige Teil der Seite, der sich
im Minutentakt ändern kann, und sie unterscheidet „die Anlage sammelt" von „die Anlage
steht".

### 3.4 Höhenbudget

Gemessen im Browser, nicht gerechnet: `.page` hat `padding: 16px 0 6px`, die Spalte also
**598 px**, nicht 620. Die drei Kacheln brauchen 119 (Trophäe) + 364 (zwölf Zeilen) + 85
(Puls) = 568 px, plus zwei Lücken à 12 px = **592 px**. Reserve: **6 px**, nicht rund 100.
**Nichts scrollt.** Was nicht paßt, ist ein Layoutfehler und keine Scrollbar. Chromium auf
dem Pi kann andere Zeilenhöhen liefern als der Meßbrowser — bei 6 px Reserve reicht das,
um zu kippen. Der Rückzug (eine schmalere Trophäe) muß deshalb **vor** der Geräteabnahme
bereitliegen, nicht erst danach gebaut werden.

## 4. Leerzustand und Alterung

`ageSource: 'range'` — die Kopfzeile altert mit `state.rangeAt`. Steht der Daemon, altert
die Seite sichtbar, statt Zahlen von vorgestern als frisch auszugeben. Das ist dieselbe
Eigenschaft, die die Systemseite über `written_at` hat, hier über die schon vorhandene
Abrufuhr.

`state.range === null` (Daemon nie gelaufen, Datei nicht ausgeliefert) → Leerzustand
„KEINE REICHWEITENDATEN" mit `leerUntertitel(state)`, also letztes Ziel und
Nachrichtenrate. Ein leerer Kreis ohne Untertitel wäre von einem Defekt nicht zu
unterscheiden.

`records` vorhanden, aber leer → derselbe Leerzustand. Kein Kreis mit Radius 0.

## 5. Reine Funktionen und Tests

Muster wie `profile.js`: was rechnet, wird aus `pages/polar.js` exportiert und ohne Browser
getestet; was zeichnet, wird am Panel geprüft. Keine DOM-Testumgebung.

| Funktion | Aufgabe |
|---|---|
| `skalaNm(groessterNm)` | 20-NM-Stufe, Mindestwert 20 |
| `polarModell(range)` | `records` + `hour_max` → 36 Sektoren, Skala, größter, zwölf Richtungen |
| `zuletztGefallen(records, nowMs)` | jüngster Rekord — **die Uhr wird übergeben, nicht gelesen** |
| `sektorBereich(s)` | `0` → `'000–009°'` |
| `halterName(record)` | `callsign` → `hex` → Gedankenstrich |

Testlauf **immer** `node --test tests/*.mjs` mit Dateimuster. Dieses Node schreibt
`ℹ tests N`, nicht `# tests N`; **gelesen wird die Zahl der ausgeführten Tests, nicht nur
die der Fehler.**

Die Fälle, und warum gerade sie:

- **`skalaNm`: genau 80,0 muß 80 ergeben, nicht 100.** Der plausibelste Rechenfehler ist
  ein `ceil` auf einen um Epsilon erhöhten Wert oder ein `floor` mit Nachschlag — beide
  landen bei 100 und werden damit sichtbar. 79,37 → 80, 80,0 → 80, 80,01 → 100, 0 → 20.
- **`hour_max` als Objekt mit Zeichenketten-Schlüsseln**, Fixture `{"7": 12.3}` und Sektor
  7. Genau der Lesefehler aus §1.
- **Zwölftel-Gruppierung: jede Gruppe genau drei Sektoren, Summe 36.** Eine Gruppierung,
  die 4,5 ergäbe, wird hier rot. Das ist der Test, der die Entscheidung aus §3.2 bewacht.
- **Fehlender Stundenwert bricht die Linie**, erzeugt nirgends eine 0. Und eine
  Richtungsgruppe ohne jeden Stundenwert liefert `null`, nicht 0 — geprüft wird beides,
  weil hier zwei verschiedene Stellen dieselbe Regel einhalten müssen.
- **Stundenwert größer als Rekord** — Ergebnis wohldefiniert, kein Absturz, keine Klemmung.
- **`halterName`**: Callsign fehlt → `hex`; beides fehlt → Gedankenstrich; Leerstring gilt
  als fehlend (dump1090 füllt das Feld mit Leerzeichen auf).
- **`sektorBereich(0)` ist `000–009°`**, nicht `360–009°`. Die Gegenprobe, deren Antwort
  vorher feststeht, ist `formatBearing(0) === '360°'` — beide Konventionen nebeneinander,
  damit die Verwechslung auffällt statt sich einzuschleichen.
- **`zuletztGefallen` mit leerer Liste** → `null`, nicht der Epochen-Nullpunkt.

**Jeder Test wird einmal absichtlich rot gesehen**, indem die geprüfte Formel gebrochen
wird. Ein Test, der nie rot war, ist unkalibriert.

Was die Testsuite nicht leisten kann, steht in beiden bisherigen Abnahmen: Von den acht
ernsten Befunden der Stufe 2 fand Hennings Hand am Panel drei, darunter den einen Critical,
den 121 Tests nicht sahen.

## 6. Ein Prüfhaken, den es noch nicht gibt: `?range=`

`?source=` biegt heute nur `aircraft.json` um (`data.js`). `range.json` kommt aus `data/`
und wird alle 60 s vom Daemon überschrieben. **Fünf der Abnahmepunkte aus §9.2 wären ohne
Haken gar nicht auslösbar** — und ein Pfad, den man nie auslösen kann, ist unkalibriert
(Spec §10.3).

Also ein `?range=` in derselben Bauform: erst beim Abruf ausgewertet, nie auf Modulebene
(`location` gibt es nur im Browser — genau daran scheiterte am 27.07. jeder Node-Test, der
`data.js` mittelbar importierte). Gesetzt wird er wie bei der Stufe-2-Abnahme über ein
systemd-Drop-in an der Kiosk-URL; die Prüfdateien entstehen **auf dem Gerät**, damit keine
Koordinate es verläßt. Nach der Abnahme Drop-in, Skript und Dateien restlos entfernen und
gegenprüfen (URL ohne Parameter, Dateien HTTP 404, Drop-in-Verzeichnis weg).

Der produktive Datenpfad `/var/www/html/atc/data/` wird für die Abnahme **nicht**
beschrieben.

## 7. Karussell und Wärme

Mit der siebten Seite: **Umlauf 45 + 6 × 15 = 135 s = 2:15**, Radaranteil **33,3 %** (von
37,5 %). Die Tabelle in §7.1 des Hauptentwurfs führt diese Zeile bereits — sie wird von
„nach Stufe 3" auf „heute" umgeschrieben.

`polar` steht in `console.json` schon auf `true` und in `PAGE_ORDER` an vierter Stelle. Mit
dem Renderer entfällt die Filterung in `console.js:12`; die Indikatorreihe bekommt
**sieben** Punkte. Der Hinweistext in `console.json`, der `interrupt_carousel` als „noch
nicht umgesetzt" führte, sagte bislang „frühestens Stufe 3" — Stufe 3 ist jetzt fertig und
enthält `interrupt_carousel` nicht. Der Text bleibt stehen, ist aber auf „frühestens
Stufe 4" korrigiert (§11): Er bleibt stehen, wahr ist er nur in der korrigierten Fassung.

## 8. Was im Hauptentwurf nachgezogen wird

| Abschnitt | Änderung |
|---|---|
| §6.5 (Polar) | vollständig ersetzt durch §2 und §3 dieses Dokuments |
| §2.3 | bleibt als historische Messung; Hinweis, daß das Anzeigeformat zwölf 30°-Kästen sind (§3.2) |
| §7.1 (Karussell) | Tabellenzeile „nach Stufe 3" wird zu „heute": 7 Seiten, 2:15, 33 % |
| §11 (Stufung) | Stufe 3 auf den hier beschriebenen Inhalt; der Absatz „Nach Stufe 2 laufen sechs Seiten" samt Filterbemerkung entfällt |
| §10.3 (Am Gerät) | die vier `?range=`-Prüfungen aus §9.2 aufnehmen |

`CLAUDE.md`: `geo.js` in der Strukturübersicht um die verschobene `projectToCanvas`
ergänzen.

## 9. Verifikation

### 9.1 Die Wärmekriterien — festgelegt, bevor gemessen wird

| Kriterium | Grenze |
|---|---|
| `total.local.samples_dropped` | bleibt **0** — das harte Kriterium |
| `get_throttled` | bleibt `0x0` |
| CPU-Temperatur | unter **72 °C** |

Unverändert seit dem Spike vom 27.07. **Eine Grenze, die man nach der Messung verschiebt,
ist keine.**

**Meßabstand 37 s, nicht 30.** 30 s teilen 135 s nicht — aber 27 und 45 tun es, und 30
teilte den alten 120-s-Umlauf. Genau daran war die Messung vom 28.07. unterabgetastet: Alle
Punkte trafen dieselben vier Phasen, mit **1,67 K systematischem Unterschied**, und aus der
Zickzacklinie wurde ein Trend gelesen, den es nicht gab. 37 s teilt 135 nicht, die Phase
wandert durch.

**Die Marge, auf die es ankommt, ist die am Maximum, und sie betrug zuletzt 0,9 K.** Nicht
der Mittelwert reißt im Hochsommer zuerst, sondern die Spitze — und die Spitzen liegen
sämtlich in der Phase, die die Radarseite fängt.

**Was diese Messung nicht beantwortet:** ob die Polar-Seite billig ist. Es ändern sich
wieder zwei Dinge gleichzeitig — eine Seite kommt hinzu, und der Radaranteil fällt von
37,5 % auf 33 %. Ein kühleres Ergebnis darf **nicht** als „die Polar-Seite kostet nichts"
gelesen werden. Gemessen wird der Liefergegenstand, nicht die Zurechnung.

Reißt ein Kriterium, ist der Rückfall eine **Konfigurationsentscheidung** — Standzeiten und
Radaranteil stehen in `console.json` — und wird ihrerseits nach demselben Verfahren
gemessen.

### 9.2 Abnahme am Gerät — absichtlich gegen die Absicht bedient

Der vorgesehene Weg beweist nur, daß es ihn gibt.

1. **Sektor ohne Stundenwert** (über `?range=`): Die Stundenlinie **reißt auf**. Sie fällt
   nicht ins Zentrum. Gegenprobe vorher mit vollständiger Datei — sonst sieht „Lücke"
   genauso aus wie „heil". Das ist die Lehre aus der kaputten Konfiguration der Stufe 2:
   Erst eine gültige, **sichtbar andere** Fassung macht den Defekt beweisbar.
2. **Rekord über der Skalenstufe** (95 NM präpariert): Der Kreis muß sichtbar auf 100 NM
   atmen, der Außenring seine Beschriftung ändern, und nichts darf geklemmt werden.
3. **Stundenwert größer als Rekord**: Die Linie ragt aus der Fläche. Kein Absturz, keine
   stille Klemmung.
4. **Leere `records`** und **fehlende Datei**: Leerzustand mit Untertitel, kein weißer
   Schirm, kein Kreis mit Radius 0.
5. **Daemon töten:** Die Polar-Seite altert sichtbar über die Kopfzeile, die anderen sechs
   laufen weiter. Wieder starten: erholt sich.
6. **Sieben Punkte in der Indikatorreihe** und **Umlauf 2:15 mit der Stoppuhr**. Dabei
   **absichtlich in beide Richtungen wischen und die Wiederaufnahme nach 60 s von der
   sichtbaren Seite aus prüfen.** Diese Logik war dreimal falsch, und dreimal fand es eine
   Hand am Panel und kein Test. Die siebte Seite ändert die Zahlen, an denen sie hängt.
7. **Netzstecker ziehen** — die Zusage, die man beim ersten Mal einhält und beim dritten
   vergißt.
8. **Kaputte Konfiguration** mit sieben registrierten Seiten: alle auf `false`, unbekannter
   Seitenname, JSON-Syntaxfehler. Vorgabewerte, kein weißer Schirm. Wiederhergestellt wird
   **die Fassung aus dem Repo**, nicht eine Sicherung.
9. **B612 an einem Ziel am Bildrand** — der offene Punkt der Stufe-2-Abnahme. Wird
   mitgenommen, **wenn** ein Ziel dort steht; er hängt an der Luftlage und wird nicht
   gestellt. Steht keines, bleibt er offen und wird als offen protokolliert.
10. **Vor jedem Layout-Urteil sicherstellen, daß die geladene Fassung die gebaute ist.**
    Beim Stufe-2-Bau ein Beinahe-Fehlurteil an einer gecachten Datei.
11. **Rückbau gegengeprüft:** Kiosk-URL ohne `?range=`, Prüfdateien HTTP 404,
    Drop-in-Verzeichnis weg. Der Rückweg gehört zur Prüfung.

## 10. Risiken, benannt

- **`projectToCanvas` zu verschieben faßt die abgenommene Radarseite an.** Reine Funktion,
  bestehender Test — aber die Radarseite ist die teuerste der Konsole. Zuerst bauen, Test
  grün sehen, dann die neue Seite daraufsetzen.
- **`?range=` ist eine zusätzliche Abzweigung im Datenpfad.** Sie wird beim Abruf
  ausgewertet, nicht beim Laden des Moduls, und darf keinen Node-Test brechen.
- **Zwölf Tabellenzeilen sind dichter als alles bisher auf einer Seite.** Das Höhenbudget
  rechnet auf, gerechnet ist aber nicht gesehen — das Urteil fällt am Panel. Der Rückzug
  wäre die Trophäe schmaler oder acht Richtungen mit ihrem benannten Bias; beides ist eine
  CSS- bzw. Konstantenänderung.
- **Der Wärmelauf hat wieder zwei Änderungen zugleich.** Benannt, nicht behoben — die
  Zurechnung bräuchte einen zweiten Lauf mit eingefrorener Konfiguration.
- **Die Marge am Maximum ist 0,9 K und es ist Hochsommer.**

## 11. Nicht in Stufe 3

- **`interrupt_carousel`.** Bleibt eine offene Zusage. Vor dem Bau braucht es vier
  Antworten: **welche** Seite wird angesprungen, wie lange bleibt sie, was geschieht bei
  mehreren Notfällen, wie kommt man zurück. Ohne diese vier nicht bauen. Der Hinweis in
  `console.json` sagt das ehrlich und bleibt stehen.
- **Feld-Zwischenspeicher je `hex`.** Gemessen begründet (134 von 174 Kennungen verlieren
  ihr Callsign innerhalb einer Stunde mindestens einmal, 38 hatten nie eines), aber eine
  eigene Stufe. Die enge Fassung merkt Felder, solange dump1090 das Ziel hält, mit
  Zeitstempel je Feld. Die weite Fassung — Ziele überleben lassen, nachdem dump1090 sie
  fallenläßt — widerspricht §8 des Hauptentwurfs („kein ewig helles Geisterziel") und
  bräuchte eine eigene Bildsprache. **In beiden Fällen bleibt bewußt: Wir zeigen dann ein
  Callsign, das dump1090 selbst schon für zu alt hält.** Das gehört in die Spec jener
  Stufe, nicht in einen Kommentar. Nebenbefund fürs Protokoll: 9 von 2866 Einträgen einer
  Stunde beginnen mit `~` — TIS-B/ADS-R-Kennungen und **keine** ICAO-Adressen. Als
  Schlüssel mit Vorsicht.
- **Auswahl eines Sektors per Fingertipp.** Eine Wandanzeige, die von selbst das Richtige
  zeigt, schlägt eine, deren Zustand jemand zurücksetzen müßte.
- Spurhistorie, MLAT als zweite Zielklasse, Nachtabsenkung, umschaltbarer Radar-Maßstab —
  unverändert zurückgestellt (§12 des Hauptentwurfs).

## 12. Was beim Bauen anders wurde

Drei Abweichungen gegenüber diesem Entwurf, festgestellt am gebauten Stand vom
29.07.2026 (`ℹ tests 156`, `ℹ fail 0`):

1. **`BILD.rand` ist 34, nicht 26** ([`console/js/pages/polar.js`](../../console/js/pages/polar.js)),
   und die vier Peilungsmarken werden aus ihm **gerechnet** (`markenPlatz`/`markenKasten`),
   nicht als Pixelzahlen hingeschrieben. Die erste Fassung schrieb sie mit festem Versatz
   hin, und die `090`-Marke lief 6 px über die Bildkante hinaus, wo sie abgeschnitten
   wurde — dieselbe Fehlerklasse wie Befund 5 der Stufe-1-Abnahme. Ein Test bewacht die
   Invariante seither ohne Browser: keine Marke über die Bildkante oder in den Außenring.
2. **Die Ringbeschriftungen werden zuletzt gezeichnet**, mit Aussparungsrand. SVG zeichnet
   in Dokumentreihenfolge; in der ersten Fassung lagen drei von vier Ringmarken
   (10/25/50 NM) unter der Rekord-Fläche und waren zugemalt — nur „80 NM" ragte über den
   größten Rekord hinaus und war lesbar. Der Maßstab der Seite war damit praktisch nicht
   ablesbar. Jetzt werden erst Fläche und Kante gezeichnet, die Ringbeschriftungen danach.
3. **Der Wortlaut von §2.2 ist ungenau**, das Verhalten ist es nicht. Die Formel dort
   nennt den Eingabewert `größterRekord`; tatsächlich fließt die **Spitze beider Spuren**
   ein — das Maximum über alle 36 Sektoren von `max(rekordNm, stundeNm ?? 0)`, nicht nur
   der Rekord. Grund: §2.1 sieht ausdrücklich vor, daß ein Stundenwert über dem Rekord aus
   der Fläche ragen darf (nach einem zurückgesetzten Rekordbestand) — eine allein am
   Rekord bemessene Skala hätte diesen Fall aus dem **Bild** ragen lassen, nicht nur aus
   der Fläche. Kein Verhaltensunterschied zur Absicht des Dokuments, nur ein Formelname,
   der seine eigene Prämisse nicht abdeckte.
