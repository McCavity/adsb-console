# ATC-Konsole Stufe 2 — Umsetzungsplan

> **Für agentische Bearbeiter:** ERFORDERLICHE SUB-SKILL: `superpowers:subagent-driven-development`
> (empfohlen) oder `superpowers:executing-plans`, um diesen Plan Aufgabe für Aufgabe
> abzuarbeiten. Die Schritte tragen Kästchen (`- [ ]`) zur Verfolgung.

**Ziel:** Die drei fehlenden Seiten der ATC-Konsole (Einzelziel, Höhenprofil, System) bauen
und die zehn vertagten Punkte aus dem Schluß-Review der Stufe 1 abräumen.

**Architektur:** Reines Statik-Frontend, ES-Module ohne Bündler. Jede Seite ist ein Modul
unter `console/js/pages/`, das sich über `registerPage()` bei `console.js` anmeldet und
`{id, title, ageSource, mount, render}` liefert; dieser Vertrag bekommt ein optionales
`onEnter`. **Jede rechnende Regel wird als reine, exportierte Funktion aus dem DOM
herausgezogen und dort getestet** — das ist die tragende Lehre aus Stufe 1, wo vierzehn
Befunde auftraten und kein einziger von der Testsuite kam.

**Tech-Stack:** ES-Module, `node --test` für JavaScript, Python-Standardbibliothek für den
Daemon (in diesem Plan unverändert), CSS ohne Präprozessor.

**Maßgebliche Dokumente:**
- Entwurf Stufe 2: [`docs/specs/2026-07-28-stufe-2-entwurf.md`](../specs/2026-07-28-stufe-2-entwurf.md)
- Hauptentwurf: [`docs/specs/2026-07-27-atc-konsole-design.md`](../specs/2026-07-27-atc-konsole-design.md)
- Abnahme Stufe 1: [`docs/abnahme/2026-07-27-stufe-1.md`](../abnahme/2026-07-27-stufe-1.md)

## Globale Randbedingungen

Diese gelten für **jede** Aufgabe, auch wo sie nicht wiederholt werden.

- **Keine Fremdquelle zur Laufzeit.** Kein CDN, keine Kartenkacheln, keine externe
  Bibliothek. Wird bei der Abnahme durch Ziehen des Netzsteckers geprüft.
- **Die exakte Empfängerposition gehört nicht ins Repo** — kein Testfixture, kein
  Beispiel-Config, kein Kommentar, auch keine gerundete Fassung. Tests verwenden die
  erfundene Position `50.0 / 9.0`.
- **Kein Umbau am ADS-B-Stack.** Weder `dump1090-fa`, noch die Feeder, noch die
  lighttpd-Konfiguration.
- **Fehlende Werte sind `null` bzw. ein Gedankenstrich `—`, niemals `0`.** Eine 0 meldet
  einen gemessenen Zustand.
- **Nur ES-Module, keine externe Bibliothek, keine DOM-Testumgebung.** Was nur im Browser
  läuft, wird am Gerät geprüft, nicht durch eine Attrappe.
- **Testlauf ist immer `node --test tests/*.mjs`** — **mit Dateimuster, nie blank.** Ein
  blankes `node --test` findet in diesem Repo keine Datei und meldet trotzdem `fail 0`.
  **Gelesen wird die Zeile `ℹ tests N`, nicht nur `ℹ fail 0`.** Null Fehler bei null Tests
  ist kein Ergebnis.
- **Ausgangswert am 28.07.2026: `ℹ tests 41`, `ℹ fail 0`** (Node v26.3.1). Jede Aufgabe
  nennt, um wieviel diese Zahl steigen muß. Steigt sie nicht, ist die Testdatei nicht
  gelaufen — unabhängig davon, was `fail` sagt.
- **Die Zusammenfassung mit `tail` lesen, nicht mit einem `grep`-Muster auf `#`.** Dieses
  Node stellt den Zeilen `ℹ` voran, ältere Fassungen und der TAP-Reporter ein `#`. Ein
  `grep '^# tests'` gibt hier **nichts** aus und sieht aus wie ein stiller Erfolg — beim
  Schreiben dieses Plans genau so passiert. Verläßlich ist:

  ```bash
  node --test tests/*.mjs 2>&1 | tail -9
  ```
- **Jeder neue Test wird einmal absichtlich rot gesehen**, bevor ihm geglaubt wird. Die
  Schritte dafür stehen ausgeschrieben in jeder Aufgabe.
- **Anzeigesprache Deutsch**, Fachbegriffe englisch (Squawk, Track, FL, Heavy). Einheiten
  nautisch: NM, Knoten, Flugfläche.
- **`get_throttled` hat zwei Hälften** — Bits 0–3 „jetzt", Bits 16–19 „seit dem Boot".
  Sie bleiben in Daten und Anzeige getrennt.
- **Nichts scrollt.** Was auf 1280 × 720 nicht paßt, ist ein Layoutfehler.
- **Subagenten führen keine `sudo`-Befehle auf `adsapp01` aus.** Alles, was das produktive
  Feeder-Gerät anfaßt, macht der Controller in der Hauptsitzung.
- **Branch:** `session/2026-07-28-atc-konsole-stufe-2`. Am Ende ein PR, kein Direktmerge.

## Dateiübersicht

| Datei | Verantwortung | Aufgabe |
|---|---|---|
| `console/js/data.js` | Abrufschleifen; **neu:** `pruefeReceiver()`, `refreshSystem` | 1, 8 |
| `console/js/geo.js` | reine Rechenfunktionen; **neu:** `waehleDatenblattZiel()` | 4 |
| `console/js/console.js` | Karussell und Seitenvertrag; **neu:** `onEnter`-Haken | 5 |
| `console/js/pages/gemeinsam.js` | **neu** — `msgRate()`, später `leerUntertitel()`; von vier Seiten benutzt | 5, 10 |
| `console/js/pages/board.js` | Zielliste; `splitTargets` bekommt `highlight` | 2, 5, 10 |
| `console/js/pages/target.js` | **neu** — Einzelziel, mit `datenblattFelder()` | 5 |
| `console/js/pages/profile.js` | **neu** — Höhenprofil, mit `hoehenprofil()` | 6, 7 |
| `console/js/pages/system.js` | **neu** — Systemseite, mit `systemFelder()` | 8 |
| `console/js/pages/radar.js` | Radar; Schriftladen vor dem Hintergrund | 9 |
| `console/css/console.css` | Kachelklassen werden allgemein; neue Seitenlayouts | 5, 7, 8, 9, 10 |
| `console/fonts/` | **neu** — B612Mono + Lizenztexte | 9 |
| `console/index.html` | registriert die drei neuen Seiten | 5, 7, 8 |
| `tests/test_data.mjs` | **neu** | 1 |
| `tests/test_geo.mjs` | EDDF-Test, `waehleDatenblattZiel` | 3, 4 |
| `tests/test_board.mjs` | `highlight`-Schalter | 2 |
| `tests/test_target.mjs` | **neu** | 5 |
| `tests/test_profile.mjs` | **neu** | 6 |
| `tests/test_system.mjs` | **neu** | 8 |
| `install-console.sh` | `fonts-noto-color-emoji` raus | 11 |
| `docs/` und `CLAUDE.md` | Nachzug aller korrigierten Zusagen | 11 |

---

### Aufgabe 1: `pruefeReceiver` — die ungeprüfte Empfängerposition

Heute übernimmt `data.js` jedes truthy `receiver.json` ungeprüft. Steht dort ein String
statt einer Zahl, wird **jede** Entfernungsangabe der ganzen Konsole zu `NaN` — sichtbar
erst am Panel, von keinem Test gefangen.

**Dateien:**
- Ändern: `console/js/data.js:66-72`
- Erstellen: `tests/test_data.mjs`

**Schnittstellen:**
- Erzeugt: `pruefeReceiver(doc) → {lat, lon} | null` — export aus `console/js/data.js`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

Neue Datei `tests/test_data.mjs`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { pruefeReceiver } from '../console/js/data.js';

test('gueltige Position wird uebernommen', () => {
  assert.deepEqual(pruefeReceiver({ lat: 50.0, lon: 9.0 }), { lat: 50.0, lon: 9.0 });
});

test('Text statt Zahl ergibt null, nicht NaN in jeder Entfernung', () => {
  assert.equal(pruefeReceiver({ lat: '50.0', lon: 9.0 }), null);
  assert.equal(pruefeReceiver({ lat: 50.0, lon: '9.0' }), null);
});

test('fehlender Schluessel ergibt null', () => {
  assert.equal(pruefeReceiver({ lat: 50.0 }), null);
});

test('NaN und Unendlich ergeben null', () => {
  assert.equal(pruefeReceiver({ lat: NaN, lon: 9.0 }), null);
  assert.equal(pruefeReceiver({ lat: 50.0, lon: Infinity }), null);
});

test('Werte ausserhalb des Wertebereichs ergeben null', () => {
  assert.equal(pruefeReceiver({ lat: 91, lon: 9.0 }), null);
  assert.equal(pruefeReceiver({ lat: 50.0, lon: 181 }), null);
});

test('kein Dokument, Array oder String ergibt null', () => {
  assert.equal(pruefeReceiver(null), null);
  assert.equal(pruefeReceiver(undefined), null);
  assert.equal(pruefeReceiver([50.0, 9.0]), null);
  assert.equal(pruefeReceiver('50.0,9.0'), null);
});

test('die Grenzwerte selbst sind gueltig', () => {
  assert.deepEqual(pruefeReceiver({ lat: 90, lon: 180 }), { lat: 90, lon: 180 });
  assert.deepEqual(pruefeReceiver({ lat: -90, lon: -180 }), { lat: -90, lon: -180 });
});
```

- [ ] **Schritt 2: Testlauf, der fehlschlagen muß**

Ausführen: `node --test tests/test_data.mjs`
Erwartet: FAIL mit `SyntaxError: The requested module '../console/js/data.js' does not provide an export named 'pruefeReceiver'`

- [ ] **Schritt 3: Die Funktion schreiben**

In `console/js/data.js`, direkt vor `export function createDataStore(onUpdate) {` einfügen:

```javascript
// Jedes truthy receiver.json wurde bisher ungeprueft uebernommen. Ein
// Textwert statt einer Zahl macht damit JEDE Entfernungsangabe der Konsole
// zu NaN -- lautlos, und sichtbar erst am Panel. Array wird ausdruecklich
// abgewiesen: typeof [] ist "object", und [50,9].lat ist undefined.
export function pruefeReceiver(doc) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return null;
  const { lat, lon } = doc;
  if (typeof lat !== 'number' || !Number.isFinite(lat) || Math.abs(lat) > 90) return null;
  if (typeof lon !== 'number' || !Number.isFinite(lon) || Math.abs(lon) > 180) return null;
  return { lat, lon };
}
```

- [ ] **Schritt 4: Testlauf, der grün sein muß**

Ausführen: `node --test tests/test_data.mjs`
Erwartet: PASS, `ℹ tests 7`, `ℹ fail 0`

- [ ] **Schritt 5: Den Test einmal absichtlich rot sehen**

Ändern in `pruefeReceiver` vorübergehend `Math.abs(lat) > 90` zu `Math.abs(lat) > 900`.
Ausführen: `node --test tests/test_data.mjs`
Erwartet: FAIL in `Werte ausserhalb des Wertebereichs ergeben null`.
**Danach die Änderung zurücknehmen** und Schritt 4 wiederholen.

- [ ] **Schritt 6: In `createDataStore` benutzen**

In `console/js/data.js` in der Funktion `start()` die beiden Zeilen

```javascript
    const r = await getJSON(DATA + 'receiver.json');
    if (r) state.receiver = { lat: r.lat, lon: r.lon };
```

ersetzen durch:

```javascript
    state.receiver = pruefeReceiver(await getJSON(DATA + 'receiver.json'));
```

- [ ] **Schritt 7: Vollständiger Testlauf**

Ausführen: `node --test tests/*.mjs`
Erwartet: `ℹ fail 0` und **`ℹ tests` mindestens 7 höher als vorher.** Die Zahl notieren —
sie ist ab hier der Bezugswert.

- [ ] **Schritt 8: Commit**

```bash
git add console/js/data.js tests/test_data.mjs
git commit -m "receiver.json wird geprueft: Text statt Zahl ergibt null, nicht NaN"
```

---

### Aufgabe 2: `emergency.highlight` wirkt auch im Board

`cfg.emergency.highlight` ist nur im Radar verdrahtet. `false` schaltet heute das Radar
stumm und läßt das Board rot — ein Schalter, der die halbe Konsole schaltet.

**Dateien:**
- Ändern: `console/js/pages/board.js:5-31` (Signatur) und `:44` (Aufruf)
- Ändern: `tests/test_board.mjs`

**Schnittstellen:**
- Verbraucht: nichts aus früheren Aufgaben
- Erzeugt: `splitTargets(aircraft, receiver, highlight = true) → {positioned, unpositioned}` —
  dritter Parameter neu, Vorgabewert `true` hält bestehende Aufrufer grün

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

An das Ende von `tests/test_board.mjs` anhängen:

```javascript
test('highlight=false schaltet auch das Board stumm', () => {
  const ac = [{ hex: 'aaa111', flight: 'DLH123  ', squawk: '7700',
                lat: 50.1, lon: 9.1, alt_baro: 30000 }];
  const rcv = { lat: 50.0, lon: 9.0 };
  assert.equal(splitTargets(ac, rcv, true).positioned[0].emergency, true);
  assert.equal(splitTargets(ac, rcv, false).positioned[0].emergency, false);
});

test('highlight=false wirkt auch auf Ziele ohne Position', () => {
  const ac = [{ hex: 'bbb222', flight: 'AFR9   ', squawk: '7600', alt_baro: 12000 }];
  assert.equal(splitTargets(ac, null, true).unpositioned[0].emergency, true);
  assert.equal(splitTargets(ac, null, false).unpositioned[0].emergency, false);
});

test('ohne dritten Parameter bleibt die Markierung an', () => {
  const ac = [{ hex: 'ccc333', squawk: '7500', alt_baro: 9000 }];
  assert.equal(splitTargets(ac, null).unpositioned[0].emergency, true);
});
```

- [ ] **Schritt 2: Testlauf, der fehlschlagen muß**

Ausführen: `node --test tests/test_board.mjs`
Erwartet: FAIL in `highlight=false schaltet auch das Board stumm` mit
`Expected values to be strictly equal: true !== false`

- [ ] **Schritt 3: Signatur erweitern**

In `console/js/pages/board.js` Zeile 5 ändern von

```javascript
export function splitTargets(aircraft, receiver) {
```

zu

```javascript
// highlight kommt aus cfg.emergency.highlight. Der Schalter muss ALLE
// Anzeigen stummschalten, nicht nur das Radar -- sonst schaltet er die
// halbe Konsole. Vorgabewert true, damit ein Aufrufer ohne Konfiguration
// (etwa ein Test) die Markierung sieht.
export function splitTargets(aircraft, receiver, highlight = true) {
```

und Zeile 18 von

```javascript
      emergency: isEmergency(a),
```

zu

```javascript
      emergency: highlight && isEmergency(a),
```

- [ ] **Schritt 4: Aufruf in `render` nachziehen**

In `console/js/pages/board.js` in `render` die Zeile

```javascript
    const { positioned, unpositioned } = splitTargets(state.aircraft, state.receiver);
```

ersetzen durch:

```javascript
    const { positioned, unpositioned } =
      splitTargets(state.aircraft, state.receiver, cfg.emergency.highlight);
```

- [ ] **Schritt 5: Testlauf, der grün sein muß**

Ausführen: `node --test tests/test_board.mjs`
Erwartet: PASS, `ℹ fail 0`

- [ ] **Schritt 6: Den Test einmal absichtlich rot sehen**

Ändern in `splitTargets` vorübergehend `highlight && isEmergency(a)` zu `isEmergency(a)`.
Ausführen: `node --test tests/test_board.mjs`
Erwartet: FAIL in beiden neuen `highlight=false`-Tests.
**Danach zurücknehmen** und Schritt 5 wiederholen.

- [ ] **Schritt 7: Commit**

```bash
git add console/js/pages/board.js tests/test_board.mjs
git commit -m "emergency.highlight schaltet auch das Board stumm, nicht nur das Radar"
```

---

### Aufgabe 3: Der Test, den §10.2 verspricht und den es nicht gibt

§10.2 des Hauptentwurfs sagt zu: „kalibriert an einer Wahrheit, die unabhängig vom Code
feststeht: eine bekannte Großkreis-Strecke **und die Entfernung Empfänger→EDDF**, letztere
mit erfundener Empfängerposition". Die Großkreis-Tests gibt es; den EDDF-Test nicht.

Diese Aufgabe ändert **keinen** Produktivcode. Sie schließt eine Zusage.

**Dateien:**
- Ändern: `tests/test_geo.mjs`

**Schnittstellen:**
- Verbraucht: `haversineNm`, `bearingDeg`, `formatBearing` aus `console/js/geo.js`
- Erzeugt: nichts

- [ ] **Schritt 1: Den Test schreiben**

An das Ende von `tests/test_geo.mjs` anhängen:

```javascript
// Die Empfaengerposition hier ist ERFUNDEN (50.0 N / 9.0 E, ein runder
// Punkt oestlich des Rhein-Main-Gebiets) und hat mit der tatsaechlichen
// nichts zu tun -- die gehoert nicht ins Repo, auch nicht gerundet.
// EDDF ist oeffentliche Infrastruktur und darf hier stehen.
//
// Der Sollwert ist von Hand nachrechenbar und damit unabhaengig vom Code:
// Bei 50 Grad Nord ist ein Laengengrad 60 * cos(50 Grad) = 38,57 NM breit.
// 0,4378 Grad Laengendifferenz sind also 16,88 NM, dazu 0,0379 Grad
// Breitendifferenz = 2,27 NM. Pythagoras: sqrt(16,88^2 + 2,27^2) = 17,03 NM.
const EMPF = { lat: 50.0, lon: 9.0 };
const EDDF = { lat: 50.0379, lon: 8.5622 };

test('Entfernung erfundener Empfaenger nach EDDF', () => {
  const nm = haversineNm(EMPF.lat, EMPF.lon, EDDF.lat, EDDF.lon);
  assert.ok(Math.abs(nm - 17.042) < 0.01, `erwartet ~17,042 NM, war ${nm}`);
});

test('EDDF liegt von dort aus knapp noerdlich von West', () => {
  const brg = bearingDeg(EMPF.lat, EMPF.lon, EDDF.lat, EDDF.lon);
  assert.equal(formatBearing(brg), '278°');
});

test('Gegenprobe: der Rueckweg ist gleich lang', () => {
  const hin = haversineNm(EMPF.lat, EMPF.lon, EDDF.lat, EDDF.lon);
  const zurueck = haversineNm(EDDF.lat, EDDF.lon, EMPF.lat, EMPF.lon);
  assert.ok(Math.abs(hin - zurueck) < 1e-9);
});
```

**Wichtig:** Prüfen, ob `bearingDeg` und `formatBearing` im `import` am Dateikopf von
`tests/test_geo.mjs` schon aufgeführt sind. Falls nicht, dort ergänzen.

- [ ] **Schritt 2: Testlauf, der grün sein muß**

Ausführen: `node --test tests/test_geo.mjs`
Erwartet: PASS, `ℹ fail 0`

Dieser Test ist von Anfang an grün — er prüft bestehenden, korrekten Code. Genau deshalb
ist Schritt 3 hier nicht optional, sondern der einzige Beleg, daß er überhaupt etwas mißt.

- [ ] **Schritt 3: Den Test einmal absichtlich rot sehen**

Ändern in `console/js/geo.js` vorübergehend `const R_NM = 3440.065;` zu `3400.0`.
Ausführen: `node --test tests/test_geo.mjs`
Erwartet: FAIL in `Entfernung erfundener Empfaenger nach EDDF` mit einem Wert um 16,84.
**Danach zurücknehmen** und Schritt 2 wiederholen.

- [ ] **Schritt 4: Keine Koordinate ist ins Repo gerutscht**

Ausführen:

```bash
grep -rnE '\b50\.1[0-9]|\b8\.7[0-9]' tests/ console/ daemon/ config/ docs/
```

Erwartet: **keine Ausgabe.** Jeder Treffer ist ein Abbruchgrund und wird gemeldet, nicht
selbst behoben.

- [ ] **Schritt 5: Commit**

```bash
git add tests/test_geo.mjs
git commit -m "Empfaenger-EDDF-Test nachgeholt: die offene Zusage aus Spec 10.2"
```

---

### Aufgabe 4: `waehleDatenblattZiel` — die Auswahlregel der Einzelziel-Seite

Die Regel des Radar-Datenblocks läuft im Sekundentakt. Als eigene Seite mit 15 s Standzeit
und einem Callsign in 78 px ist das ein Fehler: Zwei Ziele bei 12,3 und 12,4 NM tauschen im
Sekundentakt.

**Dateien:**
- Ändern: `console/js/geo.js` (anhängen)
- Ändern: `tests/test_geo.mjs` (anhängen)

**Schnittstellen:**
- Erzeugt: `waehleDatenblattZiel(kandidaten, bisher) → kandidat | null` — export aus
  `console/js/geo.js`. `kandidaten` sind bereits angereicherte Ziele mit mindestens
  `{hex: string, nm: number, emergency: boolean}`. `bisher` ist das zuletzt gewählte
  Objekt oder `null`. Rückgabe ist **immer ein Element aus `kandidaten`**, nie `bisher`
  selbst — sonst zeigte die Seite eingefrorene Werte statt eines eingefrorenen Ziels.

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

An das Ende von `tests/test_geo.mjs` anhängen:

```javascript
const ziel = (hex, nm, emergency = false) => ({ hex, nm, emergency });

test('leere Liste ergibt null', () => {
  assert.equal(waehleDatenblattZiel([], null), null);
  assert.equal(waehleDatenblattZiel(null, null), null);
});

test('ohne Vorgaenger gewinnt das naechstgelegene Ziel', () => {
  const liste = [ziel('a', 30), ziel('b', 12.3), ziel('c', 18)];
  assert.equal(waehleDatenblattZiel(liste, null).hex, 'b');
});

test('das eingefrorene Ziel bleibt, auch wenn ein naeheres auftaucht', () => {
  const liste = [ziel('a', 4.0), ziel('b', 12.4)];
  assert.equal(waehleDatenblattZiel(liste, ziel('b', 12.3)).hex, 'b');
});

test('das eingefrorene Ziel liefert die FRISCHEN Werte, nicht die alten', () => {
  const frisch = ziel('b', 12.4);
  const ergebnis = waehleDatenblattZiel([ziel('a', 4.0), frisch], ziel('b', 12.3));
  assert.equal(ergebnis.nm, 12.4);
  assert.equal(ergebnis, frisch);
});

test('verschwundenes Ziel wird durch das naechstgelegene ersetzt', () => {
  const liste = [ziel('a', 30), ziel('c', 18)];
  assert.equal(waehleDatenblattZiel(liste, ziel('b', 12.3)).hex, 'c');
});

test('Notfall uebersteuert das eingefrorene Ziel', () => {
  const liste = [ziel('a', 4.0), ziel('b', 12.3), ziel('n', 40, true)];
  assert.equal(waehleDatenblattZiel(liste, ziel('b', 12.3)).hex, 'n');
});

test('bei mehreren Notfaellen gewinnt der naechstgelegene', () => {
  const liste = [ziel('n1', 40, true), ziel('n2', 9, true), ziel('a', 2)];
  assert.equal(waehleDatenblattZiel(liste, null).hex, 'n2');
});

test('Kandidaten ohne brauchbare Entfernung werden uebergangen', () => {
  const liste = [{ hex: 'x', nm: null, emergency: false }, ziel('b', 12.3)];
  assert.equal(waehleDatenblattZiel(liste, null).hex, 'b');
});
```

**Wichtig:** `waehleDatenblattZiel` in den `import` am Dateikopf von `tests/test_geo.mjs`
aufnehmen.

- [ ] **Schritt 2: Testlauf, der fehlschlagen muß**

Ausführen: `node --test tests/test_geo.mjs`
Erwartet: FAIL mit `does not provide an export named 'waehleDatenblattZiel'`

- [ ] **Schritt 3: Die Funktion schreiben**

An das Ende von `console/js/geo.js` anhängen:

```javascript
// Welches Ziel steht auf der Einzelziel-Seite? Anders als der Datenblock
// neben dem Radarschirm haelt diese Seite ihr Ziel fest, solange sie steht:
// Zwei Ziele bei 12,3 und 12,4 NM wuerden sonst im Sekundentakt tauschen,
// und ein Datenblatt, dessen Gegenstand springt, ist unlesbar.
//
// Zurueckgegeben wird IMMER ein Element aus kandidaten, niemals bisher
// selbst -- sonst zeigte die Seite eingefrorene WERTE statt eines
// eingefrorenen ZIELS.
//
// Der Rueckweg ist absichtlich asymmetrisch: Verschwindet der
// Notfall-Squawk wieder, springt die Seite nicht zurueck. Das Ziel steht
// dann noch in kandidaten, also greift Regel 2.
export function waehleDatenblattZiel(kandidaten, bisher) {
  const liste = Array.isArray(kandidaten)
    ? kandidaten.filter(t => t && typeof t.nm === 'number' && Number.isFinite(t.nm))
    : [];
  if (!liste.length) return null;
  const naechster = menge => menge.reduce((a, b) => (b.nm < a.nm ? b : a));
  const notfaelle = liste.filter(t => t.emergency);
  if (notfaelle.length) return naechster(notfaelle);
  if (bisher && bisher.hex) {
    const weiterhin = liste.find(t => t.hex === bisher.hex);
    if (weiterhin) return weiterhin;
  }
  return naechster(liste);
}
```

- [ ] **Schritt 4: Testlauf, der grün sein muß**

Ausführen: `node --test tests/test_geo.mjs`
Erwartet: PASS, `ℹ fail 0`

- [ ] **Schritt 5: Den Test einmal absichtlich rot sehen**

Ändern vorübergehend `if (notfaelle.length) return naechster(notfaelle);` zu
`if (false) return naechster(notfaelle);`.
Ausführen: `node --test tests/test_geo.mjs`
Erwartet: FAIL in `Notfall uebersteuert das eingefrorene Ziel` und
`bei mehreren Notfaellen gewinnt der naechstgelegene`.
**Danach zurücknehmen** und Schritt 4 wiederholen.

- [ ] **Schritt 6: Commit**

```bash
git add console/js/geo.js tests/test_geo.mjs
git commit -m "waehleDatenblattZiel: Auswahlregel als reine Funktion, ohne DOM"
```

---

### Aufgabe 5: Einzelziel-Seite samt `onEnter`-Haken

Ersetzt §6.3 des Hauptentwurfs. Die Seite zeigt, was der Radarkreis grundsätzlich nicht
zeigen kann — nicht dasselbe größer.

Der `onEnter`-Haken entsteht hier, weil diese Seite sein erster Verbraucher ist. Er faßt
die am Panel abgenommene Karussell-Logik an; deshalb steht die Geräteprüfung in dieser
Aufgabe und nicht erst am Ende.

**Dateien:**
- Ändern: `console/js/console.js:5`, `:40-47`, `:71-81`, `:132-138`
- Erstellen: `console/js/pages/target.js`
- Ändern: `console/css/console.css` (Kachelklassen allgemein machen, Datenblatt-Layout)
- Ändern: `console/index.html:25`
- Erstellen: `tests/test_target.mjs`

**Schnittstellen:**
- Verbraucht: `waehleDatenblattZiel` aus Aufgabe 4; `haversineNm`, `bearingDeg`,
  `formatBearing`, `formatCallsign`, `flightLevel`, `isEmergency` aus `geo.js`
- Erzeugt:
  - `kandidatenAusZielen(aircraft, receiver, highlight) → Array<{hex, nm, brg, callsign, emergency, roh}>`
  - `datenblattFelder(t) → {kopf, gruppen}` mit `kopf = {name, istHex, heavy, squawk, emergency}`
    und `gruppen = Array<{titel: string, zeilen: Array<[label, wert, einheit]>}>`
  - `registerPage`-Vertrag um optionales `onEnter(el, config, state)` erweitert

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

Neue Datei `tests/test_target.mjs`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { kandidatenAusZielen, datenblattFelder } from '../console/js/pages/target.js';

const RCV = { lat: 50.0, lon: 9.0 };

// Aufbau und Werte stammen aus einer Messung an adsapp01 am 28.07.2026.
const VOLL = {
  hex: 'c01753', flight: 'ACA896  ', alt_baro: 37000, alt_geom: 38750,
  gs: 535.5, ias: 271, tas: 480, mach: 0.836, track: 130.5, roll: 2.1,
  mag_heading: 131.7, baro_rate: 0, geom_rate: 0, track_rate: 0.1,
  squawk: '1162', category: 'A5', nav_qnh: 1012.8, nav_altitude_mcp: 35008,
  nic: 8, rc: 186, nac_p: 9, sil: 3, rssi: -19.6, messages: 4211, seen: 0.3,
  lat: 50.1, lon: 9.1,
};
const KARG = { hex: '501c3b', messages: 5, seen: 12.8, rssi: -24.0, lat: 50.05, lon: 9.05 };

const eins = (ac, highlight = true) => kandidatenAusZielen([ac], RCV, highlight)[0];

test('nur Ziele mit Position werden Kandidaten', () => {
  const liste = kandidatenAusZielen([VOLL, { hex: 'nolat', alt_baro: 3000 }], RCV, true);
  assert.equal(liste.length, 1);
  assert.equal(liste[0].hex, 'c01753');
});

test('ohne Empfaengerposition gibt es keine Kandidaten', () => {
  assert.deepEqual(kandidatenAusZielen([VOLL], null, true), []);
});

test('Callsign wird von Fuellzeichen befreit', () => {
  assert.equal(eins(VOLL).callsign, 'ACA896');
});

test('fehlendes Callsign: der hex steht in der Ueberschrift, kein Gedankenstrich', () => {
  const k = datenblattFelder(eins(KARG)).kopf;
  assert.equal(k.name, '501c3b');
  assert.equal(k.istHex, true);
});

test('vorhandenes Callsign steht als Callsign in der Ueberschrift', () => {
  const k = datenblattFelder(eins(VOLL)).kopf;
  assert.equal(k.name, 'ACA896');
  assert.equal(k.istHex, false);
});

test('Zielflugflaeche kommt aus nav_altitude_mcp', () => {
  const g = datenblattFelder(eins(VOLL)).gruppen.find(x => x.titel === 'Höhe');
  assert.deepEqual(g.zeilen.find(z => z[0] === 'Zielflugfläche'),
                   ['Zielflugfläche', 'FL350', '']);
});

test('Mach mit drei Nachkommastellen', () => {
  const g = datenblattFelder(eins(VOLL)).gruppen.find(x => x.titel === 'Geschwindigkeit');
  assert.deepEqual(g.zeilen.find(z => z[0] === 'Mach'), ['Mach', '0.836', '']);
});

test('fehlende Felder ergeben einen Gedankenstrich, niemals eine 0', () => {
  const gruppen = datenblattFelder(eins(KARG)).gruppen;
  const alle = gruppen.flatMap(g => g.zeilen);
  for (const [label, wert] of alle.filter(z => ['IAS', 'TAS', 'Mach', 'QNH'].includes(z[0]))) {
    assert.equal(wert, '—', `${label} muesste ein Gedankenstrich sein, war ${wert}`);
  }
  assert.equal(alle.some(z => z[1] === '0' && ['IAS', 'TAS', 'QNH'].includes(z[0])), false);
});

test('die Lage-Gruppe bildet KEINE Differenz aus track und mag_heading', () => {
  const g = datenblattFelder(eins(VOLL)).gruppen.find(x => x.titel === 'Lage');
  assert.deepEqual(g.zeilen.map(z => z[0]),
                   ['Track', 'Steuerkurs (mag)', 'Querneigung', 'Kursänderung']);
});

test('Heavy und Squawk stehen im Kopf', () => {
  const k = datenblattFelder(eins(VOLL)).kopf;
  assert.equal(k.heavy, true);
  assert.equal(k.squawk, '1162');
});

test('highlight=false schaltet auch das Datenblatt stumm', () => {
  const notfall = { ...VOLL, squawk: '7700' };
  assert.equal(eins(notfall, true).emergency, true);
  assert.equal(eins(notfall, false).emergency, false);
});
```

- [ ] **Schritt 2: Testlauf, der fehlschlagen muß**

Ausführen: `node --test tests/test_target.mjs`
Erwartet: FAIL mit `Cannot find module .../console/js/pages/target.js`

- [ ] **Schritt 3a: Das gemeinsame Modul anlegen und die Duplizierung auflösen**

`msgRate()` steht heute wortgleich in `board.js:76` und `radar.js:398` — identisch bis auf
einen Variablennamen. Ohne diesen Schritt käme sie mit `target.js` und `profile.js` auf
vier Kopien. Der Leerzustand ist die Stelle, an der die Konsole „nichts fliegt" von
„Empfänger tot" unterscheidet; diese Aussage braucht genau einen Ort.

Neue Datei `console/js/pages/gemeinsam.js`:

```javascript
// Von allen Seiten geteilt, die einen Leerzustand haben. Die
// Nachrichtenrate laeuft weiter, auch wenn kein einziges Ziel eine
// Position sendet -- sie ist das einzige, was "nichts fliegt" von
// "Empfaenger tot" unterscheidet. Deshalb steht sie in jedem Leerzustand,
// und deshalb gehoert sie an genau eine Stelle.
export function msgRate(state) {
  const s = state && state.stats && state.stats.last1min;
  if (!s) return '—';
  const spanne = s.end - s.start;
  return spanne > 0 ? Math.round(s.messages / spanne) : '—';
}
```

In `console/js/pages/board.js` die lokale Funktion `msgRate` (Zeilen 76–81) **löschen**
und stattdessen am Dateikopf ergänzen:

```javascript
import { msgRate } from './gemeinsam.js';
```

In `console/js/pages/radar.js` ebenso: die lokale Funktion `msgRate` löschen und den
Import am Dateikopf ergänzen.

**Das faßt zwei am Panel abgenommene Seiten an.** Ersetzt wird eine reine Funktion durch
einen Import identischen Verhaltens; Schritt 12 prüft beide Leerzustände gegen.

- [ ] **Schritt 3b: Die Seite schreiben**

Neue Datei `console/js/pages/target.js`:

```javascript
import { haversineNm, bearingDeg, formatBearing, formatCallsign, flightLevel,
         isEmergency, waehleDatenblattZiel } from '../geo.js';
import { registerPage } from '../console.js';
import { msgRate } from './gemeinsam.js';

// Die Seite braucht den ROHEN aircraft.json-Eintrag, nicht nur das
// angereicherte Ziel: ias, tas, mach, roll, nav_altitude_mcp und die
// Guetefelder kommen dort und nur dort her. Deshalb reist a als `roh` mit.
export function kandidatenAusZielen(aircraft, receiver, highlight) {
  if (!receiver) return [];
  const liste = [];
  for (const a of aircraft || []) {
    if (typeof a.lat !== 'number' || typeof a.lon !== 'number') continue;
    liste.push({
      hex: a.hex,
      callsign: formatCallsign(a.flight),
      nm: haversineNm(receiver.lat, receiver.lon, a.lat, a.lon),
      brg: bearingDeg(receiver.lat, receiver.lon, a.lat, a.lon),
      emergency: !!highlight && isEmergency(a),
      roh: a,
    });
  }
  return liste;
}

// Zahl oder Gedankenstrich -- niemals eine 0 fuer einen fehlenden Wert.
// Eine 0 meldet einen gemessenen Zustand ("Steigrate null" heisst
// Reiseflug), ein fehlender Wert meldet gar nichts.
const z = (v, stellen = 0) =>
  typeof v === 'number' && Number.isFinite(v) ? v.toFixed(stellen) : '—';

export function datenblattFelder(t) {
  const a = t.roh;
  return {
    kopf: {
      name: t.callsign || t.hex,
      istHex: !t.callsign,
      heavy: a.category === 'A5',
      squawk: a.squawk || null,
      emergency: t.emergency,
    },
    gruppen: [
      { titel: 'Geschwindigkeit', zeilen: [
        ['GS',   z(a.gs),   'kt'],
        ['IAS',  z(a.ias),  'kt'],
        ['TAS',  z(a.tas),  'kt'],
        ['Mach', z(a.mach, 3), ''],
      ]},
      { titel: 'Höhe', zeilen: [
        ['Baro',           flightLevel(a.alt_baro), ''],
        ['Geometrisch',    z(a.alt_geom), 'ft'],
        ['Zielflugfläche', flightLevel(a.nav_altitude_mcp), ''],
        ['Baro-Rate',      z(a.baro_rate), 'ft/min'],
        ['Geom-Rate',      z(a.geom_rate), 'ft/min'],
      ]},
      // KEINE Differenz aus track und mag_heading. Sie liegt nahe und waere
      // falsch: track ist rechtweisend, mag_heading missweisend -- die
      // Differenz enthaelt die Missweisung mit und ist kein Windversatz.
      // Ein Etikett, das eine andere Frage nennt als die beantwortete.
      { titel: 'Lage', zeilen: [
        ['Track',            formatBearing(a.track), ''],
        ['Steuerkurs (mag)', formatBearing(a.mag_heading), ''],
        ['Querneigung',      z(a.roll, 1), '°'],
        ['Kursänderung',     z(a.track_rate, 1), '°/s'],
      ]},
      { titel: 'Ort', zeilen: [
        ['Entfernung', t.nm.toFixed(1), 'NM'],
        ['Peilung',    formatBearing(t.brg), ''],
        ['QNH',        z(a.nav_qnh, 1), 'hPa'],
      ]},
      { titel: 'Empfang', zeilen: [
        ['RSSI',        z(a.rssi, 1), 'dBFS'],
        ['Nachrichten', z(a.messages), ''],
        ['zuletzt',     z(a.seen, 1), 's'],
      ]},
      { titel: 'Positionsgüte', zeilen: [
        ['NIC',  z(a.nic),   ''],
        ['Rc',   z(a.rc),    'm'],
        ['NACp', z(a.nac_p), ''],
        ['SIL',  z(a.sil),   ''],
      ]},
    ],
  };
}

registerPage({
  id: 'target',
  title: 'Einzelziel',
  ageSource: 'aircraft',
  mount(el) {
    el.innerHTML = '<div class="datenblatt value"></div>';
    el._ctx = { gewaehlt: null };
  },
  // Beim Betreten wird die Auswahl geloescht, damit die Seite bei jedem
  // Besuch frisch das naechste Ziel greift -- und es dann fuer die ganze
  // Standzeit haelt.
  onEnter(el) { el._ctx.gewaehlt = null; },
  render(el, cfg, state) {
    const root = el.querySelector('.datenblatt');
    const kandidaten =
      kandidatenAusZielen(state.aircraft, state.receiver, cfg.emergency.highlight);
    const gewaehlt = waehleDatenblattZiel(kandidaten, el._ctx.gewaehlt);
    el._ctx.gewaehlt = gewaehlt;
    if (!gewaehlt) {
      // Nachts ist das der Normalfall, kein Defekt. Die Nachrichtenrate
      // bleibt stehen: Sie unterscheidet "nichts fliegt" von "Empfaenger tot".
      root.innerHTML = `<div class="empty">KEIN ZIEL MIT POSITION
        <div class="empty-sub">Nachrichtenrate ${msgRate(state)} /s</div></div>`;
      return;
    }
    const { kopf, gruppen } = datenblattFelder(gewaehlt);
    root.innerHTML = `
      <div class="tile db-kopf${kopf.emergency ? ' emg' : ''}">
        <div class="lbl">${kopf.emergency
          ? 'NOTFALL' + (kopf.squawk ? ' · Squawk ' + kopf.squawk : '')
          : 'Datenblatt'}</div>
        <div class="huge ${kopf.emergency ? 'red' : 'em'}${kopf.istHex ? ' db-hex' : ''}">
          ${kopf.name}${kopf.heavy ? '<span class="hv"> HEAVY</span>' : ''}</div>
        ${kopf.squawk && !kopf.emergency
          ? `<div class="sub-d">Squawk ${kopf.squawk}</div>` : ''}
      </div>
      <div class="db-grid">
        ${gruppen.map(g => `
          <div class="tile">
            <div class="lbl">${g.titel}</div>
            ${g.zeilen.map(([label, wert, einheit]) => `
              <div class="db-zeile">
                <span class="db-label">${label}</span>
                <span class="db-wert">${wert}<span class="unit-s">${einheit}</span></span>
              </div>`).join('')}
          </div>`).join('')}
      </div>`;
  },
});
```

- [ ] **Schritt 4: Testlauf, der grün sein muß**

Ausführen: `node --test tests/test_target.mjs`
Erwartet: PASS, `ℹ tests 11`, `ℹ fail 0`

- [ ] **Schritt 5: Den Test einmal absichtlich rot sehen**

Ändern in `datenblattFelder` vorübergehend `flightLevel(a.nav_altitude_mcp)` zu
`flightLevel(a.alt_baro)`.
Ausführen: `node --test tests/test_target.mjs`
Erwartet: FAIL in `Zielflugflaeche kommt aus nav_altitude_mcp` — erwartet `FL350`, war `FL370`.
**Danach zurücknehmen** und Schritt 4 wiederholen.

- [ ] **Schritt 6: `refreshSystem` in `data.js` bereitstellen**

Dieser Schritt kommt **vor** dem Umbau von `console.js`: `betrete()` ruft `refreshSystem`
auf, und ein Zwischenstand, in dem der Aufruf ins Leere geht, wäre ein selbstgemachter
Fehlerzustand.

In `console/js/data.js` die Rückgabezeile von `createDataStore`

```javascript
  return { state, start };
```

ändern zu

```javascript
  // refreshSystem wird beim Betreten der Systemseite gerufen. Ohne diesen
  // Sofortabruf kaemen die ersten Daten bis zu 10 s spaet -- bei 15 s
  // Standzeit zwei Drittel der Zeit mit Gedankenstrichen.
  return { state, start, refreshSystem: pollSystem };
```

- [ ] **Schritt 7: Den `onEnter`-Haken in `console.js` einbauen**

In `console/js/console.js` Zeile 5 den Kommentar erweitern:

```javascript
const pages = new Map();          // id -> {id, title, ageSource, mount, render, onEnter?}
```

In `renderCurrent` die Zeile `store.state.systemVisible = page.id === 'system';`
**löschen** — sie wandert nach `betrete()`, damit es genau einen Ort gibt, an dem sie
gesetzt wird.

Direkt vor `function renderCurrent()` einfügen:

```javascript
  // Wird beim Seitenwechsel genau einmal gerufen -- nicht bei jedem
  // Datenpaket. Die Einzelziel-Seite friert hier ihr Ziel ein, die
  // Systemseite holt hier ihre Daten sofort statt bis zu 10 s zu warten.
  function betrete(index) {
    const id = order[index];
    store.state.systemVisible = id === 'system';
    if (id === 'system') store.refreshSystem();
    const page = pages.get(id);
    if (page && page.onEnter) page.onEnter(els.get(id), config, store.state);
  }
```

In `goTo` nach `current = next;` und **vor** `renderCurrent();` einfügen:

```javascript
    betrete(current);
```

Am Dateiende die Startsequenz von

```javascript
  await store.start();
  renderCurrent();
```

ändern zu

```javascript
  await store.start();
  betrete(0);
  renderCurrent();
```

- [ ] **Schritt 8: Kachelklassen allgemein machen**

Die Kachel-Bausteine liegen heute unter `.radar-side ` und sind damit für keine andere
Seite erreichbar. In `console/css/console.css` in den Zeilen 110–126 sowie 142–143 das
Präfix `.radar-side ` **streichen**, so daß aus

```css
.radar-side .tile { background:#0b1f13; ... }
```

wird

```css
.tile { background:#0b1f13; ... }
```

Das betrifft: `.tile`, `.tile.ctr`, `.grid2`, `.lbl`, `.huge`, `.big`, `.med`, `.unit-s`,
`.sub-d`, `.row`, `.em`, `.sky`, `.amber`, `.slate`, `.tile.emg`, `.red`.
**Nicht anfassen:** `.radar-side` selbst (Zeile 63), `.radar-side .ac`, `.radar-side .sub`
— das sind Layoutregeln der Radarseite.

**Das ist ein Eingriff in die am Panel abgenommene Radarseite.** Schritt 12 prüft sie
deshalb ausdrücklich gegen.

- [ ] **Schritt 9: Layout des Datenblatts ergänzen**

An das Ende von `console/css/console.css` anhängen:

```css
/* Einzelziel-Datenblatt */
.datenblatt { flex: 1; display: flex; flex-direction: column; gap: 14px; min-height: 0; }
.db-kopf { flex: 0 0 132px; }
.db-kopf .huge { font-size: 76px; margin: 6px 0 4px; }
.db-kopf .db-hex { font-size: 56px; letter-spacing: .06em; color: #8fb8a0; }
.db-grid { flex: 1; display: grid; grid-template-columns: repeat(3, 1fr);
           grid-template-rows: 1fr 1fr; gap: 14px; min-height: 0; }
.db-zeile { display: flex; align-items: baseline; justify-content: space-between;
            gap: 12px; margin-top: 6px; }
.db-label { font-size: 17px; color: #4e9c6a; }
.db-wert { font-size: 27px; font-variant-numeric: tabular-nums; color: #b8f5cc; }
```

- [ ] **Schritt 10: Seite registrieren**

In `console/index.html` nach der `board.js`-Zeile einfügen:

```html
    import './js/pages/target.js';
```

- [ ] **Schritt 11: Vollständiger Testlauf**

Ausführen: `node --test tests/*.mjs`
Erwartet: `ℹ fail 0`, `ℹ tests` um 11 höher als nach Aufgabe 4.

- [ ] **Schritt 12: Am Gerät prüfen — vom Controller, nicht vom Subagenten**

Diese Schritte laufen auf `adsapp01` und brauchen Henning am Panel. Ein Subagent führt sie
**nicht** aus, sondern meldet, daß die Aufgabe hier auf den Controller wartet.

Ausrollen (Controller, Hauptsitzung):

```bash
rsync -av --delete console/ adsapp01:/tmp/atc-neu/ && ssh adsapp01 'sudo cp -r /tmp/atc-neu/. /var/www/html/atc/'
```

Dann am Panel:

1. **Regression Radarseite:** Der Datenblock rechts sieht unverändert aus — Kacheln,
   Rahmen, Schriftgrößen, das Flugzeugsymbol. Schritt 8 hat CSS-Selektoren umgehängt.
2. **Einfrieren mit der Stoppuhr:** Auf die Einzelziel-Seite blättern, Callsign notieren,
   15 s zusehen. Das Callsign darf **nicht** wechseln, die Entfernung **muß** sich ändern.
3. **Zweiter Besuch:** Nach einem vollen Umlauf wieder auf die Seite — jetzt darf ein
   anderes Ziel dastehen (die Auswahl wird beim Betreten neu getroffen).
4. **Umlauf:** Sechs Punkte in der Indikatorreihe? Nein — nach dieser Aufgabe sind es
   **vier** (Radar, Board, Einzelziel, Statistik). Umlauf 45 + 3 × 15 = 90 s.
5. **Touch-Übernahme:** Wischen, Stoppuhr. 60 s bis zum Weiterblättern, von der sichtbaren
   Seite aus. Das war der eine Durchfaller der Stufe 1.
6. **Vor jedem Layout-Urteil:** In Chromium mit `Strg+Umschalt+R` neu laden bzw. am Panel
   die Seite hart neu laden lassen, damit die geladene Fassung die gebaute ist.

- [ ] **Schritt 13: Commit**

```bash
git add console/js/pages/target.js console/js/pages/gemeinsam.js console/js/console.js \
        console/js/data.js console/js/pages/board.js console/js/pages/radar.js \
        console/css/console.css console/index.html tests/test_target.mjs
git commit -m "Einzelziel-Seite: volles Datenblatt, Ziel friert beim Betreten ein"
```

---

### Aufgabe 6: `hoehenprofil` — der Rechenkern des Seitenrisses

Ersetzt die Bänder-Auswertung aus §6.6. Über eine gemessene Stunde (1808 Positionen) hält
ein Band 57 % und eines im Mittel 0,3 Ziele; die Bänderzählung allein summiert die
Entfernung weg und vernichtet damit die reale Struktur.

**Dateien:**
- Erstellen: `console/js/pages/profile.js` (nur der Rechenkern; die Seite folgt in Aufgabe 7)
- Erstellen: `tests/test_profile.mjs`

**Schnittstellen:**
- Verbraucht: `haversineNm`, `isEmergency` aus `geo.js`
- Erzeugt:
  - `BAENDER` — `Array<{von: number, bis: number, label: string}>`, Höhen in Fuß
  - `FL_MAX = 45000` — obere Kante des Seitenrisses in Fuß
  - `hoehenprofil(aircraft, receiver, rangeNm, highlight) →
     {punkte: Array<{hex, nm, altFt, geklemmt, emergency}>,
      baender: Array<{label, anzahl}>, ohnePosition: number, ausserhalb: number}`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

Neue Datei `tests/test_profile.mjs`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { hoehenprofil, BAENDER, FL_MAX } from '../console/js/pages/profile.js';

const RCV = { lat: 50.0, lon: 9.0 };
// 50.05 / 9.05 liegt rund 4 NM vom erfundenen Empfaenger entfernt,
// 50.5 / 9.5 rund 38 NM, 51.5 / 10.5 weit ueber 50 NM.
const NAH  = { lat: 50.05, lon: 9.05 };
const FERN = { lat: 51.5,  lon: 10.5 };

const ac = (extra) => ({ hex: 'aaa000', ...NAH, ...extra });
const lauf = (liste, rangeNm = 50, highlight = true) =>
  hoehenprofil(liste, RCV, rangeNm, highlight);

test('sechs Baender in der Reihenfolge der Spec', () => {
  assert.equal(BAENDER.length, 6);
  assert.deepEqual(BAENDER.map(b => b.von), [0, 5000, 10000, 20000, 30000, 40000]);
});

test('Bandgrenze 5000 ft gehoert nach oben, nicht nach unten', () => {
  const r = lauf([ac({ alt_baro: 4999 }), ac({ alt_baro: 5000 })]);
  assert.equal(r.baender[0].anzahl, 1);
  assert.equal(r.baender[1].anzahl, 1);
});

test('Bandgrenze 40000 ft faellt in das oberste Band', () => {
  const r = lauf([ac({ alt_baro: 39999 }), ac({ alt_baro: 40000 })]);
  assert.equal(r.baender[4].anzahl, 1);
  assert.equal(r.baender[5].anzahl, 1);
});

test('ueber FL450 wird geklemmt und markiert, nicht weggelassen', () => {
  const r = lauf([ac({ alt_baro: 47000 })]);
  assert.equal(r.punkte.length, 1);
  assert.equal(r.punkte[0].altFt, FL_MAX);
  assert.equal(r.punkte[0].geklemmt, true);
});

test('unterhalb der Klemmgrenze bleibt der Wert unveraendert', () => {
  const r = lauf([ac({ alt_baro: 37000 })]);
  assert.equal(r.punkte[0].altFt, 37000);
  assert.equal(r.punkte[0].geklemmt, false);
});

test('mit Hoehe, ohne Position: gezaehlt und im Band, aber kein Punkt', () => {
  const r = lauf([{ hex: 'nopos', alt_baro: 12000 }]);
  assert.equal(r.punkte.length, 0);
  assert.equal(r.ohnePosition, 1);
  assert.equal(r.baender[2].anzahl, 1);
});

test('ausserhalb des Massstabs: gezaehlt und im Band, aber kein Punkt', () => {
  const r = lauf([{ hex: 'weit', ...FERN, alt_baro: 35000 }]);
  assert.equal(r.punkte.length, 0);
  assert.equal(r.ausserhalb, 1);
  assert.equal(r.baender[4].anzahl, 1);
});

test('alt_baro "ground" ist keine Hoehe -- weder Punkt noch Band', () => {
  const r = lauf([ac({ alt_baro: 'ground' })]);
  assert.equal(r.punkte.length, 0);
  assert.equal(r.ohnePosition, 0);
  assert.equal(r.ausserhalb, 0);
  assert.deepEqual(r.baender.map(b => b.anzahl), [0, 0, 0, 0, 0, 0]);
});

test('Ziel ganz ohne alt_baro faellt vollstaendig heraus', () => {
  const r = lauf([ac({})]);
  assert.equal(r.punkte.length, 0);
  assert.deepEqual(r.baender.map(b => b.anzahl), [0, 0, 0, 0, 0, 0]);
});

test('Entfernung wird gerechnet, nicht uebernommen', () => {
  const r = lauf([ac({ alt_baro: 30000 })]);
  assert.ok(r.punkte[0].nm > 3 && r.punkte[0].nm < 5,
            `erwartet rund 4 NM, war ${r.punkte[0].nm}`);
});

test('ohne Empfaengerposition gibt es keine Punkte, aber die Baender zaehlen', () => {
  const r = hoehenprofil([ac({ alt_baro: 30000 })], null, 50, true);
  assert.equal(r.punkte.length, 0);
  assert.equal(r.ohnePosition, 1);
  assert.equal(r.baender[4].anzahl, 1);
});

test('highlight=false schaltet auch den Seitenriss stumm', () => {
  const notfall = ac({ alt_baro: 30000, squawk: '7700' });
  assert.equal(lauf([notfall], 50, true).punkte[0].emergency, true);
  assert.equal(lauf([notfall], 50, false).punkte[0].emergency, false);
});

test('leere Eingabe ergibt leere Auswertung statt Absturz', () => {
  const r = lauf(null);
  assert.deepEqual(r.punkte, []);
  assert.equal(r.ohnePosition, 0);
  assert.deepEqual(r.baender.map(b => b.anzahl), [0, 0, 0, 0, 0, 0]);
});
```

- [ ] **Schritt 2: Testlauf, der fehlschlagen muß**

Ausführen: `node --test tests/test_profile.mjs`
Erwartet: FAIL mit `Cannot find module .../console/js/pages/profile.js`

- [ ] **Schritt 3: Den Rechenkern schreiben**

Neue Datei `console/js/pages/profile.js`:

```javascript
import { haversineNm, isEmergency } from '../geo.js';

// Die sechs Baender aus Spec 6.6, in Fuss. Die obere Kante ist Infinity --
// "ueber FL400" hat keine Obergrenze, und ein Ziel oberhalb einer
// gedachten Grenze verschwinden zu lassen waere derselbe Fehler wie ein
// Punkt, der aus dem Bild faellt.
export const BAENDER = Object.freeze([
  { von: 0,     bis: 5000,     label: 'unter FL050' },
  { von: 5000,  bis: 10000,    label: 'FL050–FL100' },
  { von: 10000, bis: 20000,    label: 'FL100–FL200' },
  { von: 20000, bis: 30000,    label: 'FL200–FL300' },
  { von: 30000, bis: 40000,    label: 'FL300–FL400' },
  { von: 40000, bis: Infinity, label: 'über FL400' },
]);

// Obere Kante des Seitenrisses in Fuss. Das gemessene Stundenmaximum lag
// bei FL409; FL450 gibt Luft, ohne das Bild leer aussehen zu lassen.
export const FL_MAX = 45000;

// alt_baro traegt bei Zielen am Boden den String "ground". Der Daemon
// behandelt ihn als KEINE Hoehe (test_alt_baro_ground_ist_keine_hoehe);
// diese Seite haelt sich daran, damit nicht zwei Teile derselben Konsole
// dieselbe Eingabe verschieden deuten.
function hoeheFt(a) {
  const v = a.alt_baro;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function hoehenprofil(aircraft, receiver, rangeNm, highlight) {
  const punkte = [];
  const baender = BAENDER.map(b => ({ label: b.label, anzahl: 0 }));
  let ohnePosition = 0, ausserhalb = 0;
  for (const a of aircraft || []) {
    const alt = hoeheFt(a);
    if (alt === null) continue;
    const i = BAENDER.findIndex(b => alt >= b.von && alt < b.bis);
    if (i >= 0) baender[i].anzahl += 1;
    const hatPosition = receiver &&
      typeof a.lat === 'number' && typeof a.lon === 'number';
    if (!hatPosition) { ohnePosition += 1; continue; }
    const nm = haversineNm(receiver.lat, receiver.lon, a.lat, a.lon);
    if (nm > rangeNm) { ausserhalb += 1; continue; }
    punkte.push({
      hex: a.hex,
      nm,
      altFt: Math.min(alt, FL_MAX),
      geklemmt: alt > FL_MAX,
      emergency: !!highlight && isEmergency(a),
    });
  }
  return { punkte, baender, ohnePosition, ausserhalb };
}
```

- [ ] **Schritt 4: Testlauf, der grün sein muß**

Ausführen: `node --test tests/test_profile.mjs`
Erwartet: PASS, `ℹ tests 13`, `ℹ fail 0`

- [ ] **Schritt 5: Den Test einmal absichtlich rot sehen**

Ändern vorübergehend `alt >= b.von && alt < b.bis` zu `alt > b.von && alt <= b.bis`.
Ausführen: `node --test tests/test_profile.mjs`
Erwartet: FAIL in `Bandgrenze 5000 ft gehoert nach oben, nicht nach unten`.
**Danach zurücknehmen** und Schritt 4 wiederholen.

- [ ] **Schritt 6: Commit**

```bash
git add console/js/pages/profile.js tests/test_profile.mjs
git commit -m "Hoehenprofil-Rechenkern: Seitenriss und Baenderzaehlung, ohne DOM"
```

---

### Aufgabe 7: Höhenprofil-Seite

Layout wie die abgenommene Radarseite: Bild links, Datenspalte rechts.

**Dateien:**
- Ändern: `console/js/pages/profile.js` (Seite anhängen)
- Ändern: `console/css/console.css` (anhängen)
- Ändern: `console/index.html`

**Schnittstellen:**
- Verbraucht: `hoehenprofil`, `BAENDER`, `FL_MAX` aus Aufgabe 6; `nmToPx` aus `geo.js`
- Erzeugt: registrierte Seite `profile`

- [ ] **Schritt 1: Die Seite anhängen**

Den Import am Kopf von `console/js/pages/profile.js` erweitern:

```javascript
import { haversineNm, isEmergency, nmToPx } from '../geo.js';
import { registerPage } from '../console.js';
import { msgRate } from './gemeinsam.js';
```

An das Dateiende anhängen:

```javascript
// Das Bild ist so gross wie der Radarschirm: 620 x 620 minus Rand. Die
// x-Achse benutzt denselben cfg.radar.range_nm wie das Radar und dieselben
// Ringe als Gitterlinien -- wer auf dem Schirm einen Ring sieht, findet ihn
// hier als senkrechte Linie wieder.
const BILD_B = 700, BILD_H = 560;

registerPage({
  id: 'profile',
  title: 'Höhenprofil',
  ageSource: 'aircraft',
  mount(el) {
    el.innerHTML = `
      <div class="profil-bild">
        <svg class="profil-svg" viewBox="0 0 ${BILD_B} ${BILD_H}"
             preserveAspectRatio="none" aria-hidden="true"></svg>
      </div>
      <div class="profil-spalte value"></div>`;
  },
  render(el, cfg, state) {
    const r = hoehenprofil(state.aircraft, state.receiver,
                           cfg.radar.range_nm, cfg.emergency.highlight);
    const svg = el.querySelector('.profil-svg');
    const spalte = el.querySelector('.profil-spalte');

    // Gitter: waagerecht alle FL100, senkrecht auf den Radarringen.
    const yVon = ft => BILD_H - (ft / FL_MAX) * BILD_H;
    const teile = [];
    for (let ft = 10000; ft < FL_MAX; ft += 10000) {
      const y = yVon(ft);
      teile.push(`<line class="g-h" x1="0" y1="${y}" x2="${BILD_B}" y2="${y}"/>`);
      teile.push(`<text class="g-t" x="4" y="${y - 5}">FL${ft / 100}</text>`);
    }
    for (const ring of cfg.radar.rings_nm) {
      if (ring > cfg.radar.range_nm) continue;
      const x = nmToPx(ring, cfg.radar.range_nm, BILD_B);
      teile.push(`<line class="g-v" x1="${x}" y1="0" x2="${x}" y2="${BILD_H}"/>`);
      teile.push(`<text class="g-t" x="${x + 5}" y="${BILD_H - 6}">${ring} NM</text>`);
    }
    for (const p of r.punkte) {
      const x = nmToPx(p.nm, cfg.radar.range_nm, BILD_B);
      const y = yVon(p.altFt);
      const klassen = 'p' + (p.emergency ? ' emg' : '') + (p.geklemmt ? ' klemm' : '');
      teile.push(`<circle class="${klassen}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5"/>`);
      // Ein geklemmtes Ziel bekommt einen Aufwaertspfeil: Der Punkt sagt
      // sonst "genau FL450", und das waere eine Behauptung statt einer Marke.
      if (p.geklemmt) {
        teile.push(`<path class="klemm-pfeil" d="M${(x - 5).toFixed(1)} ${(y + 8).toFixed(1)}
                    L${x.toFixed(1)} ${(y + 1).toFixed(1)} L${(x + 5).toFixed(1)} ${(y + 8).toFixed(1)}"/>`);
      }
    }
    svg.innerHTML = teile.join('');

    if (!r.punkte.length && !r.ohnePosition && !r.ausserhalb) {
      spalte.innerHTML = `<div class="tile ctr" style="flex:1">
        <div class="empty">KEINE ZIELE MIT HÖHE
          <div class="empty-sub">Nachrichtenrate ${msgRate(state)} /s</div></div></div>`;
      return;
    }
    const groesstes = Math.max(1, ...r.baender.map(b => b.anzahl));
    spalte.innerHTML = `
      <div class="tile" style="flex:1">
        <div class="lbl">Ziele je Flugflächenband</div>
        ${r.baender.slice().reverse().map(b => `
          <div class="band">
            <span class="band-lbl">${b.label}</span>
            <span class="band-bar"><i style="width:${(b.anzahl / groesstes * 100).toFixed(0)}%"></i></span>
            <span class="band-n">${b.anzahl}</span>
          </div>`).join('')}
      </div>
      <div class="tile">
        <div class="lbl">Nicht im Bild</div>
        <div class="db-zeile"><span class="db-label">mit Höhe, ohne Position</span>
          <span class="db-wert">${r.ohnePosition}</span></div>
        <div class="db-zeile"><span class="db-label">außerhalb ${cfg.radar.range_nm} NM</span>
          <span class="db-wert">${r.ausserhalb}</span></div>
      </div>`;
  },
});
```

- [ ] **Schritt 2: CSS anhängen**

An das Ende von `console/css/console.css`:

```css
/* Höhenprofil: Seitenriß links, Bandspalte rechts */
.profil-bild { flex: 0 0 700px; height: 560px; align-self: center;
               border-left: 1px solid #14361f; border-bottom: 1px solid #14361f; }
.profil-svg { width: 700px; height: 560px; display: block; }
.profil-svg .g-h, .profil-svg .g-v { stroke: #14361f; stroke-width: 1; }
.profil-svg .g-t { fill: #2f6b45; font-size: 13px;
                   font-family: ui-monospace, monospace; }
.profil-svg .p { fill: #b8ffcf; }
.profil-svg .p.emg { fill: #ff5a5a; }
.profil-svg .p.klemm { fill: #f0b429; }
.profil-svg .klemm-pfeil { fill: none; stroke: #f0b429; stroke-width: 2; }
.profil-spalte { flex: 1; display: flex; flex-direction: column; gap: 14px; min-height: 0; }
.band { display: flex; align-items: center; gap: 10px; margin-top: 9px; }
.band-lbl { font-size: 16px; color: #4e9c6a; flex: 0 0 108px; }
.band-bar { flex: 1; height: 14px; background: #0b1f13; border: 1px solid #14361f;
            border-radius: 3px; overflow: hidden; }
.band-bar i { display: block; height: 100%; background: #3ddc84; }
.band-n { font-size: 22px; font-variant-numeric: tabular-nums; flex: 0 0 34px;
          text-align: right; }
```

- [ ] **Schritt 3: Seite registrieren**

In `console/index.html` nach der `stats.js`-Zeile einfügen:

```html
    import './js/pages/profile.js';
```

- [ ] **Schritt 4: Testlauf — der Rechenkern muß grün bleiben**

Ausführen: `node --test tests/*.mjs`
Erwartet: `ℹ fail 0`. Die Seite selbst hat keine Tests; sie ist DOM, und eine DOM-Attrappe
ist in diesem Projekt ausgeschlossen. Ihre Prüfung ist Schritt 5.

- [ ] **Schritt 5: Am Gerät prüfen — vom Controller**

Ausrollen wie in Aufgabe 5, Schritt 12. Dann am Panel:

1. **Struktur sichtbar?** Bei Tagesverkehr müssen zwei Populationen erkennbar sein: ein
   waagerechtes Band um FL320–FL400 über die volle Breite, und eine Wolke unterhalb FL050
   innerhalb der ersten 10 NM. Sieht das Bild aus wie zufälliges Streugut, ist der
   Maßstab falsch — melden, nicht schönreden.
2. **Gitterlinien** bei 10, 25 und 50 NM, beschriftet, nicht abgeschnitten.
3. **Rechter Bildrand:** Ein Ziel bei 49 NM darf nicht halb aus dem Bild ragen.
4. **Bandspalte:** Die Summe der sechs Zahlen muß der Zahl der Ziele mit Höhe entsprechen.
   Gegenprobe gegen die Board-Seite: Deren Zeile „ohne Position: n" und die hiesige „mit
   Höhe, ohne Position" dürfen sich unterscheiden (nicht jedes Ziel ohne Position hat eine
   Höhe) — aber die hiesige darf **nie größer** sein.
5. **Vor dem Layout-Urteil** hart neu laden.

- [ ] **Schritt 6: Commit**

```bash
git add console/js/pages/profile.js console/css/console.css console/index.html
git commit -m "Hoehenprofil-Seite: Seitenriss mit Bandspalte statt sechs Balken"
```

---

### Aufgabe 8: System-Seite

**Dateien:**
- Erstellen: `console/js/pages/system.js`
- Erstellen: `tests/test_system.mjs`
- Ändern: `console/css/console.css` (anhängen)
- Ändern: `console/index.html`

**Schnittstellen:**
- Verbraucht: `store.refreshSystem` (Aufgabe 5, Schritt 7); `state.system`, `state.stats`
- Erzeugt:
  - `samplesDropped(statsDoc) → {jetzt: number|null, gesamt: number|null}`
  - `tempZustand(c) → 'normal' | 'grenze' | 'hart' | 'unbekannt'`
  - `daemonAlterS(system, jetztMs) → number | null`
  - `strich(v, stellen) → string`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

Neue Datei `tests/test_system.mjs`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { samplesDropped, tempZustand, daemonAlterS, strich }
  from '../console/js/pages/system.js';

// Aufbau aus der Messung an adsapp01 am 28.07.2026.
const STATS = {
  last1min: { local: { samples_processed: 143917056, samples_dropped: 0 } },
  total:    { local: { samples_processed: 114451677184, samples_dropped: 0 } },
};

test('samples_dropped kommt aus stats.json, in zwei Werten', () => {
  assert.deepEqual(samplesDropped(STATS), { jetzt: 0, gesamt: 0 });
});

test('ein gerissenes Kriterium wird in beiden Werten sichtbar', () => {
  const kaputt = {
    last1min: { local: { samples_dropped: 12 } },
    total:    { local: { samples_dropped: 4711 } },
  };
  assert.deepEqual(samplesDropped(kaputt), { jetzt: 12, gesamt: 4711 });
});

test('fehlende Statistik ergibt null, nicht 0 -- eine 0 hiesse "gemessen, alles gut"', () => {
  assert.deepEqual(samplesDropped(null), { jetzt: null, gesamt: null });
  assert.deepEqual(samplesDropped({}), { jetzt: null, gesamt: null });
  assert.deepEqual(samplesDropped({ total: { local: {} } }), { jetzt: null, gesamt: null });
});

test('die Abnahmegrenze 72 Grad ist die erste Farbschwelle, nicht 60', () => {
  assert.equal(tempZustand(62.3), 'normal');
  assert.equal(tempZustand(69.3), 'normal');   // Mittel der Variante-B-Stunde
  assert.equal(tempZustand(71.5), 'normal');   // Maximum der Variante-B-Stunde
  assert.equal(tempZustand(71.9), 'normal');
});

test('ab 72 Grad Grenze, ab 80 Grad hart', () => {
  assert.equal(tempZustand(72.0), 'grenze');
  assert.equal(tempZustand(75.0), 'grenze');   // Wert nach dem Kaltstart
  assert.equal(tempZustand(79.9), 'grenze');
  assert.equal(tempZustand(80.0), 'hart');
});

test('ohne Messwert ist der Zustand unbekannt, nicht normal', () => {
  assert.equal(tempZustand(null), 'unbekannt');
  assert.equal(tempZustand(undefined), 'unbekannt');
  assert.equal(tempZustand('62.3'), 'unbekannt');
  assert.equal(tempZustand(NaN), 'unbekannt');
});

test('das Alter des Daemons kommt aus written_at, mit uebergebener Uhr', () => {
  assert.equal(daemonAlterS({ written_at: 1000 }, 1_042_000), 42);
});

test('written_at in der Zukunft ergibt 0, keine negative Zahl', () => {
  assert.equal(daemonAlterS({ written_at: 2000 }, 1_000_000), 0);
});

test('ohne written_at gibt es kein Alter', () => {
  assert.equal(daemonAlterS(null, 1_000_000), null);
  assert.equal(daemonAlterS({}, 1_000_000), null);
  assert.equal(daemonAlterS({ written_at: 'jetzt' }, 1_000_000), null);
});

test('strich macht aus null einen Gedankenstrich, aus 0 aber eine 0', () => {
  assert.equal(strich(null), '—');
  assert.equal(strich(undefined), '—');
  assert.equal(strich(0), '0');
  assert.equal(strich(0.35, 2), '0.35');
});
```

- [ ] **Schritt 2: Testlauf, der fehlschlagen muß**

Ausführen: `node --test tests/test_system.mjs`
Erwartet: FAIL mit `Cannot find module .../console/js/pages/system.js`

- [ ] **Schritt 3: Das Modul schreiben**

Neue Datei `console/js/pages/system.js`:

```javascript
import { registerPage } from '../console.js';

// samples_dropped steht in stats.json, nicht in system.json: Der Daemon
// liest stats.json ueberhaupt nicht, waehrend das Frontend sie ohnehin
// alle 5 s holt. Zwei Werte, genau wie get_throttled -- "jetzt" und "seit
// Start". Ein Kriterium, das nur kumulativ gilt, verschweigt den Moment;
// eines, das nur den Moment zeigt, verschweigt die Historie.
export function samplesDropped(statsDoc) {
  const lies = fenster => {
    const l = statsDoc && statsDoc[fenster] && statsDoc[fenster].local;
    const v = l ? l.samples_dropped : undefined;
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };
  return { jetzt: lies('last1min'), gesamt: lies('total') };
}

// Drei Marken, aber nur zwei Farbschwellen. 60 Grad ist der dokumentierte
// Firmware-Vorgabewert und steht als Strich im Bild -- eine Farbschwelle
// waere er nicht: Das Geraet laeuft im Regelbetrieb bei 66,7 bis 71,5 Grad,
// also dauerhaft darueber. Eine Anzeige, die dabei staendig Alarmfarbe
// zeigt, lehrt das Falsche und wird nach drei Tagen nicht mehr gelesen.
// 72 ist die Abnahmegrenze dieses Projekts, 80 die harte Grenze.
export const MARKEN = Object.freeze({ soft: 60, abnahme: 72, hart: 80 });

export function tempZustand(c) {
  if (typeof c !== 'number' || !Number.isFinite(c)) return 'unbekannt';
  if (c >= MARKEN.hart) return 'hart';
  if (c >= MARKEN.abnahme) return 'grenze';
  return 'normal';
}

// Die Uhr wird uebergeben, nicht gelesen -- sonst waere die Funktion nicht
// testbar. jetztMs in Millisekunden (Date.now()), written_at in Sekunden.
export function daemonAlterS(system, jetztMs) {
  const w = system && system.written_at;
  if (typeof w !== 'number' || !Number.isFinite(w)) return null;
  return Math.max(0, Math.round(jetztMs / 1000 - w));
}

// Eine 0 ist ein gemessener Wert und bleibt eine 0. Nur null und undefined
// werden zum Gedankenstrich.
export function strich(v, stellen = 0) {
  return typeof v === 'number' && Number.isFinite(v) ? v.toFixed(stellen) : '—';
}

const FLAGGEN = [
  ['undervoltage',   'Unterspannung'],
  ['arm_freq_capped', 'Takt gedeckelt'],
  ['throttled',      'gedrosselt'],
  ['soft_temp_limit', 'Temp-Limit'],
];

function throttleBlock(titel, teil) {
  if (!teil) return `<div class="tile"><div class="lbl">${titel}</div>
    <div class="db-zeile"><span class="db-wert">—</span></div></div>`;
  return `<div class="tile"><div class="lbl">${titel}</div>
    ${FLAGGEN.map(([k, label]) => `
      <div class="db-zeile">
        <span class="db-label">${label}</span>
        <span class="flag ${teil[k] ? 'an' : 'aus'}">${teil[k] ? 'JA' : 'nein'}</span>
      </div>`).join('')}</div>`;
}

registerPage({
  id: 'system',
  title: 'System',
  ageSource: 'system',
  mount(el) { el.innerHTML = '<div class="sys value"></div>'; },
  render(el, cfg, state) {
    const s = state.system;
    const root = el.querySelector('.sys');
    if (!s) {
      root.innerHTML = '<div class="empty">KEINE SYSTEMDATEN'
        + '<div class="empty-sub">Daemon antwortet nicht</div></div>';
      return;
    }
    const sd = samplesDropped(state.stats);
    const alter = daemonAlterS(s, Date.now());
    const temp = s.cpu_temp_c;
    const zustand = tempZustand(temp);
    const anteil = typeof temp === 'number'
      ? Math.max(0, Math.min(100, (temp - 40) / (MARKEN.hart - 40) * 100)) : 0;
    const marke = c => ((c - 40) / (MARKEN.hart - 40) * 100).toFixed(1);
    root.innerHTML = `
      <div class="sys-oben">
        <div class="tile sys-temp ${zustand}">
          <div class="lbl">CPU-Temperatur</div>
          <div class="huge value">${strich(temp, 1)}<span class="unit-s">°C</span></div>
          <div class="temp-bar">
            <i style="width:${anteil.toFixed(1)}%"></i>
            <u class="m-soft"  style="left:${marke(MARKEN.soft)}%"></u>
            <u class="m-abn"   style="left:${marke(MARKEN.abnahme)}%"></u>
            <u class="m-hart"  style="left:${marke(MARKEN.hart)}%"></u>
          </div>
          <div class="sub-d">Marken ${MARKEN.soft} · ${MARKEN.abnahme} (Abnahme) · ${MARKEN.hart} °C</div>
        </div>
        <div class="tile">
          <div class="lbl">Last · ${strich(s.cpu_count)} Kerne</div>
          <div class="db-zeile"><span class="db-label">1 min</span>
            <span class="db-wert">${strich(s.load && s.load[0], 2)}</span></div>
          <div class="db-zeile"><span class="db-label">5 min</span>
            <span class="db-wert">${strich(s.load && s.load[1], 2)}</span></div>
          <div class="db-zeile"><span class="db-label">15 min</span>
            <span class="db-wert">${strich(s.load && s.load[2], 2)}</span></div>
        </div>
        <div class="tile">
          <div class="lbl">Speicher und Platte</div>
          <div class="db-zeile"><span class="db-label">RAM</span>
            <span class="db-wert">${strich(s.mem_used_mb)} / ${strich(s.mem_total_mb)}<span class="unit-s">MB</span></span></div>
          <div class="db-zeile"><span class="db-label">Platte</span>
            <span class="db-wert">${strich(s.disk_used_gb, 1)} / ${strich(s.disk_total_gb, 1)}<span class="unit-s">GB</span></span></div>
          <div class="db-zeile"><span class="db-label">Uptime</span>
            <span class="db-wert">${s.uptime_s == null ? '—' : Math.floor(s.uptime_s / 86400) + ' d ' + Math.floor(s.uptime_s % 86400 / 3600) + ' h'}</span></div>
        </div>
        <div class="tile">
          <div class="lbl">SDR-Leser</div>
          <div class="db-zeile"><span class="db-label">samples_dropped jetzt</span>
            <span class="db-wert ${sd.jetzt ? 'red' : ''}">${strich(sd.jetzt)}</span></div>
          <div class="db-zeile"><span class="db-label">seit Start</span>
            <span class="db-wert ${sd.gesamt ? 'red' : ''}">${strich(sd.gesamt)}</span></div>
          <div class="db-zeile"><span class="db-label">Takt</span>
            <span class="db-wert">${s.core_clock_hz == null ? '—' : (s.core_clock_hz / 1e6).toFixed(0)}<span class="unit-s">MHz</span></span></div>
          <div class="db-zeile"><span class="db-label">Kernspannung</span>
            <span class="db-wert">${strich(s.core_volts, 2)}<span class="unit-s">V</span></span></div>
        </div>
      </div>
      <div class="sys-unten">
        ${throttleBlock('Drosselung jetzt', s.throttle && s.throttle.now)}
        ${throttleBlock('Drosselung seit Boot', s.throttle && s.throttle.ever)}
        <div class="tile">
          <div class="lbl">Dienste</div>
          ${Object.entries(s.services || {}).map(([name, zustand]) => `
            <div class="db-zeile"><span class="db-label">${name}</span>
              <span class="flag ${zustand === 'active' ? 'aus' : 'an'}">${zustand}</span></div>`).join('')}
        </div>
        <div class="tile">
          <div class="lbl">Daemon</div>
          <div class="db-zeile"><span class="db-label">geschrieben vor</span>
            <span class="db-wert ${alter != null && alter > 30 ? 'red' : ''}">${strich(alter)}<span class="unit-s">s</span></span></div>
        </div>
      </div>`;
  },
});
```

- [ ] **Schritt 4: Testlauf, der grün sein muß**

Ausführen: `node --test tests/test_system.mjs`
Erwartet: PASS, `ℹ tests 10`, `ℹ fail 0`

- [ ] **Schritt 5: Den Test einmal absichtlich rot sehen**

Ändern vorübergehend `if (c >= MARKEN.abnahme) return 'grenze';` zu
`if (c >= MARKEN.soft) return 'grenze';`.
Ausführen: `node --test tests/test_system.mjs`
Erwartet: FAIL in `die Abnahmegrenze 72 Grad ist die erste Farbschwelle, nicht 60` —
`62.3` wäre `grenze` statt `normal`.
**Danach zurücknehmen** und Schritt 4 wiederholen.

- [ ] **Schritt 6: CSS anhängen**

An das Ende von `console/css/console.css`:

```css
/* Systemseite */
.sys { flex: 1; display: flex; flex-direction: column; gap: 14px; min-height: 0; }
.sys-oben, .sys-unten { flex: 1; display: grid; gap: 14px; min-height: 0; }
.sys-oben  { grid-template-columns: 1.25fr 1fr 1fr 1fr; }
.sys-unten { grid-template-columns: 1fr 1fr 1.1fr .8fr; }
.sys-temp .huge { font-size: 62px; margin: 4px 0 10px; }
.sys-temp.normal .huge  { color: #3ddc84; }
.sys-temp.grenze .huge  { color: #f0b429; }
.sys-temp.hart .huge    { color: #ff5a5a; }
.sys-temp.unbekannt .huge { color: #4e6b58; }
.temp-bar { position: relative; height: 14px; background: #0b1f13;
            border: 1px solid #14361f; border-radius: 3px; overflow: hidden; }
.temp-bar i { display: block; height: 100%; background: #2f6b45; }
.temp-bar u { position: absolute; top: 0; width: 2px; height: 100%; }
.temp-bar u.m-soft { background: #4e6b58; }
.temp-bar u.m-abn  { background: #f0b429; }
.temp-bar u.m-hart { background: #ff5a5a; }
.flag { font-size: 19px; font-variant-numeric: tabular-nums; }
.flag.aus { color: #4e9c6a; }
.flag.an  { color: #ff5a5a; font-weight: 700; }
```

- [ ] **Schritt 7: Seite registrieren**

In `console/index.html` nach der `profile.js`-Zeile einfügen:

```html
    import './js/pages/system.js';
```

- [ ] **Schritt 8: Vollständiger Testlauf**

Ausführen: `node --test tests/*.mjs`
Erwartet: `ℹ fail 0`, `ℹ tests` um 10 höher als nach Aufgabe 7.

- [ ] **Schritt 9: Am Gerät prüfen — vom Controller**

Ausrollen wie in Aufgabe 5, Schritt 12. Dann am Panel:

1. **Der Sofortabruf:** Auf die Systemseite blättern und die Sekunden zählen, bis Zahlen
   stehen. **Unter 2 s.** Vor `refreshSystem` waren es bis zu 10 s. Das ist die Prüfung
   für Aufgabe 5, Schritt 7 — hier ist ihr erster möglicher Ort.
2. **Beide Drosselungsblöcke sind getrennt sichtbar** und beide melden „nein".
3. **`samples_dropped`** steht zweimal da und zeigt 0 — nicht „—". Ein Gedankenstrich hieße,
   die Statistik wird nicht gelesen.
4. **Sechs Punkte** in der Indikatorreihe. `polar` steht in `console.json` auf `true` und
   darf trotzdem **keinen** Punkt bekommen — das ist die Gegenprobe auf die Filterregel
   in `console.js:12`.
5. **Daemon töten und die Seite beobachten** (Controller, mit `sudo`):
   ```bash
   ssh adsapp01 'sudo systemctl stop atc-daemon'
   ```
   Der Wert „geschrieben vor" muß sichtbar wachsen und ab 30 s rot werden. Radar, Board,
   Statistik, Einzelziel und Höhenprofil laufen unverändert weiter.
   ```bash
   ssh adsapp01 'sudo systemctl start atc-daemon'
   ```
   Die Seite erholt sich ohne Neuladen.

- [ ] **Schritt 10: Commit**

```bash
git add console/js/pages/system.js tests/test_system.mjs \
        console/css/console.css console/index.html
git commit -m "System-Seite: drei Temperaturmarken, samples_dropped aus stats.json"
```

---

### Aufgabe 9: B612 im Radarkreis

Spec §4.2/§6.1 und `CLAUDE.md` versprechen einen gebundelten Font; die CSS nimmt
`ui-monospace`. Die Zusage wird auf den **Radarkreis** begrenzt und dort eingelöst.

**Falle, die diese Aufgabe kostet, wenn man sie übersieht:** Der Hintergrund des Radars
wird **einmal** gezeichnet (`drawnBg`) und setzt an drei Stellen `ctx.font` — Zeilen 46, 54
und 98 in `radar.js`. Eine Canvas-Schrift, die zum Zeichenzeitpunkt noch nicht geladen ist,
fällt lautlos auf die Ersatzschrift zurück und wird **nie** neu gezeichnet.

**Dateien:**
- Erstellen: `console/fonts/B612Mono-Regular.ttf`, `console/fonts/OFL.txt`,
  `console/fonts/TRADEMARKS.md`, `console/fonts/HERKUNFT.md`
- Ändern: `console/css/console.css`
- Ändern: `console/js/pages/radar.js` (Schrift laden, bevor der Hintergrund entsteht)

**Schnittstellen:**
- Verbraucht: nichts
- Erzeugt: CSS-Familie `B612Mono`, nur innerhalb `.radar-wrap`

- [ ] **Schritt 1: Font und Lizenztexte holen**

```bash
mkdir -p console/fonts
cd console/fonts
curl -fsSLO https://raw.githubusercontent.com/polarsys/b612/master/fonts/ttf/B612Mono-Regular.ttf
curl -fsSLO https://raw.githubusercontent.com/polarsys/b612/master/OFL.txt
curl -fsSLO https://raw.githubusercontent.com/polarsys/b612/master/TRADEMARKS.md
sha256sum B612Mono-Regular.ttf
ls -l
cd ../..
```

Erwartet: `B612Mono-Regular.ttf` mit rund 140 KB, `OFL.txt` und `TRADEMARKS.md` vorhanden.

- [ ] **Schritt 2: Die Lizenz LESEN, nicht annehmen**

`console/fonts/OFL.txt` und `console/fonts/TRADEMARKS.md` **vollständig lesen** und
schriftlich beantworten:

1. Erlaubt die Lizenz das **Bündeln und Weitergeben** der Schriftdatei in diesem Repo?
2. Gibt es einen **Reserved Font Name**, und wird er hier verletzt? (Die Datei wird nicht
   verändert und nicht umbenannt — das ist der übliche Auslöser.)
3. Verlangt die Lizenz, daß der Lizenztext mitgeliefert wird? (Wenn ja: Schritt 1 hat ihn
   bereits abgelegt.)

**Ist eine der Antworten unklar oder negativ, bricht diese Aufgabe hier ab** und wird
gemeldet. Sie wird **nicht** auf Verdacht fortgesetzt. Der Rest der Stufe 2 hängt nicht
daran — die Konsole läuft unverändert mit `ui-monospace`.

- [ ] **Schritt 3: Die Herkunft festhalten**

Neue Datei `console/fonts/HERKUNFT.md`:

```markdown
# Herkunft der gebundelten Schrift

**B612 Mono Regular**, aus `https://github.com/polarsys/b612`,
Pfad `fonts/ttf/B612Mono-Regular.ttf`, geholt am 2026-07-28.

Lizenz: SIL Open Font License 1.1 — der vollständige Text liegt als `OFL.txt`
daneben, die Markenhinweise als `TRADEMARKS.md`. Beide wurden vor der Übernahme
gelesen, nicht angenommen.

SHA256 der Schriftdatei: <hier den Wert aus Schritt 1 eintragen>

B612 wurde von Airbus für Cockpitanzeigen entworfen. Sie wird hier **nur im
Radarkreis** benutzt (Kontakt-Overlays, Flugplatzkennungen, Ringbeschriftung);
Kacheln, Tabellen und alle übrigen Seiten bleiben bei `ui-monospace`.

Die Datei ist einmal beim Bauen eingefroren worden, genau wie
`console/data/airports.json`. **Zur Laufzeit wird nichts nachgeladen** — das
wird bei der Abnahme durch Ziehen des Netzsteckers geprüft, nicht behauptet.
```

Den SHA256-Wert aus Schritt 1 eintragen.

- [ ] **Schritt 4: CSS — Schrift deklarieren und auf den Radarkreis begrenzen**

An das Ende von `console/css/console.css`:

```css
/* B612 Mono, lokal gebundelt (console/fonts/HERKUNFT.md). NUR im
   Radarkreis: Dort sind die Texte kurz und unumbrechbar (Callsign, FL,
   Squawk, ICAO-Kennung). Kacheln und Tabellen bleiben bei ui-monospace --
   eine andere Laufweite dort hiesse, jedes Layout neu zu beurteilen. */
@font-face {
  font-family: 'B612Mono';
  src: url('../fonts/B612Mono-Regular.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
  font-display: block;
}
.radar-wrap .blip .lab { font-family: 'B612Mono', ui-monospace, monospace; }
```

- [ ] **Schritt 5: Die Canvas-Schrift laden, bevor der Hintergrund gezeichnet wird**

In `console/js/pages/radar.js` die drei `ctx.font`-Zeilen ändern:

- Zeile 46: `ctx.font = '13px ui-monospace, monospace';` → `ctx.font = "13px B612Mono, ui-monospace, monospace";`
- Zeile 54: dieselbe Änderung
- Zeile 98: `ctx.font = '12px ui-monospace, monospace';` → `ctx.font = "12px B612Mono, ui-monospace, monospace";`

Und in `mount`, in der Zeile

```javascript
    loadAirports().then(() => { el._ctx.drawnBg = false; });
```

ersetzen durch:

```javascript
    // Der Hintergrund wird nur EINMAL gezeichnet (drawnBg). Eine Canvas-
    // Schrift, die zum Zeichenzeitpunkt noch nicht geladen ist, faellt
    // lautlos auf die Ersatzschrift zurueck -- und wird nie neu gezeichnet.
    // Deshalb erst die Schrift, dann die Flugplaetze, dann freigeben.
    Promise.all([
      loadAirports(),
      document.fonts ? document.fonts.load('13px B612Mono').catch(() => null) : null,
    ]).then(() => { el._ctx.drawnBg = false; });
```

- [ ] **Schritt 6: Testlauf — nichts darf sich geändert haben**

Ausführen: `node --test tests/*.mjs`
Erwartet: `ℹ fail 0`, `ℹ tests` unverändert gegenüber Aufgabe 8.

- [ ] **Schritt 7: Am Gerät prüfen — vom Controller, und zwar an den RÄNDERN**

Ausrollen wie in Aufgabe 5, Schritt 12. Dann am Panel:

1. **Sieht die Schrift im Radarkreis anders aus als in den Kacheln daneben?** Wenn nicht,
   ist die Datei nicht geladen worden — im Chromium-Netzwerklog nachsehen, nicht raten.
2. **Östlicher und westlicher Bildrand.** Befund 5 der Stufe-1-Abnahme war eine
   abgeschnittene Flugplatzkennung (EDFJ) am östlichen Rand — mit der **schmaleren**
   Schrift. Warten, bis Ziele nahe an den Rändern stehen, und die Beschriftung prüfen.
   Wird etwas abgeschnitten, ist das der Grund für den Rückzug.
3. **Ringbeschriftung und Peilstrahl-Beschriftung** sind lesbar und nicht verrutscht.
4. **Der Rückzug ist eine CSS-Zeile.** Sieht es schlechter aus als vorher, wird Schritt 4
   zurückgenommen und die Aufgabe als „erprobt und verworfen" dokumentiert — das ist ein
   Ergebnis, kein Fehlschlag.
5. **Vor dem Urteil hart neu laden.**

- [ ] **Schritt 8: Commit**

```bash
git add console/fonts console/css/console.css console/js/pages/radar.js
git commit -m "B612 Mono im Radarkreis: lokal gebundelt, Lizenz am Text geprueft"
```

---

### Aufgabe 10: Die restliche Spec-Drift im Code

Drei Zusagen, die im Hauptentwurf stehen und im Code fehlen.

**Dateien:**
- Ändern: `console/css/console.css` (Wisch-Übergang)
- Ändern: `console/js/console.js` (richtungsabhängige Klasse, Altersanzeige mit Uhrzeit)
- Ändern: `console/js/pages/board.js`, `target.js`, `profile.js` (Leerzustand mit Uhrzeit)

**Schnittstellen:**
- Verbraucht: nichts
- Erzeugt: `letzteZielzeit(state) → string | null` in `console/js/data.js`, exportiert

- [ ] **Schritt 1: Den fehlschlagenden Test für die Uhrzeit schreiben**

In `tests/test_data.mjs` die bestehende Importzeile erweitern zu

```javascript
import { pruefeReceiver, letzteZielzeit } from '../console/js/data.js';
```

und an das Dateiende anhängen:

```javascript
test('ohne je gesehenes Ziel gibt es keine Uhrzeit', () => {
  assert.equal(letzteZielzeit({ letztesZielMs: null }), null);
  assert.equal(letzteZielzeit({}), null);
});

test('die Uhrzeit des letzten Ziels wird als HH:MM ausgegeben', () => {
  // 2026-07-28 09:05 lokal, als Zeitstempel uebergeben -- die Funktion
  // liest keine Uhr, sie formatiert nur.
  const t = new Date(2026, 6, 28, 9, 5, 0).getTime();
  assert.equal(letzteZielzeit({ letztesZielMs: t }), '09:05');
});
```

- [ ] **Schritt 2: Testlauf, der fehlschlagen muß**

Ausführen: `node --test tests/test_data.mjs`
Erwartet: FAIL mit `does not provide an export named 'letzteZielzeit'`

- [ ] **Schritt 3: Zeitstempel führen und formatieren**

In `console/js/data.js` im `state`-Objekt von `createDataStore` ergänzen:

```javascript
    letztesZielMs: null,
```

In `pollAircraft` nach `state.aircraftAt = Date.now();` einfügen:

```javascript
      // Wann stand hier zuletzt ein Ziel? Der Leerzustand soll "seit wann"
      // sagen koennen, nicht nur "nichts". Frankfurt hat ein
      // Nachtflugverbot -- null Ziele um 03:00 ist richtig, nicht kaputt.
      if (state.aircraft.length) state.letztesZielMs = state.aircraftAt;
```

An das Dateiende anhängen:

```javascript
// Liest keine Uhr -- der Zeitstempel kommt aus dem Zustand. Sonst waere
// die Funktion nicht testbar.
export function letzteZielzeit(state) {
  const ms = state && state.letztesZielMs;
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return null;
  return new Date(ms).toLocaleTimeString('de-DE',
    { hour: '2-digit', minute: '2-digit', hour12: false });
}
```

- [ ] **Schritt 4: Testlauf, der grün sein muß**

Ausführen: `node --test tests/test_data.mjs`
Erwartet: PASS, `ℹ fail 0`

- [ ] **Schritt 5: Den Test einmal absichtlich rot sehen**

Ändern vorübergehend `hour: '2-digit'` zu `hour: 'numeric'`.
Ausführen: `node --test tests/test_data.mjs`
Erwartet: FAIL in `die Uhrzeit des letzten Ziels wird als HH:MM ausgegeben` — `9:05`
statt `09:05`.
**Danach zurücknehmen** und Schritt 4 wiederholen.

- [ ] **Schritt 6: Den Leerzustands-Untertitel an genau einen Ort legen**

Vier Seiten haben einen Leerzustand (Radar, Board, Einzelziel, Höhenprofil), und alle vier
sollen dieselbe Aussage machen. Der Untertitel gehört deshalb neben `msgRate` in das
gemeinsame Modul und nicht viermal in die Seiten.

In `console/js/pages/gemeinsam.js` anhängen:

```javascript
import { letzteZielzeit } from '../data.js';

// Der Untertitel jedes Leerzustands. Zwei Aussagen, beide noetig:
// seit wann kein Ziel mehr da war, und ob der Empfaenger ueberhaupt noch
// Nachrichten sieht. Frankfurt hat ein Nachtflugverbot -- null Ziele um
// 03:00 ist richtig, nicht kaputt; genau deshalb muss die Anzeige
// "nichts fliegt" von "Empfaenger tot" unterscheidbar halten.
export function leerUntertitel(state) {
  const seit = letzteZielzeit(state);
  return (seit ? `letztes Ziel ${seit} · ` : '') + `Nachrichtenrate ${msgRate(state)} /s`;
}
```

Dann in **allen vier** Seiten den Untertitel des Leerzustands durch
`${leerUntertitel(state)}` ersetzen und den Import auf
`import { msgRate, leerUntertitel } from './gemeinsam.js';` erweitern (in `radar.js` und
`board.js` wird `msgRate` danach womöglich gar nicht mehr gebraucht — dann nur
`leerUntertitel` importieren):

- `console/js/pages/radar.js` — in `renderSide`, Leerzustand `KEINE ZIELE IN REICHWEITE`
- `console/js/pages/board.js` — Leerzustand `KEINE ZIELE IN REICHWEITE`
- `console/js/pages/target.js` — Leerzustand `KEIN ZIEL MIT POSITION`
- `console/js/pages/profile.js` — Leerzustand `KEINE ZIELE MIT HÖHE`

Beispiel für `board.js`:

```javascript
      root.innerHTML = `<div class="empty">KEINE ZIELE IN REICHWEITE
        <div class="empty-sub">${leerUntertitel(state)}</div></div>`;
```

- [ ] **Schritt 7: „keine Daten seit HH:MM" in der Kopfzeile**

In `console/js/console.js` in `updateAge` die Zeile

```javascript
    txt.textContent = ms == null ? 'keine Daten' : `${Math.round(ms / 1000)} s`;
```

ersetzen durch:

```javascript
    // Spec 8 sagt "keine Daten seit HH:MM" zu. Eine Uhrzeit sagt, seit
    // wann; "keine Daten" sagt es nicht.
    if (ms == null) {
      txt.textContent = at == null ? 'keine Daten' : `keine Daten seit ${uhrzeit(at)}`;
    } else if (ms >= 60000) {
      txt.textContent = `keine Daten seit ${uhrzeit(at)}`;
    } else {
      txt.textContent = `${Math.round(ms / 1000)} s`;
    }
```

und direkt vor `function updateAge(page) {` einfügen:

```javascript
  const uhrzeit = ms => new Date(ms).toLocaleTimeString('de-DE',
    { hour: '2-digit', minute: '2-digit', hour12: false });
```

- [ ] **Schritt 8: Der richtungsabhängige Wisch (200 ms)**

In `console/css/console.css` die Regel `.page` (Zeile 24–25) ergänzen und darunter zwei
neue Regeln einfügen:

```css
.page { position: absolute; inset: 0; padding: 16px 0 6px; display: flex; gap: 20px;
        opacity: 0; pointer-events: none; transition: opacity 180ms linear; }
.page.active { opacity: 1; pointer-events: auto; }
/* Spec 7.1: Ein Wisch schiebt die Seite in Wischrichtung heraus (200 ms),
   damit sich die Geste wie eine Geste anfuehlt. Der automatische Wechsel
   blendet weiterhin nur ueber (180 ms). */
.page.wisch-links  { transition: opacity 200ms linear, transform 200ms ease-out;
                     transform: translateX(-90px); }
.page.wisch-rechts { transition: opacity 200ms linear, transform 200ms ease-out;
                     transform: translateX(90px); }
```

In `console/js/console.js` die Signatur von `goTo` erweitern und die Klasse setzen:

```javascript
  function goTo(index, rotate = true, wischRichtung = null) {
    const next = ((index % order.length) + order.length) % order.length;
    if (next === current) return;
    const alt = els.get(order[current]);
    alt.classList.remove('active');
    alt.classList.remove('wisch-links', 'wisch-rechts');
    if (wischRichtung) {
      alt.classList.add(wischRichtung < 0 ? 'wisch-links' : 'wisch-rechts');
      setTimeout(() => alt.classList.remove('wisch-links', 'wisch-rechts'), 220);
    }
    current = next;
    betrete(current);
    renderCurrent();
    els.get(order[current]).classList.add('active');
    dotsEl.querySelectorAll('.dot')
      .forEach((d, i) => d.classList.toggle('on', i === current));
    if (rotate) startRotation();
  }
```

und im `pointerup`-Handler die Zeile

```javascript
      goTo(current + (dx < 0 ? 1 : -1), false);
```

ersetzen durch:

```javascript
      goTo(current + (dx < 0 ? 1 : -1), false, dx < 0 ? -1 : 1);
```

- [ ] **Schritt 9: Vollständiger Testlauf**

Ausführen: `node --test tests/*.mjs`
Erwartet: `ℹ fail 0`, `ℹ tests` um 2 höher als nach Aufgabe 9.

- [ ] **Schritt 10: Am Gerät prüfen — vom Controller**

1. **Wischen** nach links und nach rechts: Die alte Seite schiebt sich sichtbar in
   Wischrichtung heraus. Der automatische Wechsel blendet weiterhin nur über.
2. **Wischen darf Chromium nicht zurücknavigieren** — die Prüfung aus Stufe 1, hier
   wiederholt, weil `goTo` angefaßt wurde.
3. **Leerzustand mit präparierter Quelle herstellen** (leeres `aircraft`-Array) und die
   Uhrzeit lesen. Danach die Quelle zurückstellen.
4. **Kopfzeile:** Bei über 60 s altem Datenstand steht dort „keine Daten seit HH:MM".

- [ ] **Schritt 11: Commit**

```bash
git add console/js/data.js console/js/console.js console/js/pages/gemeinsam.js \
        console/js/pages/radar.js console/js/pages/board.js \
        console/js/pages/target.js console/js/pages/profile.js \
        console/css/console.css tests/test_data.mjs
git commit -m "Spec-Drift geschlossen: Wisch-Richtung, Uhrzeit im Leerzustand und im Kopf"
```

---

### Aufgabe 11: Die Dokumente auf den Stand bringen

Kein Dokument darf nach dieser Stufe etwas behaupten, das nicht stimmt. Diese Aufgabe
ändert **keinen** Produktivcode außer einer Zeile in `install-console.sh`.

**Dateien:**
- Ändern: `docs/specs/2026-07-27-atc-konsole-design.md`
- Ändern: `docs/messungen/2026-07-27-variante-b-stunde.md`
- Ändern: `CLAUDE.md`
- Ändern: `install-console.sh:85-87`

- [ ] **Schritt 1: Hauptentwurf nachziehen**

In `docs/specs/2026-07-27-atc-konsole-design.md`:

| Abschnitt | Änderung |
|---|---|
| §4.2 | Im Repo-Baum `fonts/` erläutern als „gebundelter Font, **nur im Radarkreis**"; `js/pages/*.js` unverändert |
| §5.3 | Im `system.json`-Beispiel `"samples_dropped": 0` **streichen** und `"written_at": 1785224553.5` ergänzen; im Fließtext ergänzen, daß `written_at` der Schreibzeitpunkt ist und die Systemseite daran das Altern erkennt |
| §6.1 | Satz „verblaßt über `decay_s` = 6 s" ersetzen durch: „verblaßt über `decay_s`, **begrenzt auf einen Sweep-Umlauf**: In Variante B hängt das Verglimmen an der sweep-gekoppelten CSS-Animation, ein `decay_s` über `sweep_s` ist dort nicht darstellbar und wird auf 0,98 × `sweep_s` gedeckelt." Ebenso den Font-Absatz auf den Radarkreis begrenzen |
| §6.3 | Rumpf vollständig ersetzen, Wortlaut unten |
| §6.6 | Rumpf vollständig ersetzen, Wortlaut unten |

Für §6.3 den gesamten Absatz ersetzen durch:

```markdown
### 6.3 Einzelziel

**Neu gefaßt am 28.07.2026**, maßgeblich ist
[`2026-07-28-stufe-2-entwurf.md`](2026-07-28-stufe-2-entwurf.md) §4.1.

Die ursprüngliche Fassung („das nächstgelegene Ziel mit Position, groß") war beim
Bau der Stufe 2 fast vollständig Wiederholung: Der Datenblock rechts auf der
Radarseite zeigt Callsign, Heavy, FL, Entfernung, Peilung, Track-Symbol, GS,
Steig-/Sinkrate und Squawk bereits, und das ein Drittel der Karussellzeit. Übrig
blieben genau drei zusätzliche Felder — eine ganze Seite dafür ist eine Dublette.

Die Seite zeigt stattdessen ein **volles Datenblatt**: Geschwindigkeitstrias,
Höhentrias samt der im Autopiloten eingestellten Zielflugfläche
(`nav_altitude_mcp`, in der Messung vom 28.07. bei 18 von 18 positionierten
Zielen belegt), Lage, Ort, Empfangs- und Positionsgüte. Ihr Ziel friert beim
Betreten der Seite ein.
```

Für §6.6 den gesamten Absatz ersetzen durch:

```markdown
### 6.6 Höhenprofil

**Neu gefaßt am 28.07.2026**, maßgeblich ist
[`2026-07-28-stufe-2-entwurf.md`](2026-07-28-stufe-2-entwurf.md) §4.2.

Die ursprüngliche Fassung (sechs Balken nach Flugflächenbändern) scheiterte an
einer Messung über eine Stunde, 1808 Positionen: Ein Band hält 57 %, ein anderes
im Mittel 0,3 Ziele. Sechs Balken, von denen einer immer lang und einer immer
leer ist, ändern sich nicht sichtbar.

Vor allem aber summiert die Bänderzählung die **Entfernung** weg — und damit die
Struktur, die wirklich da ist: ein Reiseflugband FL320–FL400 über die vollen
50 NM und ein Flughafenkegel innerhalb von 10 NM unterhalb FL050, mit einer
Lücke dazwischen. Die Seite zeigt deshalb einen **Seitenriß** (Höhe über
Entfernung, x-Achse im Maßstab des Radars) und behält die sechs Bänder als
Zählspalte daneben.
```
| §6.7 | Dritte Temperaturmarke (72 °C Abnahmegrenze) ergänzen und festhalten, daß nur bei 72 und 80 die Farbe wechselt; `samples_dropped` als „aus `stats.json`, in zwei Werten" kennzeichnen |
| §11 | Stufe 2 auf den umgesetzten Inhalt bringen; ergänzen, daß nach Stufe 2 **sechs** Seiten laufen und Polar erst mit Stufe 3 dazukommt |

- [ ] **Schritt 2: Das Meßprotokoll korrigieren**

In `docs/messungen/2026-07-27-variante-b-stunde.md` den letzten Aufzählungspunkt
(„Die Radarseite war rund ein Drittel der Zeit sichtbar, wie im Regelbetrieb.") ersetzen
durch:

```markdown
- **Korrektur vom 28.07.: Die Radarseite war 60 % der Zeit sichtbar, nicht ein Drittel.**
  Der ursprüngliche Satz war nach den eigenen Zahlen dieses Dokuments falsch. `console.js`
  filtert `activePages` gegen die **registrierten** Renderer; am Meßcommit `be74d8a`
  registrierte `index.html` genau drei Seiten (Radar, Board, Statistik). Bei Standzeiten
  von 45 + 15 + 15 s ergibt das einen Umlauf von 75 s und einen Radaranteil von 45/75 =
  60 %.

  Das macht diese Stunde zu einem **härteren** Prüfling als den Regelbetrieb: Mit den
  sechs Seiten der Stufe 2 fällt der Radaranteil auf 45/120 = 37,5 %. **Daraus folgt
  nicht, daß die Konsole seither kühler läuft** — das wäre die Behauptung anstelle der
  Messung. Es folgt nur, daß die 0,5 K Marge unter ungünstigeren Bedingungen erarbeitet
  wurde als notiert.
```

- [ ] **Schritt 3: `CLAUDE.md` nachziehen**

In `CLAUDE.md` im Abschnitt „Nicht verhandelbar" den Punkt „Keine Fremdquelle zur Laufzeit"
ergänzen um:

```markdown
  Die einzige gebundelte Fremddatei ist `console/fonts/B612Mono-Regular.ttf` (SIL OFL 1.1,
  Herkunft und Prüfsumme in `console/fonts/HERKUNFT.md`) — sie wird **nur im Radarkreis**
  benutzt und wie `console/data/airports.json` einmal beim Bauen eingefroren.
```

Im Abschnitt „Struktur" den Baum um `console/fonts/` und die drei neuen Seitenmodule
ergänzen.

- [ ] **Schritt 4: `fonts-noto-color-emoji` aus dem Installationsskript**

In `install-console.sh` Zeile 85 den Text ändern von

```
echo "Installing labwc, wlr-randr, chromium, seatd, curl and a colour emoji font …"
```

zu

```
echo "Installing labwc, wlr-randr, chromium, seatd and curl …"
```

und Zeile 87 von

```
apt-get install -y --no-install-recommends labwc wlr-randr chromium seatd curl fonts-noto-color-emoji
```

zu

```
# Kein Emoji-Font: Die Konsole benutzt keine Emoji, und die Radarschrift
# liegt gebundelt im Repo (console/fonts/HERKUNFT.md).
apt-get install -y --no-install-recommends labwc wlr-randr chromium seatd curl
```

- [ ] **Schritt 5: Gegenprobe — behauptet noch irgendein Dokument etwas Falsches?**

```bash
grep -rn "samples_dropped" docs/ daemon/ console/ | grep -v "stats.json"
grep -rn "ein Drittel der Zeit" docs/
grep -rn "fonts-noto-color-emoji" .
grep -rniE "B612" docs/ CLAUDE.md console/css/
```

Erwartet: Die ersten drei Aufrufe geben **nichts** aus. Der vierte zeigt nur Stellen, die
B612 auf den Radarkreis begrenzen.

- [ ] **Schritt 6: Commit**

```bash
git add docs/ CLAUDE.md install-console.sh
git commit -m "Dokumente auf den Stand gebracht: Font, samples_dropped, decay_s, 60 statt 33 Prozent"
```

---

### Aufgabe 12: Wärmemessung und Geräteabnahme

**Diese Aufgabe führt der Controller in der Hauptsitzung aus, gemeinsam mit Henning am
Panel.** Ein Subagent führt sie nicht aus.

**Dateien:**
- Erstellen: `docs/messungen/2026-07-28-stufe-2-stunde.md`
- Erstellen: `docs/abnahme/2026-07-28-stufe-2.md`

- [ ] **Schritt 1: Die Kriterien stehen fest, bevor gemessen wird**

Unverändert vom Spike am 27.07. — **eine Grenze, die man nach der Messung verschiebt, ist
keine:**

| Kriterium | Grenze |
|---|---|
| `total.local.samples_dropped` | bleibt **0** — das harte Kriterium |
| `get_throttled` | bleibt `0x0` |
| CPU-Temperatur | unter **72 °C** |

- [ ] **Schritt 2: Baseline am selben Nachmittag**

Ohne sie ist der Absolutwert nicht deutbar: Der Leerlaufwert dieses Geräts lag im Mai bei
~55 °C, am 27.07. bei 62,3 °C — rund sieben Kelvin allein aus der Umgebung.

```bash
ssh adsapp01 'sudo systemctl stop atc-console; sleep 120; for i in 1 2 3 4 5; do vcgencmd measure_temp; uptime; sleep 30; done'
```

Werte notieren. Danach den Kiosk wieder starten.

- [ ] **Schritt 3: Eine Stunde im Regelbetrieb messen**

Sechs Seiten, Umlauf 2:00, 120 Punkte im 30-Sekunden-Abstand:

```bash
ssh adsapp01 'for i in $(seq 1 120); do printf "%s;%s;%s;%s\n" \
  "$(date -Is)" \
  "$(vcgencmd measure_temp | cut -d= -f2)" \
  "$(vcgencmd get_throttled | cut -d= -f2)" \
  "$(cut -d" " -f1-3 /proc/loadavg)"; \
  curl -s http://127.0.0.1/skyaware/data/stats.json | python3 -c "import json,sys; print(json.load(sys.stdin)[\"total\"][\"local\"][\"samples_dropped\"])"; \
  sleep 30; done' | tee /tmp/stufe2-stunde.csv
```

- [ ] **Schritt 4: Das Protokoll schreiben**

Neue Datei `docs/messungen/2026-07-28-stufe-2-stunde.md` mit: Kriterien (aus Schritt 1,
**vor** den Ergebnissen), Baseline, Min/Max/Mittel der Temperatur, Verlauf erstes gegen
letztes Viertel, Last, `get_throttled`, `samples_dropped`, Ergebnis je Kriterium.

**Ausdrücklich mit aufnehmen:** Diese Messung beantwortet **nicht**, ob die drei neuen
Seiten billig sind. Es haben sich zwei Dinge gleichzeitig geändert — drei Seiten kamen
hinzu, und der Radaranteil fiel von 60 % auf 37,5 %. Ein kühleres Ergebnis darf **nicht**
als „die neuen Seiten kosten nichts" gelesen werden.

**Reißt ein Kriterium**, ist der Rückfall keine Neuentwicklung, sondern eine
Konfigurationsentscheidung: Standzeiten und Radaranteil stehen in `console.json`. Sie wird
dann nach demselben Verfahren gemessen.

- [ ] **Schritt 5: Abnahme — absichtlich gegen die Absicht bedient**

Die elf Punkte aus §7.3 des Stufe-2-Entwurfs abarbeiten. Jeder bekommt ein Ergebnis:
bestanden, durchgefallen, oder „nicht geprüft" mit Begründung.

Zur Erinnerung die drei, die man am leichtesten vergißt:

- **Netzstecker ziehen** — jetzt mit gebundeltem Font. Genau die Zusage, die man beim
  ersten Mal einhält und beim zweiten Mal vergißt.
- **`polar` steht auf `true` und darf trotzdem keinen Punkt bekommen** — sechs Punkte in
  der Indikatorreihe, nicht sieben.
- **Vor jedem Layout-Urteil sicherstellen, daß die geladene Fassung die gebaute ist.**

- [ ] **Schritt 6: Das Abnahmedokument schreiben**

Neue Datei `docs/abnahme/2026-07-28-stufe-2.md`, im Aufbau wie
`docs/abnahme/2026-07-27-stufe-1.md`: Ergebnistabelle, durchgefallene Prüfungen mit
Ursache und Reparatur, Wärme, **„Was diese Abnahme nicht zeigt"**, und **„Was am Panel
gefunden wurde und kein Test finden konnte"**.

Der vorletzte Abschnitt ist der wichtigste. In Stufe 1 standen dort fünf ehrliche
Einschränkungen; sie waren mehr wert als jede bestandene Zeile.

- [ ] **Schritt 7: Commit und PR**

```bash
git add docs/messungen/2026-07-28-stufe-2-stunde.md docs/abnahme/2026-07-28-stufe-2.md
git commit -m "Stufe 2 abgenommen: eine Stunde gemessen, elf Punkte gegen die Absicht"
git push -u origin session/2026-07-28-atc-konsole-stufe-2
gh pr create --fill
```

---

## Was dieser Plan bewußt nicht enthält

- **Die Polar-Seite.** Stufe 3. Sie braucht ohnehin Laufzeit, bis die Rekorde
  aussagefähig sind.
- **Auswahl eines Ziels per Fingertipp.** Eine Wandanzeige, die von selbst das Richtige
  zeigt, schlägt eine, deren Zustand jemand zurücksetzen müßte.
- **Änderungen am Daemon.** `samples_dropped` kommt aus `stats.json`; der Daemon bleibt in
  dieser Stufe unangetastet.
- **Eine DOM-Testumgebung.** Was nur im Browser läuft, wird am Gerät geprüft. In Stufe 1
  fanden vierzehn Befunde statt, neun davon am Panel und keiner durch einen Test — eine
  Attrappe hätte daran nichts geändert.
