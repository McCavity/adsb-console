# Radar-Ansicht — Umsetzungsplan

> **Für agentische Bearbeiter:** ERFORDERLICHE SUB-SKILL: `superpowers:subagent-driven-development`
> (empfohlen) oder `superpowers:executing-plans`, um diesen Plan Aufgabe für Aufgabe
> abzuarbeiten. Die Schritte tragen Kästchen (`- [ ]`) zur Verfolgung.

**Ziel:** Die Reichweite der Radarseite am Panel zwischen 10, 50 und 80 NM umschaltbar machen,
die Flugplätze als ersten ein- und ausblendbaren Layer bauen, und beides über ein Zahnrad im
Kopf erreichbar machen.

**Architektur:** Der Laufzeit-Zustand („was jemand am Panel gedreht hat") lebt in einem neuen,
reinen Modul `console/js/ansicht.js` — getrennt von `config` (dem Bootvertrag aus
`console.json`). `console.js` löst beides einmal je Render über `gilt()` zu einer flachen
Antwort auf und reicht sie als **vierten Parameter** an die Seiten. Keine Seite rechnet zwei
Quellen selbst gegeneinander.

**Tech-Stack:** ES-Module ohne Bündler, `node --test` für JavaScript, CSS ohne Präprozessor.
Der Daemon und der ADS-B-Stack werden **nicht** angefaßt.

**Maßgebliche Dokumente:**
- Entwurf: [`docs/specs/2026-07-31-radar-ansicht-entwurf.md`](../specs/2026-07-31-radar-ansicht-entwurf.md)
- Hauptentwurf: [`docs/specs/2026-07-27-atc-konsole-design.md`](../specs/2026-07-27-atc-konsole-design.md)
- Umsetzung Stufe 3: [`docs/plaene/2026-07-29-stufe-3-umsetzung.md`](2026-07-29-stufe-3-umsetzung.md)

## Globale Randbedingungen

Diese gelten für **jede** Aufgabe, auch wo sie nicht wiederholt werden.

- **Keine Fremdquelle zur Laufzeit.** Kein CDN, keine externe Bibliothek.
- **Die exakte Empfängerposition gehört nicht ins Repo** — kein Testfixture, kein Kommentar,
  auch keine gerundete Fassung. Wo Tests eine Position brauchen, ist es die erfundene
  `50.0 / 9.0`.
- **Kein Umbau am ADS-B-Stack.** Weder `dump1090-fa`, noch die Feeder, noch die
  lighttpd-Konfiguration, noch der Daemon.
- **Fehlende Werte sind `null` bzw. `—`, niemals `0`.** Eine 0 meldet einen gemessenen Zustand.
- **Nur ES-Module, keine DOM-Testumgebung.** Was nur im Browser läuft, wird am Gerät geprüft,
  nicht durch eine Attrappe.
- **Testlauf ist immer `node --test tests/*.mjs`** — **mit Dateimuster, nie blank.** Ein
  blankes `node --test` findet in diesem Repo keine Datei und meldet trotzdem `fail 0`.
- **Gelesen wird die Zeile `ℹ tests N`, nicht nur `ℹ fail 0`.** Null Fehler bei null Tests ist
  kein Ergebnis. **Nicht mit `grep '^# tests'` suchen** — dieses Node stellt den Zeilen `ℹ`
  voran. Verläßlich:

  ```bash
  node --test tests/*.mjs 2>&1 | tail -9
  ```
- **Ausgangswert am 31.07.2026, selbst gemessen: `ℹ tests 168`, `ℹ fail 0`** (Node v26.5.0).
  Jede Aufgabe nennt, auf welchen Wert die Zahl steigen muß. Steigt sie nicht, ist die
  Testdatei nicht gelaufen — unabhängig davon, was `fail` sagt.
- **Jeder neue Test wird einmal absichtlich rot gesehen**, bevor ihm geglaubt wird: falsche
  Erwartung eintragen, laufen lassen, zurückdrehen. Die Schritte stehen ausgeschrieben.
- **Anzeigesprache Deutsch**, Fachbegriffe englisch (Squawk, Track, FL, Heavy). Einheiten
  nautisch. Zahlen mit Dezimalpunkt.
- **Nichts scrollt.** Was nicht ins Layout paßt, ist ein Layoutfehler und keine Scrollbar.
- **Subagenten führen keine `sudo`-Befehle auf `adsapp01` aus.** Alles, was das produktive
  Feeder-Gerät anfaßt, macht der Controller in der Hauptsitzung (Aufgabe 8).

## Dateien

| Datei | Verantwortung | Aufgabe |
|---|---|---|
| `console/js/ansicht.js` | **NEU** — Laufzeit-Zustand: Stufenwahl, Layer, `gilt()` | 1 |
| `console/js/config.js` | `stufen` härten, konfigurierte Reichweite ergänzen | 1 |
| `console/js/geo.js` | **NEU:** `sichtbareRinge()` — Ringe gegen die Reichweite filtern | 2 |
| `console/js/pages/radar.js` | Ringfilter, Hintergrund-Signatur, Ansicht statt Config, `einstellungen()` | 2, 3, 4, 6 |
| `console/js/pages/profile.js` | Ansicht statt Config; nutzt `sichtbareRinge()` | 2, 5 |
| `console/js/pages/polar.js` | innere Ringe aus der Ansicht statt der Config | 5 |
| `console/js/console.js` | `gilt()` je Render, vierter Parameter, Zahnrad, Dialog | 4, 7 |
| `console/css/console.css` | Zahnrad und Dialog | 7 |
| `tests/test_ansicht.mjs` | **NEU** — Stufenauflösung, Klemmen, Layer | 1 |
| `tests/test_config.mjs` | Härtung der Stufen | 1 |
| `tests/test_geo.mjs` | `sichtbareRinge()` | 2 |
| `tests/test_radar_geometry.mjs` | Hintergrund-Signatur | 3 |
| `tests/test_profile.mjs` | Kopplung an die Ansicht (**der echte Rot-Test**) | 5 |

---

### Aufgabe 1: `ansicht.js` und die Stufen-Härtung

**Dateien:**
- Erstellen: `console/js/ansicht.js`
- Erstellen: `tests/test_ansicht.mjs`
- Ändern: `console/js/config.js` (`DEFAULTS`, `mergeConfig`)
- Ändern: `tests/test_config.mjs` (anhängen)

**Schnittstellen:**
- Verbraucht: `mergeConfig(raw)` aus `config.js` (vorhanden)
- Liefert: `erzeugeAnsicht()`, `setzeStufe(z, index)`, `schalteLayer(z, id, an)`,
  `gilt(z, config)`, `LAYER`. `gilt()` gibt
  `{ stufeIndex: number, stufen: Array<{range_nm, rings_nm}>, range_nm: number,
  rings_nm: number[], layer: { airports: boolean } }`.
  `config.radar.stufen` ist nach `mergeConfig` **nie leer**, aufsteigend sortiert und enthält
  garantiert einen Eintrag mit `range_nm === config.radar.range_nm`.

  > **Nachtrag 31.07. (Commit `5df3afc`, aus der Prüfung von Aufgabe 1):** Die Garantie hielt
  > zunächst nicht. Bei `range_nm: 5` ohne eigene `rings_nm` filtert `harteStufe` alle
  > Vorgabe-Ringe (10/25/50) weg, liefert `null`, und die konfigurierte Reichweite fiel aus
  > der Liste — `gilt()` zeigte dann 10 NM, während `config.radar.range_nm` weiter 5 meldete.
  > Behoben durch einen Rückfall auf `rings_nm: [range_nm]` (nur der Außenring) für die
  > **eigene** Stufe; `harteStufe` bleibt für Einträge aus der Konfigurationsliste streng.
  > Kostet zwei zusätzliche Tests — daher 180 statt 178 nach Aufgabe 1.

- [ ] **Schritt 1: Testdatei `tests/test_ansicht.mjs` anlegen**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeConfig } from '../console/js/config.js';
import { erzeugeAnsicht, setzeStufe, schalteLayer, gilt } from '../console/js/ansicht.js';

test('ohne Ueberschreibung gilt genau die konfigurierte Reichweite', () => {
  const cfg = mergeConfig({ radar: { range_nm: 50 } });
  const s = gilt(erzeugeAnsicht(), cfg);
  assert.equal(s.range_nm, 50);
  assert.deepEqual(s.rings_nm, [10, 25, 50]);
});

test('Stufenwechsel liefert Reichweite UND Ringe der neuen Stufe', () => {
  const cfg = mergeConfig({});
  const s = gilt(setzeStufe(erzeugeAnsicht(), 0), cfg);
  assert.equal(s.range_nm, 10);
  assert.deepEqual(s.rings_nm, [2, 5, 10]);
});

test('Stufenindex ausserhalb klemmt, statt undefined zu liefern', () => {
  const cfg = mergeConfig({});
  for (const i of [-5, 99]) {
    const s = gilt(setzeStufe(erzeugeAnsicht(), i), cfg);
    assert.ok(Number.isFinite(s.range_nm), `Index ${i} lieferte keine Reichweite`);
    assert.ok(s.stufeIndex >= 0 && s.stufeIndex < s.stufen.length);
  }
});

test('Flugplatz-Layer ist vorgabegemaess an und laesst sich abschalten', () => {
  const cfg = mergeConfig({});
  assert.equal(gilt(erzeugeAnsicht(), cfg).layer.airports, true);
  const aus = schalteLayer(erzeugeAnsicht(), 'airports', false);
  assert.equal(gilt(aus, cfg).layer.airports, false);
});

test('unbekannte Layer-Kennung wird ignoriert, nicht angelegt', () => {
  const z = schalteLayer(erzeugeAnsicht(), 'holdings', true);
  assert.equal(Object.prototype.hasOwnProperty.call(z.layer, 'holdings'), false);
});

test('ansicht mutiert den uebergebenen Zustand nicht', () => {
  const z = erzeugeAnsicht();
  setzeStufe(z, 2);
  schalteLayer(z, 'airports', false);
  assert.equal(z.stufe, null);
  assert.deepEqual(z.layer, {});
});
```

- [ ] **Schritt 2: Lauf zur Bestätigung, daß er fehlschlägt**

Lauf: `node --test tests/test_ansicht.mjs 2>&1 | tail -9`
Erwartet: FAIL — `Cannot find module '../console/js/ansicht.js'`

- [ ] **Schritt 3: `console/js/config.js` um die Stufen erweitern**

In `DEFAULTS.radar` ergänzen (nach `labels`):

```js
    stufen: [ { range_nm: 10, rings_nm: [2, 5, 10] },
              { range_nm: 50, rings_nm: [10, 25, 50] },
              { range_nm: 80, rings_nm: [20, 50, 80] } ],
```

Vor `mergeConfig` einfügen:

```js
// Eine Stufe ist nur brauchbar, wenn beide Haelften stimmen. Ringe, die
// nicht in ihre eigene Reichweite passen, werden hier schon aussortiert --
// sonst zeichnet die Radarseite spaeter ausserhalb des Kreises.
function harteStufe(roh) {
  const s = plainObject(roh);
  const range = positiveNumber(s.range_nm, null);
  if (range == null) return null;
  const ringe = Array.isArray(s.rings_nm)
    ? s.rings_nm.filter(n => typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= range)
    : [];
  return ringe.length ? { range_nm: range, rings_nm: ringe.slice().sort((a, b) => a - b) } : null;
}

// Die konfigurierte Reichweite MUSS erreichbar bleiben. Wer in console.json
// 35 NM einstellt, darf sie durch die neue Stufenwahl nicht verlieren --
// eine neue Funktion, die eine bestehende Konfiguration unerreichbar macht,
// ist eine Verschlechterung, auch wenn sie mehr kann.
function bauStufen(rohListe, range_nm, rings_nm) {
  const aus = Array.isArray(rohListe)
    ? rohListe.map(harteStufe).filter(Boolean) : [];
  const liste = aus.length ? aus : DEFAULTS.radar.stufen.map(harteStufe).filter(Boolean);
  if (!liste.some(s => s.range_nm === range_nm)) {
    const eigen = harteStufe({ range_nm, rings_nm });
    if (eigen) liste.push(eigen);
  }
  return liste.sort((a, b) => a.range_nm - b.range_nm);
}
```

In `mergeConfig`, im `radar`-Objekt nach `labels` ergänzen:

```js
    stufen: [],          // Platzhalter, wird direkt darunter gesetzt
```

und unmittelbar nach dem `const radar = { ... };`-Block:

```js
  radar.stufen = bauStufen(radarIn.stufen, radar.range_nm, radar.rings_nm);
```

- [ ] **Schritt 4: `console/js/ansicht.js` schreiben**

```js
// Laufzeit-Ansicht: was jemand am Panel gedreht hat.
//
// Rein -- kein DOM, keine Uhr, kein Zustand ausserhalb des uebergebenen
// Objekts. Dasselbe Muster wie carousel.js, und aus demselben Grund: Die
// Entscheidung soll erreichbar sein, ohne dass jemand mit einer Stoppuhr
// vor dem Panel steht.
//
// Ausdruecklich GETRENNT von config: config ist der Bootvertrag (was
// console.json gesagt hat, von mergeConfig gehaertet), ansicht ist die
// Ueberschreibung. Wer beides in ein Objekt mischt, kann nach zwei Wochen
// nicht mehr sagen, welcher Wert woher stammt.
//
// Der Zustand lebt nur im Speicher. Der naechtliche Reload um 4:00
// (console.js) setzt ihn von selbst zurueck -- deshalb braucht es keinen
// Verfall und keine Persistenz.

export const LAYER = ['airports'];

export function erzeugeAnsicht() {
  return { stufe: null, layer: {} };
}

export function setzeStufe(z, index) {
  return { ...z, stufe: Number.isInteger(index) ? index : null };
}

export function schalteLayer(z, id, an) {
  // Unbekannte Kennung wird ignoriert statt angelegt: Sonst traegt die
  // Ansicht einen Layer, fuer den es keine Zeichenfunktion gibt -- genau
  // die Falle, die mergeConfig bei unbekannten Seitennamen schon vermeidet.
  if (!LAYER.includes(id)) return z;
  return { ...z, layer: { ...z.layer, [id]: !!an } };
}

function klemme(n, min, max) {
  return n < min ? min : (n > max ? max : n);
}

// Die einzige Frage, die Seiten stellen. Bootvertrag und Ueberschreibung
// werden hier EINMAL verrechnet und flach zurueckgegeben -- damit keine
// Seite zwei Quellen selbst gegeneinander rechnet.
export function gilt(z, config) {
  const stufen = config.radar.stufen;
  const vorgabe = stufen.findIndex(s => s.range_nm === config.radar.range_nm);
  const index = z.stufe == null
    ? (vorgabe >= 0 ? vorgabe : 0)
    : klemme(z.stufe, 0, stufen.length - 1);
  const s = stufen[index];
  return {
    stufeIndex: index,
    stufen,
    range_nm: s.range_nm,
    rings_nm: s.rings_nm,
    layer: { airports: z.layer.airports !== false },
  };
}
```

- [ ] **Schritt 5: Lauf zur Bestätigung, daß er besteht**

Lauf: `node --test tests/test_ansicht.mjs 2>&1 | tail -9`
Erwartet: `ℹ tests 6`, `ℹ fail 0`

- [ ] **Schritt 6: Härtungstests an `tests/test_config.mjs` anhängen**

```js
test('stufen: konfigurierte Reichweite 35 wird als eigene Stufe sortiert ergaenzt', () => {
  const cfg = mergeConfig({ radar: { range_nm: 35, rings_nm: [10, 20, 35] } });
  const weiten = cfg.radar.stufen.map(s => s.range_nm);
  assert.deepEqual(weiten, [10, 35, 50, 80]);
});

test('stufen: konfigurierte Reichweite 50 erzeugt KEINE Dublette', () => {
  const cfg = mergeConfig({ radar: { range_nm: 50 } });
  const fuenfziger = cfg.radar.stufen.filter(s => s.range_nm === 50);
  assert.equal(fuenfziger.length, 1);
});

test('stufen: kaputte Liste faellt auf die Vorgaben zurueck, niemals auf leer', () => {
  for (const kaputt of [null, 'nein', [], [{}], [{ range_nm: -5 }], [{ range_nm: 10 }]]) {
    const cfg = mergeConfig({ radar: { stufen: kaputt } });
    assert.ok(cfg.radar.stufen.length > 0, `${JSON.stringify(kaputt)} ergab eine leere Liste`);
  }
});

test('stufen: ein Ring groesser als seine Reichweite wird aussortiert', () => {
  const cfg = mergeConfig({ radar: { stufen: [{ range_nm: 10, rings_nm: [2, 5, 10, 25] }] } });
  const zehner = cfg.radar.stufen.find(s => s.range_nm === 10);
  assert.deepEqual(zehner.rings_nm, [2, 5, 10]);
});
```

- [ ] **Schritt 7: Jeden neuen Test einmal absichtlich rot sehen**

In `test_config.mjs` im ersten neuen Test `[10, 35, 50, 80]` auf `[10, 50, 80]` ändern.
Lauf: `node --test tests/test_config.mjs 2>&1 | tail -9`
Erwartet: FAIL. Danach zurückdrehen und erneut laufen — `ℹ fail 0`.

- [ ] **Schritt 8: Gesamtlauf**

Lauf: `node --test tests/*.mjs 2>&1 | tail -9`
Erwartet: `ℹ tests 180`, `ℹ fail 0`

- [ ] **Schritt 9: Commit**

```bash
git add console/js/ansicht.js console/js/config.js tests/test_ansicht.mjs tests/test_config.mjs
git commit -m "ansicht.js: Laufzeit-Zustand getrennt vom Bootvertrag"
```

---

### Aufgabe 2: `sichtbareRinge()` — der Ringfilter (Defekt 4.4)

**Dateien:**
- Ändern: `console/js/geo.js` (anhängen)
- Ändern: `console/js/pages/radar.js:35` (Schleife in `drawBackground`)
- Ändern: `console/js/pages/profile.js:105-107` (dieselbe Regel, bisher doppelt)
- Ändern: `tests/test_geo.mjs` (anhängen)

**Schnittstellen:**
- Liefert: `sichtbareRinge(ringe, rangeNm) -> number[]` — aufsteigend, nur Ringe
  `> 0 && <= rangeNm`. Nicht-Arrays und ungültige Einträge ergeben `[]`.

- [ ] **Schritt 1: Test an `tests/test_geo.mjs` anhängen**

```js
test('sichtbareRinge: bei Reichweite 10 bleibt von [10,25,50] nur die 10', () => {
  assert.deepEqual(sichtbareRinge([10, 25, 50], 10), [10]);
});

test('sichtbareRinge: der Ring AUF der Reichweite bleibt (er ist der Aussenring)', () => {
  assert.deepEqual(sichtbareRinge([20, 50, 80], 80), [20, 50, 80]);
});

test('sichtbareRinge: sortiert aufsteigend und wirft Unfug weg', () => {
  assert.deepEqual(sichtbareRinge([50, 'x', -3, 10, null, 25], 50), [10, 25, 50]);
});

test('sichtbareRinge: kein Array ergibt eine leere Liste, keinen Fehler', () => {
  for (const k of [null, undefined, 'nein', 42]) assert.deepEqual(sichtbareRinge(k, 50), []);
});
```

Den Import oben in der Datei um `sichtbareRinge` erweitern.

- [ ] **Schritt 2: Lauf zur Bestätigung, daß er fehlschlägt**

Lauf: `node --test tests/test_geo.mjs 2>&1 | tail -9`
Erwartet: FAIL — `sichtbareRinge is not a function`

- [ ] **Schritt 3: `sichtbareRinge()` in `console/js/geo.js` anhängen**

```js
// Welche Ringe passen in diese Reichweite? Bis zum 31.07.2026 zeichnete
// drawBackground() ALLE rings_nm ohne Filter -- unsichtbar, solange
// [10, 25, 50] zufaellig zu range_nm 50 passte. Mit umschaltbarer
// Reichweite tritt die Bedingung erstmals ein: bei 10 NM laegen zwei von
// drei Ringen ausserhalb des Kreises.
//
// profile.js hatte die Regel bereits richtig, radar.js nicht. Sie steht
// deshalb ab jetzt genau einmal hier.
//
// Der Ring GENAU AUF der Reichweite bleibt: Er ist der Aussenring, nicht
// ein Ueberstand.
export function sichtbareRinge(ringe, rangeNm) {
  if (!Array.isArray(ringe)) return [];
  return ringe
    .filter(n => typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= rangeNm)
    .sort((a, b) => a - b);
}
```

- [ ] **Schritt 4: Lauf zur Bestätigung, daß er besteht**

Lauf: `node --test tests/test_geo.mjs 2>&1 | tail -9`
Erwartet: `ℹ fail 0`

- [ ] **Schritt 5: `radar.js` auf den Filter umstellen**

Import oben in `console/js/pages/radar.js` um `sichtbareRinge` erweitern. Dann `radar.js:35`
von

```js
  for (const nm of cfg.radar.rings_nm) {
```

ändern auf

```js
  for (const nm of sichtbareRinge(cfg.radar.rings_nm, cfg.radar.range_nm)) {
```

(In Aufgabe 4 wird `cfg.radar` hier durch die Ansicht ersetzt; der Filter bleibt.)

- [ ] **Schritt 6: `profile.js` auf dieselbe Funktion umstellen**

Import erweitern. `console/js/pages/profile.js:105-107` von

```js
    for (const ring of cfg.radar.rings_nm) {
      if (ring > cfg.radar.range_nm) continue;
      const x = punktX(ring, cfg.radar.range_nm);
```

ändern auf

```js
    for (const ring of sichtbareRinge(cfg.radar.rings_nm, cfg.radar.range_nm)) {
      const x = punktX(ring, cfg.radar.range_nm);
```

- [ ] **Schritt 7: Einmal absichtlich rot sehen**

Im ersten neuen Test `[10]` auf `[10, 25]` ändern, laufen lassen (FAIL erwartet),
zurückdrehen, erneut laufen (`ℹ fail 0`).

- [ ] **Schritt 8: Gesamtlauf und Commit**

Lauf: `node --test tests/*.mjs 2>&1 | tail -9` — erwartet `ℹ tests 184`, `ℹ fail 0`

```bash
git add console/js/geo.js console/js/pages/radar.js console/js/pages/profile.js tests/test_geo.mjs
git commit -m "sichtbareRinge(): Ringe gegen die Reichweite filtern -- Regel genau einmal"
```

---

### Aufgabe 3: Hintergrund-Signatur statt `drawnBg`

**Dateien:**
- Ändern: `console/js/pages/radar.js:115-138` (`mount` und `render`)
- Ändern: `tests/test_radar_geometry.mjs` (anhängen)

**Schnittstellen:**
- Liefert: `hintergrundSignatur(sicht) -> string`, exportiert aus `radar.js`. Gleiche
  Ansicht → gleiche Zeichenkette; unterschiedliche Reichweite, Ringe **oder** Layer-Zustand →
  unterschiedliche Zeichenkette.

**Hinweis für den Bearbeiter:** Der Hintergrund wird bewußt nur einmal gezeichnet (Kommentar
bei `radar.js:124`) — eine Canvas-Schrift, die zum Zeichenzeitpunkt noch nicht geladen ist,
fällt lautlos auf die Ersatzschrift zurück. „Einfach jedes Mal neu zeichnen" ist deshalb die
**falsche** Antwort und wäre auf diesem Gerät außerdem Dauerwärme.

- [ ] **Schritt 1: Test an `tests/test_radar_geometry.mjs` anhängen**

```js
import { hintergrundSignatur } from '../console/js/pages/radar.js';

const sicht = (range_nm, rings_nm, airports = true) =>
  ({ range_nm, rings_nm, layer: { airports } });

test('Signatur: gleiche Ansicht ergibt dieselbe Zeichenkette', () => {
  assert.equal(hintergrundSignatur(sicht(50, [10, 25, 50])),
               hintergrundSignatur(sicht(50, [10, 25, 50])));
});

test('Signatur: andere Reichweite ergibt eine andere Zeichenkette', () => {
  assert.notEqual(hintergrundSignatur(sicht(50, [10, 25, 50])),
                  hintergrundSignatur(sicht(10, [2, 5, 10])));
});

test('Signatur: umgeschalteter Flugplatz-Layer ergibt eine andere Zeichenkette', () => {
  assert.notEqual(hintergrundSignatur(sicht(50, [10, 25, 50], true)),
                  hintergrundSignatur(sicht(50, [10, 25, 50], false)));
});

test('Signatur: gleiche Reichweite, andere Ringe ergibt eine andere Zeichenkette', () => {
  assert.notEqual(hintergrundSignatur(sicht(50, [10, 25, 50])),
                  hintergrundSignatur(sicht(50, [25, 50])));
});
```

- [ ] **Schritt 2: Lauf zur Bestätigung, daß er fehlschlägt**

Lauf: `node --test tests/test_radar_geometry.mjs 2>&1 | tail -9`
Erwartet: FAIL — `hintergrundSignatur is not a function`

- [ ] **Schritt 3: Signatur in `radar.js` einbauen**

Vor `registerPage({` einfügen:

```js
// Woraus besteht das gezeichnete Hintergrundbild? Genau daraus, und aus
// nichts sonst -- wer hier ein Feld vergisst, bekommt einen Hintergrund,
// der zum Vordergrund nicht mehr passt und sich nie korrigiert.
export function hintergrundSignatur(sicht) {
  return [sicht.range_nm, sicht.rings_nm.join(','), sicht.layer.airports ? 'ap' : '-'].join('|');
}
```

In `mount()` `drawnBg: false,` ersetzen durch `bgSig: null,`.

In `render()` den Block

```js
    if (!c.drawnBg && state.receiver) {
      drawBackground(c.bg, cfg, state.receiver);
      c.drawnBg = true;
    }
```

ersetzen durch

```js
    const sig = hintergrundSignatur(sicht);
    if (c.bgSig !== sig && state.receiver) {
      drawBackground(c.bg, cfg, state.receiver, sicht);
      c.bgSig = sig;
    }
```

In `mount()` die Zeile `.then(() => { el._ctx.drawnBg = false; });` ersetzen durch
`.then(() => { el._ctx.bgSig = null; });` — sie erzwingt das Neuzeichnen, nachdem Schrift und
Flugplätze geladen sind, und muß mitziehen.

**`sicht` steht in `render()` erst nach Aufgabe 4 zur Verfügung.** Bis dahin am Anfang von
`render()` einfügen:

```js
    const sicht = { range_nm: cfg.radar.range_nm, rings_nm: cfg.radar.rings_nm,
                    layer: { airports: true } };
```

Diese Zeile entfällt in Aufgabe 4 wieder.

- [ ] **Schritt 4: Lauf zur Bestätigung, daß er besteht**

Lauf: `node --test tests/test_radar_geometry.mjs 2>&1 | tail -9` — erwartet `ℹ fail 0`

- [ ] **Schritt 5: Einmal absichtlich rot sehen**

Im dritten Test `assert.notEqual` auf `assert.equal` ändern, laufen lassen (FAIL),
zurückdrehen, erneut laufen.

- [ ] **Schritt 6: Gesamtlauf und Commit**

Lauf: `node --test tests/*.mjs 2>&1 | tail -9` — erwartet `ℹ tests 188`, `ℹ fail 0`

```bash
git add console/js/pages/radar.js tests/test_radar_geometry.mjs
git commit -m "Hintergrund-Signatur statt drawnBg -- Umschalten zeichnet neu, Ruhe nicht"
```

---

### Aufgabe 4: Die Ansicht durch die Konsole reichen und `radar.js` umstellen

**Dateien:**
- Ändern: `console/js/console.js:9-57` (Ansicht anlegen, `gilt()` je Render, vierter Parameter)
- Ändern: `console/js/pages/radar.js` (alle Stellen aus 4.3 der Spec)

**Schnittstellen:**
- Verbraucht: `erzeugeAnsicht()`, `gilt()` aus `ansicht.js`; `hintergrundSignatur()` aus
  Aufgabe 3
- Liefert: Seiten erhalten `mount(el, config, state, sicht)`, `render(el, config, state, sicht)`
  und `onEnter(el, config, state, sicht)`. Seiten, die `sicht` nicht brauchen, deklarieren den
  Parameter nicht — überzählige Argumente sind in JavaScript folgenlos.
- Liefert: `export function ansichtAendern(fn)` aus `console.js` — nimmt eine Funktion
  `(z) => neuerZustand`, ersetzt den Zustand, rendert neu und meldet eine Berührung.

- [ ] **Schritt 1: `console.js` umbauen**

Import oben ergänzen:

```js
import { erzeugeAnsicht, gilt } from './ansicht.js';
```

In `startConsole()` nach `const config = await loadConfig();`:

```js
  let ansicht = erzeugeAnsicht();
```

Die drei Aufrufstellen erweitern — `mount` (`:24`), `betrete` (`:48`) und `renderCurrent`
(`:54`):

```js
    pages.get(id).mount(el, config, store.state, gilt(ansicht, config));
```

```js
    if (page && page.onEnter) page.onEnter(els.get(id), config, store.state, gilt(ansicht, config));
```

```js
    page.render(els.get(page.id), config, store.state, gilt(ansicht, config));
```

Und, innerhalb von `startConsole()` erreichbar, der Änderungsweg für den Dialog aus Aufgabe 7:

```js
  // Der Einstellungsdialog aendert die Ansicht ueber genau diesen Weg --
  // nicht durch Zugriff auf die Variable. So gibt es EINE Stelle, an der
  // ein Wechsel neu rendert und als Beruehrung zaehlt; sonst waere die
  // 60-Sekunden-Pause vom Zufall abhaengig, ob der Aufrufer daran denkt.
  aenderer = fn => {
    ansicht = fn(ansicht);
    renderCurrent();
    planeWechsel('beruehrung');
  };
```

Auf Modulebene, neben `const pages = new Map();`:

```js
let aenderer = null;
export function ansichtAendern(fn) { if (aenderer) aenderer(fn); }
```

- [ ] **Schritt 2: `radar.js` von `cfg.radar` auf `sicht` umstellen**

Die Hilfszeile aus Aufgabe 3 Schritt 3 **entfernen** und stattdessen `sicht` als vierten
Parameter entgegennehmen: `mount(el, cfg, state, sicht)` und `render(el, cfg, state, sicht)`.

`drawBackground(ctx, cfg, receiver, sicht)` und `drawAirports(ctx, receiver, sicht)`
erweitern. Ersetzt werden **alle** Reichweiten-Lesestellen (Spec 4.3):

| Zeile | vorher | nachher |
|---|---|---|
| `:36` | `cfg.radar.range_nm` | `sicht.range_nm` |
| `:43`, `:45` | `cfg.radar.range_nm` | `sicht.range_nm` |
| `:59`, `:61`, `:70`, `:74` | `cfg.radar.range_nm` | `sicht.range_nm` |
| `:153` | `cfg.radar.range_nm` | `sicht.range_nm` |
| `:218`, `:225` | `cfg.radar.range_nm` | `sicht.range_nm` |
| `:367`, `:368` | `cfg.radar.range_nm` / `.rings_nm` | `sicht.range_nm` / `sicht.rings_nm` |

`cfg` bleibt für `sweep_s`, `decay_s`, `leader_s`, `labels` und `emergency` zuständig.

Die Maßstabskachel (`:367`) ist keine Nebensache: Sie schriebe sonst weiter „50 NM", während
der Schirm auf 10 steht — eine Anzeige, die die eigene Einstellung falsch meldet.

- [ ] **Schritt 3: Flugplatz-Layer in `drawBackground` beachten**

`radar.js:52` von

```js
  if (receiver && airports) drawAirports(ctx, cfg, receiver);
```

ändern auf

```js
  if (receiver && airports && sicht.layer.airports) drawAirports(ctx, receiver, sicht);
```

- [ ] **Schritt 4: Gesamtlauf**

Lauf: `node --test tests/*.mjs 2>&1 | tail -9`
Erwartet: `ℹ tests 188`, `ℹ fail 0` — **unverändert**. Diese Aufgabe verdrahtet nur um; wer
hier eine steigende Zahl erwartet, hat einen Test zuviel geschrieben.

- [ ] **Schritt 5: Commit**

```bash
git add console/js/console.js console/js/pages/radar.js
git commit -m "Ansicht als vierter Parameter -- radar.js liest sie statt der Config"
```

---

### Aufgabe 5: `profile.js` und `polar.js` an die Ansicht koppeln

**Dateien:**
- Ändern: `console/js/pages/profile.js` (`:94`, `:105-112`, `:146`)
- Ändern: `console/js/pages/polar.js` (`:446`, `:454`)
- Ändern: `tests/test_profile.mjs` (anhängen — **der einzige echte Rot-Test**)

**Hinweis:** Dies ist die Aufgabe mit dem einzigen Test, der einen **vorhandenen** Defekt
zeigt statt nur eine neue Funktion abzusichern. Er muß vor der Änderung wirklich rot sein.

- [ ] **Schritt 1: Kopplungstest an `tests/test_profile.mjs` anhängen**

```js
import { mergeConfig } from '../console/js/config.js';
import { erzeugeAnsicht, setzeStufe, gilt } from '../console/js/ansicht.js';
import { profilReichweite } from '../console/js/pages/profile.js';

// Der Seitenriss zeigt dieselben Ziele wie der Radarschirm. Stellt jemand
// die Reichweite auf 10 NM und das Profil rechnet weiter auf 50, dann
// widersprechen sich zwei Seiten desselben Geraets -- und zwar lautlos,
// weil beide fuer sich plausibel aussehen.
test('Hoehenprofil folgt der umgeschalteten Reichweite, nicht der Config', () => {
  const cfg = mergeConfig({});
  const sicht = gilt(setzeStufe(erzeugeAnsicht(), 0), cfg);   // 10 NM
  assert.equal(profilReichweite(cfg, sicht), 10);
  assert.notEqual(profilReichweite(cfg, sicht), cfg.radar.range_nm);
});

test('ohne Umschaltung ist die Profil-Reichweite die konfigurierte', () => {
  const cfg = mergeConfig({});
  assert.equal(profilReichweite(cfg, gilt(erzeugeAnsicht(), cfg)), cfg.radar.range_nm);
});
```

- [ ] **Schritt 2: Lauf zur Bestätigung, daß er fehlschlägt**

Lauf: `node --test tests/test_profile.mjs 2>&1 | tail -9`
Erwartet: FAIL — `profilReichweite is not a function`

- [ ] **Schritt 3: `profile.js` umstellen**

`profilReichweite` exportieren und die Lesestellen darauf umbiegen:

```js
// Eine Stelle, an der die Reichweite des Seitenrisses herkommt. Solange es
// zwei gab (Config hier, Ansicht im Radar), konnten sie auseinanderlaufen.
export function profilReichweite(sicht) {
  return sicht.range_nm;
}
```

> **Korrektur 31.07. (Commit `d37404f`, aus der Prüfung von Aufgabe 5):** Der erste Entwurf
> hatte hier einen Rückfall auf `cfg.radar.range_nm`, falls `sicht` fehlt. Das war ein Fehler:
> `console.js` reicht die Ansicht immer durch, `gilt()` liefert immer eine finite Zahl — der
> Zweig war unerreichbar und ungetestet. Vor allem aber hätte er eine künftig gebrochene
> Weitergabe von `sicht` **lautlos** verdeckt, statt sie sichtbar zu machen: genau die
> Fehlerklasse, gegen die diese Aufgabe gebaut ist. `radar.js` liest an denselben Stellen
> ebenfalls ohne Rückfall. Eine fehlende Ansicht ist ein Verdrahtungsfehler und soll auffallen.

Die Seitenfunktionen nehmen `sicht` als vierten Parameter entgegen. In `:94`, `:105-112` und
`:146` wird `cfg.radar.range_nm` durch `profilReichweite(cfg, sicht)` ersetzt und
`cfg.radar.rings_nm` durch `sicht.rings_nm` (mit `sichtbareRinge` aus Aufgabe 2, das dort
bereits eingebaut ist). Die Zeile `:146` beschriftet mit `außerhalb N NM` — sie muß mitziehen,
sonst nennt die Anzeige eine Zahl, die nicht gilt.

- [ ] **Schritt 4: `polar.js` umstellen**

`polar.js:446` von

```js
    const ringListe = ringe(m.skalaNm, cfg.radar.rings_nm);
```

ändern auf

```js
    const ringListe = ringe(m.skalaNm, sicht.rings_nm);
```

Die Seitenfunktionen nehmen `sicht` als vierten Parameter entgegen. Der Kommentar bei `:382`
bleibt gültig und wird um einen Satz ergänzt: die Kopplung läuft ab jetzt über die Ansicht,
nicht über die Konfiguration.

- [ ] **Schritt 5: Lauf zur Bestätigung, daß er besteht**

Lauf: `node --test tests/test_profile.mjs 2>&1 | tail -9` — erwartet `ℹ fail 0`

- [ ] **Schritt 6: Einmal absichtlich rot sehen**

Im ersten Test die erwartete `10` auf `50` ändern, laufen lassen (FAIL), zurückdrehen.

- [ ] **Schritt 7: Gesamtlauf und Commit**

Lauf: `node --test tests/*.mjs 2>&1 | tail -9` — erwartet `ℹ tests 190`, `ℹ fail 0`

```bash
git add console/js/pages/profile.js console/js/pages/polar.js tests/test_profile.mjs
git commit -m "Hoehenprofil und Reichweite folgen der umgeschalteten Radar-Reichweite"
```

---

### Aufgabe 6: `einstellungen()` auf der Radarseite

**Dateien:**
- Ändern: `console/js/pages/radar.js` (`registerPage`-Objekt erweitern)
- Ändern: `tests/test_radar_geometry.mjs` (anhängen)

**Schnittstellen:**
- Liefert: `radarEinstellungen(cfg, sicht) -> Array<Eintrag>` mit
  `{ kennung: string, beschriftung: string, art: 'auswahl'|'schalter',
  wert: number|boolean, optionen?: Array<{wert: number, text: string}> }`.
  Aufgabe 7 rendert genau diese Form und kennt keine radarspezifischen Felder.

- [ ] **Schritt 1: Test an `tests/test_radar_geometry.mjs` anhängen**

```js
import { radarEinstellungen } from '../console/js/pages/radar.js';
import { mergeConfig } from '../console/js/config.js';
import { erzeugeAnsicht, setzeStufe, schalteLayer, gilt } from '../console/js/ansicht.js';

test('Einstellungen: Reichweitenauswahl bietet genau die konfigurierten Stufen', () => {
  const cfg = mergeConfig({});
  const e = radarEinstellungen(cfg, gilt(erzeugeAnsicht(), cfg));
  const auswahl = e.find(x => x.kennung === 'stufe');
  assert.deepEqual(auswahl.optionen.map(o => o.wert), [0, 1, 2]);
  assert.deepEqual(auswahl.optionen.map(o => o.text), ['10 NM', '50 NM', '80 NM']);
});

test('Einstellungen: der aktuelle Wert ist die aktive Stufe, nicht die Vorgabe', () => {
  const cfg = mergeConfig({});
  const e = radarEinstellungen(cfg, gilt(setzeStufe(erzeugeAnsicht(), 2), cfg));
  assert.equal(e.find(x => x.kennung === 'stufe').wert, 2);
});

test('Einstellungen: der Flugplatz-Schalter spiegelt den Layer-Zustand', () => {
  const cfg = mergeConfig({});
  const aus = gilt(schalteLayer(erzeugeAnsicht(), 'airports', false), cfg);
  assert.equal(radarEinstellungen(cfg, aus).find(x => x.kennung === 'airports').wert, false);
});
```

- [ ] **Schritt 2: Lauf zur Bestätigung, daß er fehlschlägt**

Lauf: `node --test tests/test_radar_geometry.mjs 2>&1 | tail -9`
Erwartet: FAIL — `radarEinstellungen is not a function`

- [ ] **Schritt 3: `radarEinstellungen()` in `radar.js` schreiben**

```js
// Was die Radarseite im Einstellungsdialog anbietet. Bewusst DATEN, keine
// DOM-Bauerei: Der Dialog (console.js) kennt nur diese Form und weiss
// nichts ueber Radar. Spaetere Layer -- Staedte, Sektoren, Luftraeume,
// Anflug- und Holding-Muster -- legen hier einen Eintrag dazu, statt die
// Kopfzeile anzufassen.
export function radarEinstellungen(cfg, sicht) {
  return [
    { kennung: 'stufe', beschriftung: 'Reichweite', art: 'auswahl',
      wert: sicht.stufeIndex,
      optionen: sicht.stufen.map((s, i) => ({ wert: i, text: `${s.range_nm} NM` })) },
    { kennung: 'airports', beschriftung: 'Flugplätze', art: 'schalter',
      wert: sicht.layer.airports },
  ];
}
```

Im `registerPage({ ... })`-Objekt ergänzen:

```js
  einstellungen(cfg, sicht) { return radarEinstellungen(cfg, sicht); },
```

- [ ] **Schritt 4: Lauf zur Bestätigung, daß er besteht**

Lauf: `node --test tests/test_radar_geometry.mjs 2>&1 | tail -9` — erwartet `ℹ fail 0`

- [ ] **Schritt 5: Einmal absichtlich rot sehen**

Im ersten Test `['10 NM', '50 NM', '80 NM']` auf `['10 NM', '50 NM']` ändern, laufen lassen
(FAIL), zurückdrehen.

- [ ] **Schritt 6: Gesamtlauf und Commit**

Lauf: `node --test tests/*.mjs 2>&1 | tail -9` — erwartet `ℹ tests 193`, `ℹ fail 0`

```bash
git add console/js/pages/radar.js tests/test_radar_geometry.mjs
git commit -m "radarEinstellungen(): der Dialog bekommt Daten, keine DOM-Bauerei"
```

---

### Aufgabe 7: Zahnrad und Dialog

**Dateien:**
- Ändern: `console/index.html` (Zahnrad und Overlay im Kopf)
- Ändern: `console/js/console.js` (Dialog auf- und zubauen)
- Ändern: `console/css/console.css` (anhängen)

**Schnittstellen:**
- Verbraucht: `page.einstellungen(config, sicht)` aus Aufgabe 6; `ansichtAendern(fn)` und
  `setzeStufe`/`schalteLayer` aus Aufgabe 4 bzw. 1

**Nicht verhandelbar** (Spec 8):
- Der Dialog liegt als Overlay **neben** `#stage`, nicht darin — der `pointerup`-Handler auf
  `stage` (`console.js:158`) läse Tipps im Dialog sonst als Wischversuche mit.
- **Kein neuer Zeitgeber.** Öffnen und jede Bedienung melden eine Berührung über
  `ansichtAendern` bzw. `planeWechsel('beruehrung')`. Wechselt das Karussell weiter, schließt
  sich der Dialog. Damit kann er per Konstruktion nicht offen steckenbleiben.
- Das Zahnrad erscheint **nur**, wenn die sichtbare Seite `einstellungen()` anbietet.

- [ ] **Schritt 1: Kopf und Overlay in `console/index.html`**

In `#head` vor `<div id="clock">` einfügen:

```html
      <button id="cog" hidden aria-label="Einstellungen">⚙</button>
```

Nach `<div id="dots"></div>` einfügen:

```html
    <div id="settings" hidden></div>
```

- [ ] **Schritt 2: Dialog in `console.js` bauen**

Import ergänzen: `import { erzeugeAnsicht, gilt, setzeStufe, schalteLayer } from './ansicht.js';`

In `startConsole()` einfügen:

```js
  const cog = document.getElementById('cog');
  const panel = document.getElementById('settings');

  // Zahnrad nur, wo es etwas zu stellen gibt. Ein Knopf, der auf fuenf von
  // sieben Seiten nichts tut, ist schlimmer als keiner.
  function zeigeZahnrad() {
    const page = pages.get(order[current]);
    cog.hidden = !(page && typeof page.einstellungen === 'function');
    if (cog.hidden) schliesseDialog();
  }

  function schliesseDialog() { panel.hidden = true; panel.innerHTML = ''; }

  function baueDialog() {
    const page = pages.get(order[current]);
    let eintraege;
    try {
      eintraege = page.einstellungen(config, gilt(ansicht, config));
    } catch (_) {
      // Eine Seite, deren Einstellungen werfen, darf die Konsole nicht
      // anhalten -- dieselbe Haltung wie das finally in goTo().
      cog.hidden = true; schliesseDialog(); return;
    }
    panel.innerHTML = eintraege.map(e => e.art === 'auswahl'
      ? `<div class="setzeile"><span>${e.beschriftung}</span><span class="segmente">${
          e.optionen.map(o => `<button data-k="${e.kennung}" data-w="${o.wert}"${
            o.wert === e.wert ? ' class="an"' : ''}>${o.text}</button>`).join('')
        }</span></div>`
      : `<div class="setzeile"><span>${e.beschriftung}</span><button data-k="${e.kennung}"
           data-w="${e.wert ? 'aus' : 'an'}" class="schalter${e.wert ? ' an' : ''}">${
           e.wert ? 'an' : 'aus'}</button></div>`).join('');
    panel.hidden = false;
  }

  cog.addEventListener('pointerup', e => {
    e.stopPropagation();
    if (panel.hidden) baueDialog(); else schliesseDialog();
    planeWechsel('beruehrung');
  });

  panel.addEventListener('pointerup', e => {
    e.stopPropagation();
    const b = e.target.closest('button');
    if (!b) { planeWechsel('beruehrung'); return; }
    const k = b.dataset.k, w = b.dataset.w;
    ansichtAendern(z => k === 'stufe' ? setzeStufe(z, Number(w))
                                      : schalteLayer(z, k, w === 'an'));
    baueDialog();
  });
```

In `goTo()` innerhalb des `if (next !== current)`-Blocks nach `betrete(current);` einfügen:

```js
        schliesseDialog();
        zeigeZahnrad();
```

Und vor `planeWechsel('automatisch');` am Ende von `startConsole()`: `zeigeZahnrad();`

- [ ] **Schritt 3: CSS an `console/css/console.css` anhängen**

```css
#cog { background: none; border: 0; color: var(--slate, #7f93a8); font-size: 22px;
       line-height: 1; padding: 0 10px; cursor: pointer; }
#cog[hidden] { display: none; }
#settings { position: absolute; top: 56px; right: 12px; z-index: 20;
            background: #0d1620; border: 1px solid #24425c; border-radius: 6px;
            padding: 10px 12px; min-width: 320px; }
#settings[hidden] { display: none; }
.setzeile { display: flex; align-items: center; justify-content: space-between;
            gap: 18px; padding: 7px 0; font-size: 17px; }
.segmente button, .schalter { background: #16273a; border: 1px solid #24425c;
            color: #b7c8d8; font: inherit; padding: 5px 11px; cursor: pointer; }
.segmente button:first-child { border-radius: 4px 0 0 4px; }
.segmente button:last-child { border-radius: 0 4px 4px 0; }
.schalter { border-radius: 4px; min-width: 62px; }
.segmente button.an, .schalter.an { background: #1d4f74; color: #eaf4ff; }
```

- [ ] **Schritt 4: Gesamtlauf**

Lauf: `node --test tests/*.mjs 2>&1 | tail -9`
Erwartet: `ℹ tests 193`, `ℹ fail 0` — **unverändert**. Der Dialog ist DOM und wird am Gerät
geprüft, nicht durch eine Attrappe (globale Randbedingung).

- [ ] **Schritt 5: Commit**

```bash
git add console/index.html console/js/console.js console/css/console.css
git commit -m "Zahnrad und Einstellungsdialog -- ohne zweiten Zeitgeber"
```

---

### Aufgabe 8: Abnahme am Gerät — **Controller, nicht Subagent**

**Dateien:**
- Erstellen: `docs/abnahme/2026-07-31-radar-ansicht.md`

**Diese Aufgabe wird nicht an einen Subagenten vergeben.** Sie faßt das produktive
Feeder-Gerät an.

- [ ] **Schritt 1: Den Ring-Überstand sehen, BEVOR er behoben ist**

Der einzige echte Vorher-Nachweis für Defekt 4.4. Auf einer **eingefrorenen Kopie** des heute
ausgelieferten Standes (nicht am produktiven Pfad), Reichweite in `console.json` auf 10 NM
stellen, Seite laden, `grim`-Bild ziehen. Erwartet: zwei Ringe außerhalb des Kreises.
Bild ins Abnahmedokument.

- [ ] **Schritt 2: Ausrollen aus dem vorgesehenen Spiegel**

Aus `/home/pi/adsb-console` gemäß README — **nicht** aus einem `/tmp`-Baum. Der Befund vom
30.07.2026: Der dortige Baum war vom 27.07. und ein Lauf von dort hätte die Konsole zwei
Stufen zurückgesetzt.

- [ ] **Schritt 3: Bedienung prüfen, inklusive Rückweg**

- Zahnrad öffnen, Reichweite auf 10 NM, **und wieder auf 50 zurück**
- Flugplätze aus, **und wieder an**
- Dialog offen lassen und 60 Sekunden warten: Das Karussell muß weiterlaufen und ihn schließen
- Zwei schnelle Umschaltungen hintereinander
- Wischen, während der Dialog offen ist
- Radarseite verlassen: Zahnrad muß verschwinden

- [ ] **Schritt 4: Der eigene Verdachtspunkt — umschalten, während die Keule läuft**

Die Blips bleiben stehen, der Hintergrund wird neu gebaut, und `setPhase` (`radar.js:261`)
rechnet gegen `sweepStart`. `grim`-**Reihe über einen Umlauf** (nicht eine Momentaufnahme) und
prüfen, ob die Blips weiter unter der Keule aufleuchten. Genau die Fehlerklasse vom 27.07.

- [ ] **Schritt 5: Höhenprofil und Reichweite-Seite gegenprüfen**

Reichweite auf 10 stellen, dann durchs Karussell: Der Seitenriß muß 10 NM beschriften, die
Reichweite-Seite ihre inneren Ringe entsprechend setzen. Zwei Seiten, die sich widersprechen,
wären der Defekt, gegen den Aufgabe 5 gebaut ist.

- [ ] **Schritt 6: Wärme**

Über mindestens 30 Minuten mitschreiben. Greift die Signatur nicht, zeichnet der Hintergrund
sekündlich neu — das wäre hier zu sehen. Die Konsole liegt im Ausgangszustand bereits über dem
72-°C-Kriterium; **das ist ein Meßpunkt, kein Argument.**

- [ ] **Schritt 7: Abnahmedokument schreiben und committen**

Mit Zahlen und Bildern, nicht mit Behauptungen. Es enthält ausdrücklich das **rote** Ergebnis
aus Schritt 1 und dem Kopplungstest aus Aufgabe 5.

```bash
git add docs/abnahme/2026-07-31-radar-ansicht.md
git commit -m "Abnahme Radar-Ansicht: am Geraet gemessen"
```

---

## Nicht Teil dieses Plans

- **Fotosession mit synthetischer Quelle** (Spec 3.3) — eigener Block. Vorher ist Spec 11 zu
  messen: ob eine statische Quelle die Frischeanzeige überlebt.
- **Zielauswahl per Berührung** (Projekt B) — eigene Entwurfssitzung.
- **Weitere Layer und Karten-Ebenen** (Projekt C) — eigene Entwurfssitzung. Der Anschlußpunkt
  ist `einstellungen()` aus Aufgabe 6 und `LAYER` aus Aufgabe 1.
