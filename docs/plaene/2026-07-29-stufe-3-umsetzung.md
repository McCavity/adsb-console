# ATC-Konsole Stufe 3 — Umsetzungsplan

> **Für agentische Bearbeiter:** ERFORDERLICHE SUB-SKILL: `superpowers:subagent-driven-development`
> (empfohlen) oder `superpowers:executing-plans`, um diesen Plan Aufgabe für Aufgabe
> abzuarbeiten. Die Schritte tragen Kästchen (`- [ ]`) zur Verfolgung.

**Ziel:** Die siebte und letzte Seite der Konsole bauen — Polar/Reichweite, 36 Sektoren als
Windrose mit Allzeit-Rekord und Stundenmaximum, plus Trophäe, zwölf Richtungen und Puls in
der Datenspalte.

**Architektur:** Reines Statik-Frontend, ES-Module ohne Bündler. Die Seite ist ein Modul
unter `console/js/pages/polar.js`, das sich über `registerPage()` anmeldet und
`{id, title, ageSource, mount, render}` liefert. **SVG, nicht Canvas** — die Quelle wird
alle 60 s geschrieben, es gibt keine Animation, und eine Renderschleife wäre auf diesem
Gerät reine Wärme. Jede rechnende Regel wird als reine, exportierte Funktion aus dem DOM
herausgezogen und dort getestet.

**Tech-Stack:** ES-Module, `node --test` für JavaScript, CSS ohne Präprozessor. Der Daemon
wird in diesem Plan **nicht** angefaßt.

**Maßgebliche Dokumente:**
- Entwurf Stufe 3: [`docs/specs/2026-07-29-stufe-3-entwurf.md`](../specs/2026-07-29-stufe-3-entwurf.md)
- Hauptentwurf: [`docs/specs/2026-07-27-atc-konsole-design.md`](../specs/2026-07-27-atc-konsole-design.md)
- Entwurf Stufe 2: [`docs/specs/2026-07-28-stufe-2-entwurf.md`](../specs/2026-07-28-stufe-2-entwurf.md)
- Abnahme Stufe 2: [`docs/abnahme/2026-07-28-stufe-2.md`](../abnahme/2026-07-28-stufe-2.md)

## Globale Randbedingungen

Diese gelten für **jede** Aufgabe, auch wo sie nicht wiederholt werden.

- **Keine Fremdquelle zur Laufzeit.** Kein CDN, keine Kartenkacheln, keine externe
  Bibliothek. Wird bei der Abnahme durch Ziehen des Netzsteckers geprüft.
- **Die exakte Empfängerposition gehört nicht ins Repo** — kein Testfixture, kein
  Beispiel-Config, kein Kommentar, auch keine gerundete Fassung. Wo Tests eine Position
  brauchen, ist es die erfundene `50.0 / 9.0`. **Diese Seite braucht gar keine** — sie
  rechnet auf Entfernungen und Peilungen, die der Daemon schon gebildet hat.
- **Kein Umbau am ADS-B-Stack.** Weder `dump1090-fa`, noch die Feeder, noch die
  lighttpd-Konfiguration, noch der Daemon.
- **Fehlende Werte sind `null` bzw. ein Gedankenstrich `—`, niemals `0`.** Eine 0 meldet
  einen gemessenen Zustand. Das ist in dieser Stufe die am häufigsten verletzte Regel:
  Ein Sektor ohne Stundenwert reißt die Linie auf, er fällt nicht ins Zentrum.
- **Nur ES-Module, keine externe Bibliothek, keine DOM-Testumgebung.** Was nur im Browser
  läuft, wird am Gerät geprüft, nicht durch eine Attrappe.
- **Testlauf ist immer `node --test tests/*.mjs`** — **mit Dateimuster, nie blank.** Ein
  blankes `node --test` findet in diesem Repo keine Datei und meldet trotzdem `fail 0`.
- **Gelesen wird die Zeile `ℹ tests N`, nicht nur `ℹ fail 0`.** Null Fehler bei null Tests
  ist kein Ergebnis. **Nicht mit `grep '^# tests'` suchen** — dieses Node stellt den Zeilen
  `ℹ` voran, das `grep` gibt nichts aus und sieht aus wie ein stiller Erfolg. Verläßlich:

  ```bash
  node --test tests/*.mjs 2>&1 | tail -9
  ```
- **Ausgangswert am 29.07.2026, selbst gemessen: `ℹ tests 121`, `ℹ fail 0`** (Node
  v26.3.1). Jede Aufgabe nennt, auf welchen Wert die Zahl steigen muß. Steigt sie nicht,
  ist die Testdatei nicht gelaufen — unabhängig davon, was `fail` sagt.
- **Jeder neue Test wird einmal absichtlich rot gesehen**, bevor ihm geglaubt wird. Die
  Schritte dafür stehen in jeder Aufgabe ausgeschrieben.
- **Anzeigesprache Deutsch**, Fachbegriffe englisch (Squawk, Track, FL, Heavy). Einheiten
  nautisch: NM, Flugfläche. Zahlen mit `toFixed(1)`, Dezimalpunkt — so macht es das ganze
  übrige Frontend, und zwei Konventionen wären schlimmer als die falsche.
- **Nichts scrollt.** Was nicht ins Layout paßt, ist ein Layoutfehler und keine Scrollbar.
- **Subagenten führen keine `sudo`-Befehle auf `adsapp01` aus.** Alles, was das produktive
  Feeder-Gerät anfaßt, macht der Controller in der Hauptsitzung.

## Dateien

| Datei | Verantwortung | Aufgabe |
|---|---|---|
| `console/js/geo.js` | reine Rechenfunktionen; bekommt `projectToCanvas` | 1 |
| `console/js/pages/radar.js` | verliert `projectToCanvas`, importiert sie | 1 |
| `tests/test_radar_geometry.mjs` | Importpfad zieht mit | 1 |
| `console/js/data.js` | `?range=`-Prüfhaken neben `?source=` | 2 |
| `tests/test_data.mjs` | Tests dazu | 2 |
| `console/js/pages/polar.js` | **neu** — reine Funktionen und Renderer der Seite | 3–9 |
| `tests/test_polar.mjs` | **neu** — alles Rechnende ohne Browser | 3–9 |
| `console/index.html` | registriert das neue Modul | 8 |
| `console/css/console.css` | Klassen der Polarseite | 8, 9 |
| `docs/specs/2026-07-27-atc-konsole-design.md` | §2.3, §6.5, §7.1, §10.3, §11 | 10 |
| `CLAUDE.md`, `README.md` | Struktur und Seitenzahl | 10 |

**Warum eine einzige Seitendatei:** `profile.js` (150 Zeilen) ist das Vorbild — reine
Funktionen oben, `registerPage` unten. Die Polarseite wird mit rund 260 Zeilen die größte,
bleibt aber unter `radar.js` (411) und teilt sich sauber in „rechnet" und „zeichnet". Ein
zweites Modul nur für die Geometrie würde eine Grenze ziehen, die keine Fremdnutzung hat.

---

### Aufgabe 1: `projectToCanvas` nach `geo.js`

Vorarbeit, und sie faßt die **abgenommene Radarseite** an. Deshalb zuerst, allein, und mit
grünem Testlauf, bevor irgendetwas darauf aufsetzt. Die Funktion wird **verschoben, nicht
kopiert** — zwei Fassungen derselben Projektionsformel sind der Anfang davon, daß zwei
Teile derselben Konsole dieselbe Eingabe verschieden deuten.

**Dateien:**
- Ändern: `console/js/geo.js` (ans Ende)
- Ändern: `console/js/pages/radar.js:1-16`
- Ändern: `tests/test_radar_geometry.mjs:3`

**Schnittstellen:**
- Liefert: `projectToCanvas(nm, brg, rangeNm, radiusPx) → {x, y}` aus `../geo.js`.
  Ergebnis **relativ zum Mittelpunkt**, Norden oben (negatives y), Osten rechts.
  Aufgabe 7 baut darauf auf.

- [ ] **Schritt 1: Die Funktion in `geo.js` anlegen**

Ans Ende von `console/js/geo.js`, direkt nach `nmToPx`:

```javascript
// Polarkoordinaten auf Bildkoordinaten, relativ zum Mittelpunkt.
// Norden ist oben (negatives y), Osten rechts.
//
// Lag bis zum 29.07.2026 in pages/radar.js. Sie ist eine reine
// Geometriefunktion ohne DOM und ohne Zustand und gehoert damit hierher --
// und vor allem: Die Polarseite braucht dieselbe Abbildung. Eine zweite
// Fassung waere der Anfang davon, dass zwei Teile derselben Konsole
// dieselbe Eingabe verschieden deuten.
export function projectToCanvas(nm, brg, rangeNm, radiusPx) {
  const r = nm / rangeNm * radiusPx;
  const a = brg * Math.PI / 180;
  return { x: r * Math.sin(a), y: -r * Math.cos(a) };
}
```

- [ ] **Schritt 2: Aus `radar.js` entfernen und importieren**

In `console/js/pages/radar.js` die Zeilen 10–16 (Kommentar und Funktion) **löschen** und
die Importzeile 1–2 ersetzen durch:

```javascript
import { haversineNm, bearingDeg, formatBearing, formatCallsign, flightLevel, isEmergency,
         projectToCanvas } from '../geo.js';
```

Die sieben Aufrufstellen in `radar.js` bleiben unverändert.

- [ ] **Schritt 3: Den Test umhängen**

In `tests/test_radar_geometry.mjs` Zeile 3:

```javascript
import { projectToCanvas } from '../console/js/geo.js';
```

- [ ] **Schritt 4: Gegenprobe — der Test muß rot werden können**

Setze in `geo.js` vorübergehend `y: +r * Math.cos(a)` (Vorzeichen weg).

Lauf: `node --test tests/test_radar_geometry.mjs 2>&1 | tail -9`
Erwartet: **`ℹ fail 1`** oder mehr, mit „Norden muss negatives y haben".
Danach das Vorzeichen zurücksetzen.

- [ ] **Schritt 5: Volle Suite**

Lauf: `node --test tests/*.mjs 2>&1 | tail -9`
Erwartet: **`ℹ tests 121`, `ℹ fail 0`** — die Zahl bleibt gleich. Diese Aufgabe verschiebt
nur; steigt oder fällt die Zahl, ist etwas anderes passiert als geplant.

- [ ] **Schritt 6: Gegenprobe, daß nichts zurückblieb**

```bash
grep -rn "projectToCanvas" console tests
```
Erwartet: **genau eine** `export function`-Zeile, und die steht in `console/js/geo.js`.

- [ ] **Schritt 7: Commit**

```bash
git add console/js/geo.js console/js/pages/radar.js tests/test_radar_geometry.mjs
git commit -m "projectToCanvas nach geo.js -- die Polarseite braucht dieselbe Abbildung"
```

---

### Aufgabe 2: Der `?range=`-Prüfhaken

`?source=` biegt heute nur `aircraft.json` um. `range.json` kommt aus `data/` und wird alle
60 s vom Daemon überschrieben — **vier der Abnahmeprüfungen wären ohne Haken gar nicht
auslösbar**, und ein Pfad, den man nie auslösen kann, ist unkalibriert (Spec §10.3).

**Dateien:**
- Ändern: `console/js/data.js:23-28` und `:71-74`
- Ändern: `tests/test_data.mjs`

**Schnittstellen:**
- Liefert: `quellUrl(param, fallback) → string`, exportiert aus `console/js/data.js`.

- [ ] **Schritt 1: Die Tests schreiben**

Ans Ende von `tests/test_data.mjs`, und den Import dort um `quellUrl` erweitern:

```javascript
test('ohne Browser faellt quellUrl auf die eigene Datei zurueck', () => {
  // location gibt es nur im Browser. Wird es auf Modulebene gelesen, ist
  // JEDER Node-Test unmoeglich, der data.js auch nur mittelbar importiert
  // -- am 27.07.2026 genau so aufgetreten, als das erste Seitenmodul
  // dazukam. Deshalb erst beim Aufruf.
  assert.equal(typeof location, 'undefined');
  assert.equal(quellUrl('range', 'data/range.json'), 'data/range.json');
});

test('ein gesetzter Parameter biegt die Quelle um', () => {
  globalThis.location = { search: '?range=pruef/luecke.json' };
  try {
    assert.equal(quellUrl('range', 'data/range.json'), 'pruef/luecke.json');
  } finally {
    delete globalThis.location;
  }
});

test('ein fremder Parameter laesst die Quelle in Ruhe', () => {
  // Die Kalibrierung: Eine Fassung, die den falschen Parameter liest oder
  // ueberhaupt jeden, wird hier rot. Ohne diesen Fall koennte ?source= die
  // Reichweitendatei umbiegen, ohne dass es auffaellt.
  globalThis.location = { search: '?source=pruef/ziele.json' };
  try {
    assert.equal(quellUrl('range', 'data/range.json'), 'data/range.json');
  } finally {
    delete globalThis.location;
  }
});
```

- [ ] **Schritt 2: Rot sehen**

Lauf: `node --test tests/test_data.mjs 2>&1 | tail -9`
Erwartet: FEHLER beim Import — `quellUrl` ist kein Export von `data.js`.

- [ ] **Schritt 3: Umsetzen**

In `console/js/data.js` die Funktion `aircraftUrl` (Zeilen 23–28) ersetzen durch:

```javascript
// Testmodus: ?source= zeigt die Zielquelle auf eine praeparierte Datei,
// ?range= die Reichweitenquelle. Ohne diese Haken lassen sich weder der
// Notfall-Squawk noch eine Sektorluecke herstellen, ohne in den
// produktiven Datenpfad zu schreiben -- und ein Pfad, den man nie
// ausloesen kann, ist unkalibriert (Spec 10.3).
//
// Erst beim Abruf ausgewertet, nicht beim Laden des Moduls: `location`
// gibt es nur im Browser. Auf Modulebene gelesen macht es jeden Node-Test
// unmoeglich, der dieses Modul auch nur mittelbar importiert -- und alle
// Seitenmodule importieren es ueber console.js.
export function quellUrl(param, fallback) {
  const override = typeof location === 'undefined'
    ? null
    : new URLSearchParams(location.search).get(param);
  return override || fallback;
}
```

Dann in `pollAircraft` (Zeile 54) `aircraftUrl()` ersetzen durch
`quellUrl('source', DATA + 'aircraft.json')` und in `pollRange` (Zeile 72)
`OWN + 'range.json'` durch `quellUrl('range', OWN + 'range.json')`.

- [ ] **Schritt 4: Grün sehen**

Lauf: `node --test tests/*.mjs 2>&1 | tail -9`
Erwartet: **`ℹ tests 124`, `ℹ fail 0`**

- [ ] **Schritt 5: Gegenprobe, daß der alte Weg noch trägt**

```bash
grep -n "aircraftUrl\|quellUrl" console/js/data.js
```
Erwartet: kein `aircraftUrl` mehr, zwei Aufrufe von `quellUrl`, ein `export function`.

- [ ] **Schritt 6: Commit**

```bash
git add console/js/data.js tests/test_data.mjs
git commit -m "?range= als zweiter Pruefhaken -- vier Abnahmepunkte werden ausloesbar"
```

---

### Aufgabe 3: Skala, Sektorbereich, Halter

Die drei kleinen reinen Funktionen, auf denen alles weitere steht.

**Dateien:**
- Anlegen: `console/js/pages/polar.js`
- Anlegen: `tests/test_polar.mjs`

**Schnittstellen:**
- Liefert: `SEKTOREN = 36`, `SKALA_STUFE = 20`,
  `skalaNm(groessterNm) → number`, `sektorBereich(s) → string`,
  `halterName(record) → string`

- [ ] **Schritt 1: Die Tests schreiben**

`tests/test_polar.mjs`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatBearing } from '../console/js/geo.js';
import { SEKTOREN, SKALA_STUFE, skalaNm, sektorBereich, halterName }
  from '../console/js/pages/polar.js';

test('36 Sektoren zu je zehn Grad', () => {
  assert.equal(SEKTOREN, 36);
  assert.equal(360 / SEKTOREN, 10);
});

test('die Skala rundet auf die naechste 20-NM-Stufe auf', () => {
  assert.equal(skalaNm(79.37), 80);
  assert.equal(skalaNm(95), 100);
  assert.equal(skalaNm(20.01), 40);
});

test('ein Wert GENAU auf der Stufe bleibt auf der Stufe', () => {
  // Die Kalibrierung. Der plausibelste Rechenfehler -- ein ceil auf einen
  // um Epsilon erhoehten Wert, oder floor mit Nachschlag -- landet hier bei
  // 100 und wird sichtbar. Ohne diesen Fall waere ein solcher Fehler nur
  // dann zu sehen, wenn zufaellig ein Rekord genau auf 80,0 stuende.
  assert.equal(skalaNm(80), 80);
  assert.equal(skalaNm(20), SKALA_STUFE);
});

test('leerer, negativer oder unsinniger Bestand ergibt die Mindeststufe', () => {
  assert.equal(skalaNm(0), 20);
  assert.equal(skalaNm(-5), 20);
  assert.equal(skalaNm(null), 20);
  assert.equal(skalaNm(NaN), 20);
});

test('der Sektorbereich ist ein Bereich, keine Peilung', () => {
  // Gegenprobe, deren Antwort vorher feststeht: formatBearing macht aus der
  // 0 die 360 ("drei-sechs-null"), und das ist fuer eine Peilung richtig.
  // Fuer die Untergrenze eines Bereichs waere es falsch. Beide Konventionen
  // stehen hier nebeneinander, damit die Verwechslung auffaellt statt sich
  // einzuschleichen.
  assert.equal(formatBearing(0), '360°');
  assert.equal(sektorBereich(0), '000–009°');
  assert.equal(sektorBereich(1), '010–019°');
  assert.equal(sektorBereich(35), '350–359°');
});

test('der Halter ist das Callsign, ersatzweise der hex, nie eine Luecke', () => {
  // 19 von 36 Rekordhaltern hatten am 29.07.2026 kein Callsign -- der hex
  // ist hier der Regelfall, nicht die Ausnahme.
  assert.equal(halterName({ callsign: 'DLH8RY', hex: '3c65d0' }), 'DLH8RY');
  assert.equal(halterName({ callsign: null, hex: '502d65' }), '502d65');
  assert.equal(halterName({ callsign: '   ', hex: '502d65' }), '502d65');
  assert.equal(halterName({ callsign: null, hex: null }), '—');
  assert.equal(halterName(null), '—');
});
```

- [ ] **Schritt 2: Rot sehen**

Lauf: `node --test tests/test_polar.mjs 2>&1 | tail -9`
Erwartet: FEHLER — `Cannot find module .../pages/polar.js`

- [ ] **Schritt 3: Umsetzen**

`console/js/pages/polar.js` anlegen:

```javascript
// Polar -- Reichweite. Zwei Spuren je Sektor: der Allzeit-Rekord aus
// SQLite und das Maximum der letzten Stunde, beide aus range.json.
//
// Was rechnet, steht hier oben und ist exportiert; was zeichnet, steht
// unten in registerPage. Die Trennung ist die Lehre aus Stufe 1: Von
// vierzehn Befunden kam kein einziger von der Testsuite, solange die
// Rechnung in der Render-Closure steckte.

export const SEKTOREN = 36;
export const SKALA_STUFE = 20;          // NM je Skalenstufe

// Der Radarmassstab traegt diese Seite nicht: Am 29.07.2026 lagen 13 von
// 36 Rekorden jenseits von 50 NM, der groesste bei 79,4 NM. Die Skala
// waechst deshalb in 20-NM-Stufen mit dem Bestand und klemmt nie -- ein
// geklemmter Rekord waere die Klemmung des Hauptgegenstands der Seite.
export function skalaNm(groessterNm) {
  const n = typeof groessterNm === 'number' && Number.isFinite(groessterNm)
    ? groessterNm : 0;
  // Die Schranke traegt den nicht-positiven Fall: ceil(0/20)*20 waere 0,
  // und ein Kreis mit Radius 0 ist keine Anzeige. Fuer 0 < n <= 20 liefert
  // die Formel ohnehin schon 20 -- die Schranke ist dort nur deutlicher.
  if (n <= SKALA_STUFE) return SKALA_STUFE;
  return Math.ceil(n / SKALA_STUFE) * SKALA_STUFE;
}

const grad3 = n => String(n).padStart(3, '0');

// "000–009°" -- ein Bereich, keine Peilung. formatBearing() waere hier
// falsch: Sie macht aus der 0 die 360, was fuer eine Peilung richtig ist
// und fuer eine Bereichsuntergrenze nicht.
export function sektorBereich(s) {
  const i = (((s % SEKTOREN) + SEKTOREN) % SEKTOREN) * (360 / SEKTOREN);
  return `${grad3(i)}–${grad3(i + 9)}°`;
}

// dump1090 fuellt das Callsign-Feld mit Leerzeichen auf; der Daemon
// schreibt in dem Fall null. Beides gilt als "keins".
export function halterName(record) {
  const cs = record && typeof record.callsign === 'string'
    ? record.callsign.trim() : '';
  if (cs) return cs;
  const hex = record && typeof record.hex === 'string' ? record.hex.trim() : '';
  return hex || '—';
}
```

- [ ] **Schritt 4: Grün sehen**

Lauf: `node --test tests/*.mjs 2>&1 | tail -9`
Erwartet: **`ℹ tests 130`, `ℹ fail 0`**

- [ ] **Schritt 5: Jeden Test einmal rot sehen**

Vier Brüche nacheinander, jeweils nur einer, jeweils zurücknehmen:

| Bruch in `polar.js` | erwartet rot |
|---|---|
| `SKALA_STUFE = 25` | „36 Sektoren…" bleibt grün, die drei Skalentests fallen |
| `Math.floor(n / SKALA_STUFE) * SKALA_STUFE + SKALA_STUFE` statt `Math.ceil(…)` | „ein Wert GENAU auf der Stufe" — und **nur** der |
| `grad3(i + 10)` statt `i + 9` | „der Sektorbereich ist ein Bereich" |
| in `halterName` `return cs \|\| '—'` | „der Halter ist das Callsign…" |

Jeder Bruch muß **genau** den benannten Test fällen. Fällt keiner, ist der Test
unkalibriert; fallen alle, prüft er nicht, was er behauptet.

- [ ] **Schritt 6: Commit**

```bash
git add console/js/pages/polar.js tests/test_polar.mjs
git commit -m "Polar: Skala in 20-NM-Stufen, Sektorbereich, Halter mit hex-Rueckfall"
```

---

### Aufgabe 4: `polarModell` — die 36 Sektoren

Hier sitzt die Falle: **`records` ist ein Array, `hour_max` ein Objekt mit
Zeichenketten-Schlüsseln.** Wer beide gleich behandelt, baut einen Fehler — beim Vorbereiten
des Stufe-3-Bootstraps lief ein `max()` über die Schlüssel statt über die Werte und warf
einen `TypeError`, der kurz für einen Datenfehler gehalten wurde. Das wird ein Test, kein
Kommentar.

**Dateien:**
- Ändern: `console/js/pages/polar.js`
- Ändern: `tests/test_polar.mjs`

**Schnittstellen:**
- Verbraucht: `skalaNm`, `sektorBereich`, `halterName` (Aufgabe 3)
- Liefert: `polarModell(range) → { sektoren, groesster, skalaNm, richtungen }`
  mit `sektoren: [{ sektor, bereich, rekordNm, stundeNm|null, halter, altFt|null, seenAt|null }]`,
  aufsteigend nach `sektor`. `richtungen` kommt erst in Aufgabe 5 dazu und ist bis dahin
  nicht Teil des Rückgabewerts.

- [ ] **Schritt 1: Die Tests schreiben**

An `tests/test_polar.mjs` anhängen, Import um `polarModell` erweitern:

```javascript
// Fixture in der Form, die der Daemon wirklich schreibt (build_range_json):
// records ist ein ARRAY, hour_max ein OBJEKT mit ZEICHENKETTEN-Schluesseln.
const rec = (sector, max_nm, extra = {}) => ({
  sector, max_nm, hex: 'aa' + String(sector).padStart(4, '0'),
  callsign: null, alt_ft: 38000, seen_at: '2026-07-27T18:21:58+02:00', ...extra,
});
// Heisst absichtlich nicht "bereich": So heisst ein FELD der Sektoren
// ("000–009°"), und zwei Bedeutungen fuer dasselbe Wort in derselben
// Datei sind eine Falle fuer den naechsten Leser.
const reihe = (von, bis, f) => {
  const out = [];
  for (let s = von; s <= bis; s++) out.push(f(s));
  return out;
};

test('hour_max wird als Objekt mit Zeichenketten-Schluesseln gelesen', () => {
  // Genau der Lesefehler vom 28.07.2026: max() lief ueber die SCHLUESSEL
  // statt ueber die Werte. Ein Modell, das hour_max als Array behandelt,
  // findet hier nichts und liefert null -- und faellt damit auf.
  const m = polarModell({ records: [rec(7, 40)], hour_max: { '7': 12.3 } });
  assert.equal(m.sektoren.length, 1);
  assert.equal(m.sektoren[0].stundeNm, 12.3);
});

test('ein hour_max in Array-Form wird abgewiesen', () => {
  // Der Test, der die Objektform WIRKLICH bewacht. Der Test darueber tut
  // es naemlich nicht: JS wandelt Objektschluessel beim Zugriff selbst in
  // Zeichenketten um, hm[7] und hm["7"] sind dasselbe. Das String(s) im
  // Code dokumentiert die Form, es traegt sie nicht -- erst der
  // Array.isArray-Schutz tut das, und der ist ohne diesen Fall ungeprueft.
  //
  // Ein Array an dieser Stelle waere ein Daemon, der seine Ausgabe
  // umgestellt hat. Dann ist die Stunde unbekannt, und unbekannt ist null
  // -- nicht der Wert, der zufaellig an Index 7 steht.
  const m = polarModell({ records: [rec(7, 40)], hour_max: [0, 0, 0, 0, 0, 0, 0, 99] });
  assert.equal(m.sektoren[0].stundeNm, null);
});

test('ein Sektor ohne Stundenwert ergibt null, niemals 0', () => {
  const m = polarModell({ records: [rec(7, 40)], hour_max: {} });
  assert.equal(m.sektoren[0].stundeNm, null);
  assert.notEqual(m.sektoren[0].stundeNm, 0);
});

test('ein Stundenwert ueber dem Rekord bleibt stehen und wird nicht geklemmt', () => {
  // Kommt vor, wenn der Rekordbestand zurueckgesetzt wurde. Ehrlich
  // anzeigen ist richtig; klemmen waere eine stille Behauptung.
  const m = polarModell({ records: [rec(3, 20)], hour_max: { '3': 55 } });
  assert.equal(m.sektoren[0].stundeNm, 55);
  assert.equal(m.sektoren[0].rekordNm, 20);
});

test('die Skala folgt dem groessten Wert BEIDER Spuren', () => {
  // Sonst ragte eine Stundenlinie ueber dem Rekord aus dem Bild.
  const m = polarModell({ records: [rec(3, 20)], hour_max: { '3': 95 } });
  assert.equal(m.skalaNm, 100);
});

test('unbrauchbare Eintraege werden verworfen, nicht gerettet', () => {
  const m = polarModell({
    records: [rec(0, 30), rec(36, 99), rec(-1, 99), rec(5, null), { sector: 9 }],
    hour_max: {},
  });
  assert.deepEqual(m.sektoren.map(s => s.sektor), [0]);
});

test('leerer oder fehlender Bestand ergibt ein leeres Modell mit Mindestskala', () => {
  for (const eingabe of [null, {}, { records: [] }, { records: 'kaputt' }]) {
    const m = polarModell(eingabe);
    assert.deepEqual(m.sektoren, []);
    assert.equal(m.groesster, null);
    assert.equal(m.skalaNm, 20);
  }
});
```

- [ ] **Schritt 2: Rot sehen**

Lauf: `node --test tests/test_polar.mjs 2>&1 | tail -9`
Erwartet: FEHLER — `polarModell is not a function`

- [ ] **Schritt 3: Umsetzen**

An `console/js/pages/polar.js` anhängen:

```javascript
// range.json, wie der Daemon es schreibt (build_range_json):
//   written_at : Zahl
//   sectors    : 36
//   records    : ARRAY  [{sector, max_nm, hex, callsign, alt_ft, seen_at}]
//   hour_max   : OBJEKT {"0": 61.03, "1": 70.24, ...}  -- Schluessel sind
//                ZEICHENKETTEN, und es fehlen die Sektoren ohne Verkehr
//
// Die beiden Nutzlasten haben verschiedene Formen. Wer sie gleich
// behandelt, baut einen Fehler: Am 28.07.2026 lief ein max() ueber die
// Schluessel statt ueber die Werte und warf einen TypeError, der kurz fuer
// einen Datenfehler gehalten wurde.
export function polarModell(range) {
  const roh = range && Array.isArray(range.records) ? range.records : [];
  const hm = range && range.hour_max && typeof range.hour_max === 'object'
    && !Array.isArray(range.hour_max) ? range.hour_max : {};

  const sektoren = [];
  for (const r of roh) {
    const s = r && r.sector;
    if (!Number.isInteger(s) || s < 0 || s >= SEKTOREN) continue;
    if (typeof r.max_nm !== 'number' || !Number.isFinite(r.max_nm)) continue;
    const h = hm[String(s)];
    sektoren.push({
      sektor: s,
      bereich: sektorBereich(s),
      rekordNm: r.max_nm,
      // Fehlt der Sektor in hour_max, floss in der letzten Stunde dort
      // nichts. Das ist null und keine 0: Eine 0 hiesse "gemessen, und
      // zwar null Seemeilen", und die Linie fiele ins Zentrum.
      stundeNm: typeof h === 'number' && Number.isFinite(h) ? h : null,
      halter: halterName(r),
      altFt: typeof r.alt_ft === 'number' && Number.isFinite(r.alt_ft) ? r.alt_ft : null,
      seenAt: typeof r.seen_at === 'string' ? r.seen_at : null,
    });
  }
  sektoren.sort((a, b) => a.sektor - b.sektor);

  const groesster = sektoren.length
    ? sektoren.reduce((a, b) => (b.rekordNm > a.rekordNm ? b : a))
    : null;

  // Die Skala folgt der SPITZE beider Spuren, nicht nur den Rekorden:
  // Nach einem zuruckgesetzten Rekordbestand kann ein Stundenwert daruber
  // liegen, und er soll aus der Flaeche ragen duerfen -- aber nicht aus
  // dem Bild.
  const spitze = sektoren.reduce(
    (m, s) => Math.max(m, s.rekordNm, s.stundeNm === null ? 0 : s.stundeNm), 0);

  return { sektoren, groesster, skalaNm: skalaNm(spitze) };
}
```

- [ ] **Schritt 4: Grün sehen**

Lauf: `node --test tests/*.mjs 2>&1 | tail -9`
Erwartet: **`ℹ tests 137`, `ℹ fail 0`**

- [ ] **Schritt 5: Rot sehen — der teuerste Bruch zuerst**

| Bruch | erwartet rot |
|---|---|
| `const h = hm[Object.keys(hm).find(k => k === s)];` | **drei** Tests, darunter „hour_max wird als Objekt…" — `Object.keys` liefert Zeichenketten, der Vergleich mit einer Zahl trifft nie, also fällt **jeder** Stundenwert weg. Ein grober Bruch, aber ein echter |
| `const hm = range && range.hour_max ? range.hour_max : {};` (ohne `Array.isArray`-Schutz) | „ein hour_max in Array-Form wird abgewiesen" |
| `stundeNm: … ? h : 0` | „ein Sektor ohne Stundenwert ergibt null" |
| `skalaNm(sektoren.reduce((m,s) => Math.max(m, s.rekordNm), 0))` | „die Skala folgt … BEIDER Spuren" |

Jeweils einer, jeweils zurücknehmen.

- [ ] **Schritt 6: Commit**

```bash
git add console/js/pages/polar.js tests/test_polar.mjs
git commit -m "Polar: 36 Sektoren aus range.json -- hour_max ist ein Objekt, kein Array"
```

---

### Aufgabe 5: Die zwölf Richtungen

**Warum zwölf und nicht acht:** 45° teilt 36 Zehn-Grad-Sektoren nicht — es kämen 4,5
heraus, in der Praxis abwechselnd vier und fünf Sektoren je Gruppe. Für eine
**Maximum**-Statistik ist das ein systematischer Fehler: Eine Gruppe aus fünf Sektoren hat
mehr Gelegenheiten, hoch zu liegen. Dreiergruppen ab 0° teilen exakt; ihre Grenzen liegen
dann auf 0/30/60/90…, weshalb N, O, S und W zu Grenzen statt zu Namen werden.

**Dateien:**
- Ändern: `console/js/pages/polar.js`
- Ändern: `tests/test_polar.mjs`

**Schnittstellen:**
- Verbraucht: `polarModell` (Aufgabe 4)
- Liefert: `RICHTUNGEN` (12 Namen), `SEKTOREN_JE_RICHTUNG = 3`,
  `richtungen(sektoren) → [{ name, bereich, sektoren, rekordNm|null, stundeNm|null, halter, altFt|null }]`.
  `polarModell` gibt das Ergebnis ab jetzt als Feld `richtungen` mit zurück.

- [ ] **Schritt 1: Die Tests schreiben**

An `tests/test_polar.mjs` anhängen, Import um `RICHTUNGEN`, `SEKTOREN_JE_RICHTUNG`,
`richtungen` erweitern:

```javascript
test('zwoelf Richtungen, jede GENAU drei Sektoren, zusammen 36', () => {
  // Der Test, der die Entscheidung bewacht. Acht 45-Grad-Richtungen
  // ergaeben abwechselnd vier und fuenf Sektoren -- bei einer
  // Maximum-Statistik ein systematischer Bias, und die Balken waeren
  // untereinander nicht vergleichbar. Eine Gruppierung, die 4,5 ergibt,
  // wird hier rot.
  assert.equal(RICHTUNGEN.length, 12);
  assert.equal(SEKTOREN_JE_RICHTUNG, 3);
  assert.equal(RICHTUNGEN.length * SEKTOREN_JE_RICHTUNG, SEKTOREN);

  const m = polarModell({
    records: reihe(0, 35, s => rec(s, 10 + s)), hour_max: {},
  });
  const gezaehlt = m.richtungen.flatMap(r => r.sektoren);
  assert.equal(gezaehlt.length, 36);
  assert.deepEqual([...new Set(gezaehlt)].sort((a, b) => a - b), gezaehlt.slice().sort((a, b) => a - b));
  for (const r of m.richtungen) assert.equal(r.sektoren.length, 3);
});

test('die Kardinalrichtungen sind Grenzen, nicht Namen', () => {
  assert.deepEqual([...RICHTUNGEN],
    ['NNO', 'NO', 'ONO', 'OSO', 'SO', 'SSO', 'SSW', 'SW', 'WSW', 'WNW', 'NW', 'NNW']);
  const m = polarModell({ records: reihe(0, 35, s => rec(s, 10)), hour_max: {} });
  assert.equal(m.richtungen[0].bereich, '000–029°');
  assert.equal(m.richtungen[0].sektoren.join(','), '0,1,2');
  assert.equal(m.richtungen[11].bereich, '330–359°');
  assert.equal(m.richtungen[11].sektoren.join(','), '33,34,35');
});

test('eine Richtung nimmt das Maximum ihrer Sektoren, nicht die Summe', () => {
  const m = polarModell({
    records: [rec(0, 10), rec(1, 40), rec(2, 25)],
    hour_max: { '0': 5, '1': 30, '2': 9 },
  });
  assert.equal(m.richtungen[0].rekordNm, 40);
  assert.equal(m.richtungen[0].stundeNm, 30);
});

test('eine Richtung ohne jeden Stundenwert ergibt null, niemals 0', () => {
  // Nachts der Regelfall fuer den Westen. Dieselbe Regel wie bei der
  // aufgerissenen Linie im Kreis -- zwei Stellen, eine Regel.
  const m = polarModell({ records: [rec(0, 10), rec(1, 40), rec(2, 25)], hour_max: {} });
  assert.equal(m.richtungen[0].stundeNm, null);
  assert.equal(m.richtungen[0].rekordNm, 40);
});

test('Halter und Flugflaeche einer Richtung gehoeren ihrem groessten Sektor', () => {
  const m = polarModell({
    records: [rec(0, 10, { callsign: 'KLEIN1' }),
              rec(1, 40, { callsign: 'GROSS1', alt_ft: 41000 }),
              rec(2, 25, { callsign: 'MITTE1' })],
    hour_max: {},
  });
  assert.equal(m.richtungen[0].halter, 'GROSS1');
  assert.equal(m.richtungen[0].altFt, 41000);
});
```

- [ ] **Schritt 2: Rot sehen**

Lauf: `node --test tests/test_polar.mjs 2>&1 | tail -9`
Erwartet: FEHLER — `RICHTUNGEN` ist kein Export.

- [ ] **Schritt 3: Umsetzen**

An `console/js/pages/polar.js` anhängen:

```javascript
// Zwoelf Kaesten zu 30 Grad, je GENAU drei Sektoren.
//
// 45 Grad teilt 36 Zehn-Grad-Sektoren nicht -- acht Richtungen ergaeben
// abwechselnd vier und fuenf Sektoren, und eine Gruppe aus fuenf Sektoren
// hat mehr Gelegenheiten, ein hohes Maximum zu tragen. Die Balken waeren
// untereinander nicht vergleichbar.
//
// Dreiergruppen ab 0 Grad teilen exakt. Ihre Grenzen liegen dann aber auf
// 0/30/60/90..., und genau dort liegen N, O, S und W: Die vier
// Kardinalrichtungen werden zu Grenzen statt zu Namen. Eine auf Nord
// zentrierte Gruppe muesste von 345 bis 015 Grad laufen, und 345 ist keine
// Sektorgrenze -- das folgt aus dem 10-Grad-Raster des Daemons und ist
// nicht waehlbar.
//
// Die Namen sind die zwoelf verbleibenden Striche des 16-Strich-Kompasses.
// Vier treffen die Kastenmitte punktgenau (NO 45, SO 135, SW 225, NW 315),
// die anderen acht liegen 7,5 Grad daneben. Deshalb traegt die Anzeige
// IMMER auch den Gradbereich: Der Name ist die Merkhilfe, der Bereich ist
// die Tatsache.
export const RICHTUNGEN = Object.freeze([
  'NNO', 'NO', 'ONO', 'OSO', 'SO', 'SSO',
  'SSW', 'SW', 'WSW', 'WNW', 'NW', 'NNW',
]);
export const SEKTOREN_JE_RICHTUNG = SEKTOREN / RICHTUNGEN.length;   // 3

export function richtungen(sektoren) {
  const nach = new Map((sektoren || []).map(s => [s.sektor, s]));
  return RICHTUNGEN.map((name, i) => {
    const gruppe = [];
    for (let k = 0; k < SEKTOREN_JE_RICHTUNG; k++) {
      const s = nach.get(i * SEKTOREN_JE_RICHTUNG + k);
      if (s) gruppe.push(s);
    }
    const grad = i * (360 / RICHTUNGEN.length);
    const bester = gruppe.length
      ? gruppe.reduce((a, b) => (b.rekordNm > a.rekordNm ? b : a)) : null;
    const stunden = gruppe.map(s => s.stundeNm).filter(v => v !== null);
    return {
      name,
      bereich: `${grad3(grad)}–${grad3(grad + 29)}°`,
      sektoren: gruppe.map(s => s.sektor),
      rekordNm: bester ? bester.rekordNm : null,
      // Keine Stunde in allen drei Sektoren heisst null, nicht 0.
      stundeNm: stunden.length ? Math.max(...stunden) : null,
      halter: bester ? bester.halter : '—',
      altFt: bester ? bester.altFt : null,
    };
  });
}
```

Und in `polarModell` den Rückgabewert erweitern:

```javascript
  return { sektoren, groesster, skalaNm: skalaNm(spitze), richtungen: richtungen(sektoren) };
```

- [ ] **Schritt 4: Grün sehen**

Lauf: `node --test tests/*.mjs 2>&1 | tail -9`
Erwartet: **`ℹ tests 142`, `ℹ fail 0`**

- [ ] **Schritt 5: Rot sehen**

| Bruch | erwartet rot |
|---|---|
| `SEKTOREN_JE_RICHTUNG = 4` (fest) | „zwoelf Richtungen, jede GENAU drei Sektoren" |
| `stundeNm: Math.max(0, ...stunden)` | „eine Richtung ohne jeden Stundenwert…" |
| `rekordNm: gruppe.reduce((m,s)=>m+s.rekordNm, 0)` | „das Maximum …, nicht die Summe" |

- [ ] **Schritt 6: Gegenprobe an echten Zahlen**

```bash
node --input-type=module -e "
import { polarModell } from './console/js/pages/polar.js';
import { readFileSync } from 'node:fs';
const m = polarModell(JSON.parse(readFileSync(process.argv[1], 'utf8')));
for (const r of m.richtungen)
  console.log(r.name.padEnd(4), r.bereich, String(r.rekordNm?.toFixed(1)).padStart(6),
              String(r.stundeNm?.toFixed(1)).padStart(6), r.halter);
console.log('Skala', m.skalaNm, 'NM · groesster', m.groesster.rekordNm.toFixed(1));
" -- /pfad/zu/range.json
```

Die Datei holt der **Controller** in der Hauptsitzung mit
`curl -s http://adsapp01/atc/data/range.json`. Erwartet: zwölf Zeilen, NNO am größten,
WSW am kleinsten, Skala 80 NM. **Ein Modell, das gegen echte Daten nicht läuft, ist nicht
fertig** — das Fixture wiederholt nur die eigene Annahme.

- [ ] **Schritt 7: Commit**

```bash
git add console/js/pages/polar.js tests/test_polar.mjs
git commit -m "Polar: zwoelf Richtungen a 30 Grad -- 45 Grad teilt 36 Sektoren nicht"
```

---

### Aufgabe 6: `zuletztGefallen`

Die eine Zeile, die sich im Minutentakt ändern kann. Acht der 36 Rekorde fielen am
29.07. zwischen 01:37 und 12:04 — sie hat echten Inhalt.

**Dateien:**
- Ändern: `console/js/pages/polar.js`
- Ändern: `tests/test_polar.mjs`

**Schnittstellen:**
- Liefert: `zuletztGefallen(records, nowMs) → { sektor, bereich, nm, halter, alterMin } | null`

- [ ] **Schritt 1: Die Tests schreiben**

```javascript
const NOW = Date.parse('2026-07-29T12:36:58+02:00');

test('der juengste Rekord gewinnt, nicht der letzte im Array', () => {
  const r = zuletztGefallen([
    rec(1, 79, { seen_at: '2026-07-27T18:21:58+02:00', callsign: 'ALT1' }),
    rec(23, 22, { seen_at: '2026-07-29T12:04:45+02:00', callsign: 'NEU1' }),
    rec(8, 39, { seen_at: '2026-07-29T11:31:37+02:00', callsign: 'MITTE' }),
  ], NOW);
  assert.equal(r.halter, 'NEU1');
  assert.equal(r.sektor, 23);
  assert.equal(r.bereich, '230–239°');
});

test('das Alter kommt aus der uebergebenen Uhr, nicht aus Date.now', () => {
  // Sonst waere die Funktion nicht testbar -- dieselbe Regel wie bei
  // letzteZielzeit in data.js.
  const r = zuletztGefallen(
    [rec(23, 22, { seen_at: '2026-07-29T12:04:45+02:00' })], NOW);
  assert.equal(r.alterMin, 32);
});

test('leere Liste ergibt null, nicht den Epochen-Nullpunkt', () => {
  assert.equal(zuletztGefallen([], NOW), null);
  assert.equal(zuletztGefallen(null, NOW), null);
});

test('ein unlesbarer Zeitstempel wird uebersprungen, nicht als aeltester gewertet', () => {
  const kaputt = rec(5, 10, { seen_at: 'gestern abend', callsign: 'KAPUTT' });
  const heil = rec(6, 11, { seen_at: '2026-07-28T09:00:00+02:00', callsign: 'HEIL1' });

  assert.equal(zuletztGefallen([kaputt, heil], NOW).halter, 'HEIL1');

  // BEIDE Reihenfolgen, und die zweite ist die, auf die es ankommt: Faellt
  // der isFinite-Schutz weg, bleibt die erste Reihenfolge trotzdem heil,
  // weil NaN <= x in JS immer false ist und der gueltige Rekord danach
  // ohnehin gewinnt. Erst wenn der kaputte Eintrag ZULETZT kommt,
  // ueberschreibt er den heilen -- und nur dann kann dieser Test den
  // fehlenden Schutz ueberhaupt sehen.
  assert.equal(zuletztGefallen([heil, kaputt], NOW).halter, 'HEIL1');
});
```

- [ ] **Schritt 2: Rot sehen**

Lauf: `node --test tests/test_polar.mjs 2>&1 | tail -9`
Erwartet: FEHLER — `zuletztGefallen is not a function`

- [ ] **Schritt 3: Umsetzen**

```javascript
// Liest keine Uhr -- der Zeitpunkt kommt herein. Sonst waere die Funktion
// nicht testbar; dieselbe Regel wie bei letzteZielzeit in data.js.
export function zuletztGefallen(records, nowMs) {
  const liste = Array.isArray(records) ? records : [];
  let bester = null, besteMs = -Infinity;
  for (const r of liste) {
    const ms = Date.parse(r && r.seen_at);
    if (!Number.isFinite(ms) || ms <= besteMs) continue;
    besteMs = ms; bester = r;
  }
  if (!bester) return null;
  return {
    sektor: bester.sector,
    bereich: sektorBereich(bester.sector),
    nm: bester.max_nm,
    halter: halterName(bester),
    alterMin: Math.max(0, Math.round((nowMs - besteMs) / 60000)),
  };
}
```

- [ ] **Schritt 4: Grün sehen**

Lauf: `node --test tests/*.mjs 2>&1 | tail -9`
Erwartet: **`ℹ tests 146`, `ℹ fail 0`**

- [ ] **Schritt 5: Rot sehen**

| Bruch | erwartet rot |
|---|---|
| `alterMin: Math.round((Date.now() - besteMs) / 60000)` | „das Alter kommt aus der uebergebenen Uhr" |
| `if (!Number.isFinite(ms)) ms = 0;` statt `continue` | „ein unlesbarer Zeitstempel wird uebersprungen" |

- [ ] **Schritt 6: Commit**

```bash
git add console/js/pages/polar.js tests/test_polar.mjs
git commit -m "Polar: zuletzt gefallener Rekord, mit uebergebener Uhr"
```

---

### Aufgabe 7: Die Geometrie der Windrose

**Dateien:**
- Ändern: `console/js/pages/polar.js`
- Ändern: `tests/test_polar.mjs`

**Schnittstellen:**
- Verbraucht: `projectToCanvas` aus `../geo.js` (Aufgabe 1)
- Liefert: `BILD` (`{groesse: 620, rand: 26}`), `R_PX`, `MITTE`,
  `werteArray(sektoren, feld) → (number|null)[36]`,
  `keilPfad(nm, sektor, skala, radiusPx?) → string`,
  `treppenPfade(werte, skala, radiusPx?) → string[]`

- [ ] **Schritt 1: Die Tests schreiben**

```javascript
const voll = Array.from({ length: 36 }, () => 40);

test('werteArray hat immer 36 Plaetze und fuellt Luecken mit null', () => {
  const m = polarModell({ records: [rec(0, 10), rec(5, 20)], hour_max: { '5': 7 } });
  const w = werteArray(m.sektoren, 'stundeNm');
  assert.equal(w.length, 36);
  assert.equal(w[5], 7);
  assert.equal(w[0], null);
  assert.equal(w[17], null);
});

test('ein vollstaendiger Kranz ergibt genau EINEN geschlossenen Pfad', () => {
  const p = treppenPfade(voll, 80);
  assert.equal(p.length, 1);
  assert.ok(p[0].endsWith(' Z'), `Pfad muss geschlossen sein: ${p[0].slice(-20)}`);
});

test('eine Luecke reisst den Zug auf -- offene Pfade, kein Wert 0', () => {
  // Die tragende Regel dieser Seite. Ein Polygon, das im Zentrum
  // durchhaengt, behauptet "0 NM gemessen".
  //
  // EINE Luecke ergibt EINEN Lauf, keine zwei: Der Zug laeuft ueber Nord
  // hinweg weiter und endet erst wieder am Loch. Er ist dann aber offen.
  const w = voll.slice();
  w[10] = null;
  const p = treppenPfade(w, 80);
  assert.equal(p.length, 1);
  assert.ok(!p[0].endsWith(' Z'), 'ein aufgerissener Zug darf nicht geschlossen sein');

  // Erst ZWEI Luecken ergeben zwei Laeufe.
  const w2 = voll.slice();
  w2[10] = null; w2[20] = null;
  const p2 = treppenPfade(w2, 80);
  assert.equal(p2.length, 2);
  assert.ok(p2.every(d => !d.endsWith(' Z')));
});

test('ohne jeden Wert entsteht kein Pfad, kein Punkt im Zentrum', () => {
  assert.deepEqual(treppenPfade(Array.from({ length: 36 }, () => null), 80), []);
});

test('ein Wert auf der Skalenstufe liegt auf dem Aussenring', () => {
  // Die Gegenprobe, deren Antwort vorher feststeht: Sektor 0 beginnt bei
  // Peilung 000, also senkrecht ueber der Mitte. Bei Skala 80 und Wert 80
  // muss die erste Ecke genau MITTE - R_PX sein.
  const w = Array.from({ length: 36 }, () => null);
  w[0] = 80;
  const d = treppenPfade(w, 80)[0];
  assert.ok(d.startsWith(`M${MITTE.toFixed(1)},${(MITTE - R_PX).toFixed(1)}`),
    `Anfang war ${d.slice(0, 24)}`);
});

test('der Keil beginnt in der Mitte und schliesst sich', () => {
  const d = keilPfad(40, 0, 80);
  assert.ok(d.startsWith(`M${MITTE.toFixed(1)},${MITTE.toFixed(1)}`));
  assert.ok(d.endsWith(' Z'));
  // Halbe Skala = halber Radius.
  assert.ok(d.includes((MITTE - R_PX / 2).toFixed(1)));
});
```

- [ ] **Schritt 2: Rot sehen**

Lauf: `node --test tests/test_polar.mjs 2>&1 | tail -9`
Erwartet: FEHLER — `werteArray is not a function`

- [ ] **Schritt 3: Umsetzen**

Der Import oben in `polar.js` wird zu:

```javascript
import { projectToCanvas, flightLevel } from '../geo.js';
import { registerPage } from '../console.js';
import { leerUntertitel } from './gemeinsam.js';
```

(`registerPage`, `flightLevel` und `leerUntertitel` braucht erst Aufgabe 8 bzw. 9; der
Import darf jetzt schon stehen.)

Dann anhängen:

```javascript
// 620 ist die Buehnenhoehe: 720 minus 56 Kopfzeile minus 44 Punktreihe.
// Der Rand haelt die Beschriftung des Aussenrings im Bild.
export const BILD = Object.freeze({ groesse: 620, rand: 26 });
export const R_PX = (BILD.groesse - 2 * BILD.rand) / 2;   // 284
export const MITTE = BILD.groesse / 2;                    // 310

const GRAD_JE_SEKTOR = 360 / SEKTOREN;                    // 10
const fix = n => n.toFixed(1);
const radiusPxVon = (nm, skala, radiusPx) => nm / skala * radiusPx;

// Punkt auf dem Bild. projectToCanvas rechnet relativ zum Mittelpunkt
// (geo.js) -- hier kommt die Verschiebung dazu.
function punkt(nm, grad, skala, radiusPx) {
  const p = projectToCanvas(nm, grad, skala, radiusPx);
  return { x: MITTE + p.x, y: MITTE + p.y };
}

// Die 36 Plaetze, mit null wo kein Sektor vorliegt. Der Index IST die
// Sektornummer -- ein dicht gepacktes Array waere gegen die Peilung
// verschoben, sobald ein Sektor fehlt.
export function werteArray(sektoren, feld) {
  const out = Array.from({ length: SEKTOREN }, () => null);
  for (const s of sektoren || []) {
    const v = s[feld];
    if (typeof v === 'number' && Number.isFinite(v)) out[s.sektor] = v;
  }
  return out;
}

// Ein Keil ueber die vollen zehn Grad eines Sektors, von der Mitte aus.
// Die Flaeche wird aus 36 solchen Keilen gebaut und nicht aus einem
// gefuellten Ringpolygon: Dann braucht ein fehlender Sektor keine
// Sonderbehandlung -- er hat schlicht keinen Keil.
export function keilPfad(nm, sektor, skala, radiusPx = R_PX) {
  const r = radiusPxVon(nm, skala, radiusPx);
  const a = punkt(nm, sektor * GRAD_JE_SEKTOR, skala, radiusPx);
  const b = punkt(nm, (sektor + 1) * GRAD_JE_SEKTOR, skala, radiusPx);
  return `M${fix(MITTE)},${fix(MITTE)} L${fix(a.x)},${fix(a.y)} `
       + `A${fix(r)},${fix(r)} 0 0 1 ${fix(b.x)},${fix(b.y)} Z`;
}

function laufPfad(werte, von, laenge, skala, radiusPx, geschlossen) {
  const teile = [];
  for (let k = 0; k < laenge; k++) {
    const s = (von + k) % SEKTOREN;
    const nm = werte[s];
    const r = radiusPxVon(nm, skala, radiusPx);
    const a = punkt(nm, s * GRAD_JE_SEKTOR, skala, radiusPx);
    const b = punkt(nm, (s + 1) * GRAD_JE_SEKTOR, skala, radiusPx);
    teile.push(`${k === 0 ? 'M' : 'L'}${fix(a.x)},${fix(a.y)}`);
    // Der Bogen, nicht die Sehne: Ein Sektormaximum gilt fuer seine vollen
    // zehn Grad. Bei R_PX = 284 betruege der Sehnenfehler rund 1 px, und
    // die Zusage "konstanter Radius je Sektor" waere nur fast wahr.
    // sweep = 1, weil wachsende Peilung auf dem Bild im Uhrzeigersinn
    // laeuft (y zeigt nach unten).
    teile.push(`A${fix(r)},${fix(r)} 0 0 1 ${fix(b.x)},${fix(b.y)}`);
  }
  return teile.join(' ') + (geschlossen ? ' Z' : '');
}

// Der Treppenzug ueber die belegten Sektoren: zwei Ecken je Sektor und ein
// radialer Sprung dazwischen. KEINE Linie durch die Sektormitten -- die
// behauptete eine stetige Funktion der Peilung, die die Daten nicht
// hergeben.
//
// Luecken reissen den Zug auf: Sie ergeben MEHRERE Pfade, nie einen Wert
// 0. Nachts ist das der Regelfall.
export function treppenPfade(werte, skala, radiusPx = R_PX) {
  const da = werte.map(v => typeof v === 'number' && Number.isFinite(v));
  if (da.every(Boolean)) {
    return [laufPfad(werte, 0, SEKTOREN, skala, radiusPx, true)];
  }
  const pfade = [];
  // Am ersten Loch beginnen, sonst zerschneidet der Index 0 einen Lauf,
  // der ueber Nord hinweggeht.
  const start = da.indexOf(false);
  let i = 0;
  while (i < SEKTOREN) {
    if (!da[(start + i) % SEKTOREN]) { i++; continue; }
    let laenge = 0;
    while (i + laenge < SEKTOREN && da[(start + i + laenge) % SEKTOREN]) laenge++;
    pfade.push(laufPfad(werte, start + i, laenge, skala, radiusPx, false));
    i += laenge;
  }
  return pfade;
}
```

- [ ] **Schritt 4: Grün sehen**

Lauf: `node --test tests/*.mjs 2>&1 | tail -9`
Erwartet: **`ℹ tests 152`, `ℹ fail 0`**

- [ ] **Schritt 5: Rot sehen**

| Bruch | erwartet rot |
|---|---|
| in `treppenPfade` das `da.every`-Kürzel entfernen und immer Läufe bauen | „ein vollstaendiger Kranz ergibt genau EINEN geschlossenen Pfad" |
| `if (!da[…]) { werte[…] = 0; }` statt `continue` | „eine Luecke reisst den Zug auf" |
| in `laufPfad` `punkt(nm, s * GRAD_JE_SEKTOR + 5, …)` (Sektormitte) | „ein Wert auf der Skalenstufe liegt auf dem Aussenring" |

- [ ] **Schritt 6: Commit**

```bash
git add console/js/pages/polar.js tests/test_polar.mjs
git commit -m "Polar: Windrosen-Geometrie -- Treppe mit echten Boegen, Luecken reissen auf"
```

---

### Aufgabe 8: Der Kreis am Bild — Renderer, Registrierung, CSS

Ab hier wird gezeichnet. **Das Urteil fällt am Panel**, nicht in einem Test — deshalb endet
diese Aufgabe mit einem lokalen Blick im Browser und nicht mit einer Behauptung.

**Dateien:**
- Ändern: `console/js/pages/polar.js` (Ende: `registerPage`)
- Ändern: `console/index.html:25` (Modulimport)
- Ändern: `console/css/console.css` (nach dem Höhenprofil-Block)

**Schnittstellen:**
- Verbraucht: alles aus den Aufgaben 3–7
- Liefert: registrierte Seite `polar`, Titel `Reichweite`, `ageSource: 'range'`

- [ ] **Schritt 1: Renderer anhängen**

An `console/js/pages/polar.js`:

```javascript
registerPage({
  id: 'polar',
  title: 'Reichweite',
  // Die Kopfzeile altert mit range.json. Steht der Daemon, altert die
  // Seite sichtbar, statt Zahlen von vorgestern als frisch auszugeben.
  ageSource: 'range',
  mount(el) {
    el.innerHTML = `
      <div class="polar-bild">
        <svg class="polar-svg" viewBox="0 0 ${BILD.groesse} ${BILD.groesse}"
             aria-hidden="true"></svg>
      </div>
      <div class="polar-spalte value"></div>`;
  },
  render(el, cfg, state) {
    const svg = el.querySelector('.polar-svg');
    const spalte = el.querySelector('.polar-spalte');
    const m = polarModell(state.range);

    if (!m.sektoren.length) {
      svg.innerHTML = '';
      spalte.innerHTML = `<div class="tile ctr" style="flex:1">
        <div class="empty">KEINE REICHWEITENDATEN
          <div class="empty-sub">${leerUntertitel(state)}</div></div></div>`;
      return;
    }

    const teile = [];
    // Ringe: die des Radars, soweit sie in die Skala passen, dazu der
    // beschriftete Aussenring. Wer auf dem Radar den 50-NM-Ring sieht,
    // findet ihn hier wieder -- und ein umgestellter Radarmassstab
    // verschiebt beide Seiten gemeinsam.
    const ringe = cfg.radar.rings_nm.filter(r => r < m.skalaNm).concat([m.skalaNm]);
    for (const ring of ringe) {
      const rp = ring / m.skalaNm * R_PX;
      teile.push(`<circle class="pol-ring" cx="${MITTE}" cy="${MITTE}" r="${rp.toFixed(1)}"/>`);
      teile.push(`<text class="pol-ring-t" x="${MITTE + 5}" y="${(MITTE - rp + 15).toFixed(1)}">${ring} NM</text>`);
    }
    for (const grad of [0, 90, 180, 270]) {
      const p = punktAussen(grad, m.skalaNm);
      teile.push(`<text class="pol-peil" x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}">${String(grad).padStart(3, '0')}</text>`);
    }

    // Rekord: Flaeche aus 36 Keilen, dazu die Kante als Treppenzug.
    for (const s of m.sektoren) {
      teile.push(`<path class="pol-flaeche" d="${keilPfad(s.rekordNm, s.sektor, m.skalaNm)}"/>`);
    }
    for (const d of treppenPfade(werteArray(m.sektoren, 'rekordNm'), m.skalaNm)) {
      teile.push(`<path class="pol-kante" d="${d}"/>`);
    }
    // Stunde: nur die Linie, aufgerissen wo nichts flog.
    for (const d of treppenPfade(werteArray(m.sektoren, 'stundeNm'), m.skalaNm)) {
      teile.push(`<path class="pol-stunde" d="${d}"/>`);
    }
    svg.innerHTML = teile.join('');

    spalte.innerHTML = '';        // Aufgabe 9
  },
});
```

Und die Hilfsfunktion für die Peilungsmarken, oberhalb von `registerPage`:

```javascript
// Die Peilungsmarke sitzt im Rand ausserhalb des Aussenrings.
function punktAussen(grad, skala) {
  const p = punkt(skala, grad, skala, R_PX + 14);
  return { x: p.x - 12, y: p.y + 5 };
}
```

- [ ] **Schritt 2: Registrieren**

In `console/index.html` nach `import './js/pages/profile.js';` einfügen:

```html
    import './js/pages/polar.js';
```

- [ ] **Schritt 3: CSS**

An `console/css/console.css` nach dem Höhenprofil-Block:

```css
/* Polar: Windrose links, Datenspalte rechts */
.polar-bild { flex: 0 0 620px; height: 620px; align-self: center; }
.polar-svg { width: 620px; height: 620px; display: block; }
.polar-svg .pol-ring { fill: none; stroke: #14361f; stroke-width: 1; }
.polar-svg .pol-ring-t { fill: #2f6b45; font-size: 13px;
                         font-family: "B612 Mono", ui-monospace, monospace; }
.polar-svg .pol-peil { fill: #3a8f57; font-size: 15px; letter-spacing: .06em;
                       font-family: "B612 Mono", ui-monospace, monospace; }
.polar-svg .pol-flaeche { fill: #14512b; stroke: none; }
.polar-svg .pol-kante { fill: none; stroke: #2f8f52; stroke-width: 1.5; }
.polar-svg .pol-stunde { fill: none; stroke: #3ddc84; stroke-width: 2.5;
                         stroke-linejoin: round; stroke-linecap: round; }
.polar-spalte { flex: 1; display: flex; flex-direction: column; gap: 12px; min-height: 0; }
```

- [ ] **Schritt 4: Volle Suite — die Zahl darf nicht fallen**

Lauf: `node --test tests/*.mjs 2>&1 | tail -9`
Erwartet: **`ℹ tests 152`, `ℹ fail 0`**. Diese Aufgabe fügt keine Tests hinzu; **fällt** die
Zahl, hat der Renderer ein Modul gebrochen, das andere Tests importieren.

- [ ] **Schritt 5: Lokal ansehen — mit echten Daten**

```bash
cd console && python3 -m http.server 8099
```

Die Prüfdatei besorgt der **Controller** in der Hauptsitzung und legt sie unter
`console/pruef-range.json` ab:

```bash
curl -s http://adsapp01/atc/data/range.json -o console/pruef-range.json
```

Dann `http://127.0.0.1:8099/?range=pruef-range.json` öffnen. Zu sehen sein müssen:

- eine geschlossene Fläche über alle 36 Sektoren, **deutlich größer nach NNO als nach WSW**,
- die helle Stundenlinie **innerhalb** der Fläche,
- vier Ringe: 10, 25, 50 und **80 NM** außen beschriftet,
- die Treppenstufen als sichtbare radiale Sprünge zwischen Nachbarsektoren.

**Die Datei danach löschen** (`rm console/pruef-range.json`) — sie gehört nicht ins Repo
und steht in keiner `.gitignore`.

- [ ] **Schritt 6: Absichtlich falsch bedienen, lokal**

Aus der Prüfdatei einen `hour_max`-Eintrag entfernen und die Seite neu laden: **Die
Stundenlinie muß aufreißen und darf nicht ins Zentrum fallen.** Vorher mit der
vollständigen Datei ansehen — sonst sieht „Lücke" genauso aus wie „heil", und das ist
derselbe Fehler wie die kaputte Konfiguration bei der Stufe-2-Abnahme, die erst nach einer
sichtbar anderen Zwischenstufe etwas bewies.

- [ ] **Schritt 7: Commit**

```bash
git add console/js/pages/polar.js console/index.html console/css/console.css
git commit -m "Polar: Windrose am Bild, siebte Seite registriert"
```

---

### Aufgabe 9: Die Datenspalte

**Dateien:**
- Ändern: `console/js/pages/polar.js`
- Ändern: `console/css/console.css`
- Ändern: `tests/test_polar.mjs`

**Schnittstellen:**
- Liefert: `datumKurz(iso) → string` (`'2026-07-27T18:21:58+02:00'` → `'27.07. 18:21'`)

- [ ] **Schritt 1: Die Tests schreiben**

```javascript
test('datumKurz macht aus dem ISO-Stempel Tag und Uhrzeit', () => {
  // Die Konsole zeigt Ortszeit des Geraets -- Browser und Daemon sitzen
  // auf demselben Host, es gibt keinen Uhrenversatz zu ueberbruecken.
  // Der Test prueft deshalb gegen Ortszeit. Die erste Zusicherung macht
  // die Annahme sichtbar: Auf einer Maschine in einer anderen Zone waere
  // die zweite Zeile zu Recht rot, und ohne diese Zeile saehe das nach
  // einem Fehler in datumKurz aus.
  assert.equal(new Date('2026-07-27T18:21:58+02:00').getTimezoneOffset(), -120,
    'Dieser Test setzt Europe/Berlin in der Sommerzeit voraus');
  assert.equal(datumKurz('2026-07-27T18:21:58+02:00'), '27.07. 18:21');
});

test('datumKurz gibt bei fehlendem oder unlesbarem Stempel einen Gedankenstrich', () => {
  assert.equal(datumKurz(null), '—');
  assert.equal(datumKurz('gestern'), '—');
});
```

- [ ] **Schritt 2: Rot sehen**

Lauf: `node --test tests/test_polar.mjs 2>&1 | tail -9`
Erwartet: FEHLER — `datumKurz is not a function`

- [ ] **Schritt 3: `datumKurz` umsetzen**

```javascript
// Der Zeitstempel des Daemons traegt einen Offset; die Anzeige zeigt
// Ortszeit des Geraets -- Browser und Daemon laufen auf demselben Host,
// also gibt es keinen Uhrenversatz zu ueberbruecken.
export function datumKurz(iso) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '—';
  const d = new Date(ms);
  const zwei = n => String(n).padStart(2, '0');
  return `${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}. `
       + `${zwei(d.getHours())}:${zwei(d.getMinutes())}`;
}
```

- [ ] **Schritt 4: Grün sehen**

Lauf: `node --test tests/*.mjs 2>&1 | tail -9`
Erwartet: **`ℹ tests 154`, `ℹ fail 0`**

- [ ] **Schritt 5: Die Spalte füllen**

In `render` die Zeile `spalte.innerHTML = '';` ersetzen durch:

```javascript
    const g = m.groesster;
    const z = zuletztGefallen(state.range.records, Date.now());
    const groesstesBalken = Math.max(1, ...m.richtungen.map(r => r.rekordNm || 0));
    const nm = v => (v === null || v === undefined ? '—' : v.toFixed(1));

    spalte.innerHTML = `
      <div class="tile">
        <div class="lbl">Größter Empfang</div>
        <div class="pol-troph">${nm(g.rekordNm)}<span class="unit-s">NM</span></div>
        <div class="pol-troph-sub">${g.bereich} · ${flightLevel(g.altFt)} ·
          ${g.halter} · ${datumKurz(g.seenAt)}</div>
      </div>
      <div class="tile" style="flex:1">
        <div class="lbl">Maximum je Richtung — Rekord / letzte Stunde</div>
        ${m.richtungen.map(r => `
          <div class="pol-richt">
            <span class="pol-richt-n">${r.name}</span>
            <span class="pol-richt-b">${r.bereich}</span>
            <span class="pol-richt-bar">
              <i style="width:${((r.rekordNm || 0) / groesstesBalken * 100).toFixed(0)}%"></i>
              <b style="width:${((r.stundeNm || 0) / groesstesBalken * 100).toFixed(0)}%"></b>
            </span>
            <span class="pol-richt-r">${nm(r.rekordNm)}</span>
            <span class="pol-richt-s">${nm(r.stundeNm)}</span>
          </div>`).join('')}
      </div>
      <div class="tile">
        <div class="lbl">Zuletzt gefallen</div>
        <div class="db-zeile">
          <span class="db-label">${z ? `${z.bereich} · ${z.halter}` : 'noch kein Rekord'}</span>
          <span class="db-wert">${z ? `${nm(z.nm)} NM · vor ${z.alterMin} min` : '—'}</span>
        </div>
      </div>`;
```

- [ ] **Schritt 6: CSS ergänzen**

```css
.pol-troph { font-size: 46px; font-weight: 600; font-variant-numeric: tabular-nums;
             line-height: 1.05; }
.pol-troph .unit-s { font-size: 20px; color: #4e9c6a; margin-left: 8px; }
.pol-troph-sub { font-size: 17px; color: #4e9c6a; margin-top: 4px; }
.pol-richt { display: flex; align-items: center; gap: 8px; margin-top: 6px;
             font-variant-numeric: tabular-nums; }
.pol-richt-n { flex: 0 0 44px; font-size: 17px; color: #b8f5cc; }
.pol-richt-b { flex: 0 0 84px; font-size: 13px; color: #2f6b45; }
.pol-richt-bar { flex: 1; height: 12px; background: #0b1f13; border: 1px solid #14361f;
                 border-radius: 3px; position: relative; overflow: hidden; }
.pol-richt-bar i { position: absolute; inset: 0 auto 0 0; display: block; height: 100%;
                   background: #14512b; }
.pol-richt-bar b { position: absolute; inset: 0 auto 0 0; display: block; height: 100%;
                   background: #3ddc84; }
.pol-richt-r { flex: 0 0 46px; font-size: 17px; text-align: right; }
.pol-richt-s { flex: 0 0 46px; font-size: 17px; text-align: right; color: #4e9c6a; }
```

- [ ] **Schritt 7: Volle Suite und lokaler Blick**

Lauf: `node --test tests/*.mjs 2>&1 | tail -9`
Erwartet: **`ℹ tests 154`, `ℹ fail 0`**

Dann erneut über `http://127.0.0.1:8099/?range=pruef-range.json` ansehen. **Der eine
Layoutwert, den es zu prüfen gilt: Passen zwölf Zeilen plus Trophäe plus Puls ohne
Überlauf in 620 px?** Gerechnet ist 140 + 336 + 40 = 516. Gerechnet ist nicht gesehen —
und der Schluß-Review der Stufe 2 hat genau an dieser Stelle gerechnet statt gesehen und
einen Überlauf auf der Einzielseite übersehen. Läuft es über, wird die Trophäe kleiner,
nicht die Tabelle kürzer.

Prüfdatei danach wieder löschen.

- [ ] **Schritt 8: Commit**

```bash
git add console/js/pages/polar.js console/css/console.css tests/test_polar.mjs
git commit -m "Polar: Trophaee, zwoelf Richtungen und der zuletzt gefallene Rekord"
```

---

### Aufgabe 10: Dokumente nachziehen

Kein Dokument darf nach dieser Stufe etwas Falsches behaupten. Die Stufe-2-Umsetzung hat
gezeigt, warum das eine eigene Aufgabe ist und kein Anhängsel: Auf dem Gerät lag noch ein
Hinweis, den derselbe Tag schon als falsche Zusage korrigiert hatte.

**Dateien:**
- Ändern: `docs/specs/2026-07-27-atc-konsole-design.md` (§2.3, §6.5, §7.1, §10.3, §11)
- Ändern: `CLAUDE.md`
- Ändern: `README.md`

- [ ] **Schritt 1: §6.5 ersetzen**

Den Rumpf des Abschnitts „### 6.5 Polar — Reichweite" (die sechs Zeilen ab „36 Sektoren
à 10°…") vollständig ersetzen durch:

```markdown
**Neu gefaßt am 29.07.2026**, maßgeblich ist
[`2026-07-29-stufe-3-entwurf.md`](2026-07-29-stufe-3-entwurf.md) §2 und §3.

36 Sektoren à 10° als Windrose, zwei Spuren aus `range.json` (§5.3): der Allzeit-Rekord
aus SQLite als gefüllte Fläche, das Maximum der letzten Stunde als Linie darin. Beide
als **Treppe** über die vollen 10° je Sektor — ein Zug durch die Sektormitten behauptete
eine stetige Funktion der Peilung, die die Daten nicht hergeben. Sektoren ohne
Stundenwert **reißen die Linie auf**; sie fallen nicht auf 0.

**Eigener Maßstab**, in 20-NM-Stufen über dem größten Wert (heute 80 NM): Am 29.07. lagen
**13 von 36 Rekorden jenseits von 50 NM**, der größte bei 79,4 NM. Der Radarmaßstab
klemmte damit genau den Gegenstand der Seite. Die Radarringe aus `cfg.radar.rings_nm`
bleiben als Gitter erhalten.

Die ursprüngliche Zusage „mit Datum, **Callsign** und Flugfläche des Rekordhalters" wird
zurückgenommen: **19 von 36 Rekordhaltern hatten am 29.07. kein Callsign.** Es gilt die
Regel von Board und Einzelziel — der `hex` steht in der Zeile, kein Gedankenstrich.

Rechts eine Datenspalte mit dem absoluten Rekordhalter, **zwölf Richtungen à 30°** (nicht
acht à 45° — das teilt 36 Sektoren nicht, siehe §3.2 des Stufe-3-Entwurfs) und dem
zuletzt gefallenen Rekord.

Diese Seite zeigt reale Physik — die Abschattung nach WSW (19,8 NM) gegen NNO (79,4 NM),
ein Verhältnis von 4 : 1.
```

- [ ] **Schritt 2: §2.3 ergänzen**

Nach der Zeile mit den acht 45°-Werten einfügen, daß das **Anzeigeformat** zwölf 30°-Kästen
sind (§3.2 des Stufe-3-Entwurfs), weil 45° die 36 Sektoren nicht teilt — und daß der
Allzeit-Rekord (79,4 NM am 29.07.) über dem Stundenmaximum dieser Messung (69,1 NM) liegt,
ohne daß das eine die andere widerlegt.

- [ ] **Schritt 3: §7.1, §10.3, §11**

- §7.1: Die Tabellenzeile „nach Stufe 3" wird zu „**heute**": 7 Seiten, Umlauf **2:15**,
  Radaranteil **33 %**. Die Zeile „heute, nach Stufe 2" wird zur historischen.
- §10.3: die vier `?range=`-Prüfungen aus §9.2 des Stufe-3-Entwurfs aufnehmen.
- §11: Stufe 3 auf „**umgesetzt am 29.07.2026**"; **der ganze Absatz „Nach Stufe 2 laufen
  sechs Seiten" samt Filterbemerkung entfällt** — er wäre ab jetzt falsch.

- [ ] **Schritt 4: `CLAUDE.md` und `README.md`**

- `CLAUDE.md`, Abschnitt „Struktur": `js/geo.js` um die verschobene `projectToCanvas`
  ergänzen, `js/pages/polar.js` mit einer Zeile aufnehmen.
- `README.md`: Seitenzahl und Umlauf, wo sie genannt werden.

- [ ] **Schritt 5: Gegenprobe — nichts behauptet mehr „sechs Seiten"**

```bash
grep -rniE "sechs seiten|2:00|37,5 ?%|noch keinen renderer|fruehestens stufe 3" \
  docs README.md CLAUDE.md config/console.json
```

Jeder Treffer wird einzeln angesehen: In einem **Meß- oder Abnahmeprotokoll** ist „sechs
Seiten" richtig und bleibt stehen — es beschreibt, was damals gemessen wurde. In einer
**Spec** oder im README wäre es ab jetzt falsch. Der Hinweis in `config/console.json`
(`interrupt_carousel` … „frühestens Stufe 3") bleibt ebenfalls wahr und bleibt stehen:
Das Feld ist weiterhin nicht umgesetzt (§11 des Stufe-3-Entwurfs).

- [ ] **Schritt 6: Commit**

```bash
git add docs CLAUDE.md README.md
git commit -m "Dokumente auf sieben Seiten: 6.5 ersetzt, Umlauf 2:15, Stufe 3 umgesetzt"
```

---

## Danach: Abnahme und Wärme

**Nicht Teil dieses Plans, aber der Liefergegenstand ist ohne sie nicht fertig.** Beides
macht der Controller in der Hauptsitzung, wo Henning jeden Befehl sieht:

1. **Abnahme am Gerät** nach §9.2 des Stufe-3-Entwurfs — elf Punkte, vier davon über
   `?range=`, danach Rückbau mit Gegenprobe.
2. **Wärmelauf über Nacht**, **37 s Meßabstand** (30 s würden den 135-s-Umlauf nicht
   teilen, 27 und 45 schon — genau daran war die Messung vom 28.07. unterabgetastet).
   Kriterien **vor** dem Lauf: `samples_dropped` bleibt 0, `get_throttled` bleibt `0x0`,
   Temperatur unter 72 °C. Die Marge am Maximum betrug zuletzt 0,9 K.
3. **Protokolle** nach `docs/abnahme/` und `docs/messungen/`, dann PR.

Von den acht ernsten Befunden der Stufe 2 fand Hennings Hand am Panel drei — darunter den
einen Critical, den 121 Tests nicht sahen. **Henning ans Panel holen, wo es nötig ist.**
