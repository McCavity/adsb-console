import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeConfig, DEFAULTS } from '../console/js/config.js';

test('leere Eingabe ergibt die Vorgabewerte', () => {
  const c = mergeConfig(null);
  assert.deepEqual(c.pages, DEFAULTS.pages);
  assert.equal(c.radar.range_nm, 50);
});

test('Teilangaben ueberschreiben nur das Genannte', () => {
  const c = mergeConfig({ radar: { range_nm: 25 } });
  assert.equal(c.radar.range_nm, 25);
  assert.equal(c.radar.sweep_s, DEFAULTS.radar.sweep_s);
  assert.equal(c.dwell_s.radar, DEFAULTS.dwell_s.radar);
});

test('unbekannte Seitennamen werden verworfen, nicht uebernommen', () => {
  const c = mergeConfig({ pages: { gibtsnicht: true, radar: false } });
  assert.equal(c.pages.gibtsnicht, undefined);
  assert.equal(c.pages.radar, false);
});

test('alle Seiten aus ergibt trotzdem eine sichtbare Konsole', () => {
  // Ein weisser Schirm wegen einer Konfiguration ist inakzeptabel.
  const c = mergeConfig({ pages: { radar: false, board: false, target: false,
    stats: false, polar: false, profile: false, system: false } });
  assert.ok(c.activePages.length >= 1, 'mindestens eine Seite muss bleiben');
  assert.equal(c.activePages[0], 'radar');
});

test('unsinnige Zahlen fallen auf die Vorgabe zurueck', () => {
  assert.equal(mergeConfig({ radar: { range_nm: 0 } }).radar.range_nm, DEFAULTS.radar.range_nm);
  assert.equal(mergeConfig({ radar: { range_nm: -5 } }).radar.range_nm, DEFAULTS.radar.range_nm);
  assert.equal(mergeConfig({ radar: { sweep_s: -1 } }).radar.sweep_s, DEFAULTS.radar.sweep_s);
  assert.equal(mergeConfig({ radar: { range_nm: 'weit' } }).radar.range_nm, DEFAULTS.radar.range_nm);
  assert.equal(mergeConfig({ dwell_s: { radar: 0 } }).dwell_s.radar, DEFAULTS.dwell_s.radar);
});

test('falsche Typen an der Wurzel werden ignoriert', () => {
  assert.deepEqual(mergeConfig('kaputt').pages, DEFAULTS.pages);
  assert.deepEqual(mergeConfig([1, 2, 3]).pages, DEFAULTS.pages);
  assert.deepEqual(mergeConfig({ pages: 'ja' }).pages, DEFAULTS.pages);
});

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

test('stufen: konfigurierte Reichweite bleibt erreichbar, auch wenn kein Ring hineinpasst', () => {
  const cfg = mergeConfig({ radar: { range_nm: 5 } });
  const eigene = cfg.radar.stufen.find(s => s.range_nm === 5);
  assert.ok(eigene, 'Reichweite 5 fehlt in der Stufenliste');
  assert.deepEqual(eigene.rings_nm, [5]);
});

// console.json ist die Vorgabe -- auch fuer die Ringe. Bis zum 31.07.2026
// gewann die eingebaute Stufe, sobald die konfigurierte Reichweite zufaellig
// auf sie passte: Wer rings_nm aenderte, sah nichts passieren, ohne
// Fehlermeldung. Genau das prueft dieser Fall.
test('stufen: konfigurierte Ringe ersetzen die Ringe der passenden Stufe', () => {
  const cfg = mergeConfig({ radar: { range_nm: 50, rings_nm: [5, 20, 50] } });
  const fuenfziger = cfg.radar.stufen.filter(s => s.range_nm === 50);
  assert.equal(fuenfziger.length, 1, 'die Ersetzung darf keine Dublette erzeugen');
  assert.deepEqual(fuenfziger[0].rings_nm, [5, 20, 50]);
});

test('stufen: auch die ersetzten Ringe werden gehaertet', () => {
  // 90 passt nicht in 50 NM -- die Haertung muss auf dem Ersetzungsweg
  // genauso greifen wie auf dem Ergaenzungsweg, sonst zeichnet die
  // Radarseite ausserhalb ihres Kreises.
  const cfg = mergeConfig({ radar: { range_nm: 50, rings_nm: [5, 90, 20, 50] } });
  const fuenfziger = cfg.radar.stufen.find(s => s.range_nm === 50);
  assert.deepEqual(fuenfziger.rings_nm, [5, 20, 50]);
});

// Die Kehrseite: Ohne eigene rings_nm gibt es nichts zu ersetzen. Die
// Vorgabeliste (DEFAULTS.radar.rings_nm) ist KEINE Angabe aus console.json --
// wer sie hier durchschlagen liesse, machte aus "range_nm: 10" eine Stufe
// mit dem einzigen Ring 10 und naehme der 10-NM-Ansicht ihr Gitter.
test('stufen: ohne eigene Ringliste behaelt die getroffene Stufe ihre Ringe', () => {
  const cfg = mergeConfig({ radar: { range_nm: 10 } });
  const zehner = cfg.radar.stufen.find(s => s.range_nm === 10);
  assert.deepEqual(zehner.rings_nm, [2, 5, 10]);
});

test('stufen: eine unbrauchbare Ringliste ersetzt nichts', () => {
  // ['a'] faellt schon bei radar.rings_nm auf die Vorgabe zurueck; eine
  // leere Liste ist eine Angabe, aber keine, aus der eine Stufe wird.
  for (const kaputt of [['weit'], [], [0], [-1]]) {
    const cfg = mergeConfig({ radar: { range_nm: 80, rings_nm: kaputt } });
    const achtziger = cfg.radar.stufen.find(s => s.range_nm === 80);
    assert.deepEqual(achtziger.rings_nm, [20, 50, 80],
      `${JSON.stringify(kaputt)} haette die eingebauten Ringe nicht antasten duerfen`);
  }
});

// Zwei Angaben aus derselben Datei widersprechen sich: eine eigene
// Stufenliste MIT Ringen fuer 50 und dazu ein eigenes rings_nm. Festgelegt,
// nicht dahingestellt: rings_nm gewinnt fuer die Stufe, auf der die
// konfigurierte Reichweite steht -- das ist die Stufe, die man am Panel
// zuerst sieht, und rings_nm ist die Angabe, die vorher gar nichts bewirkt
// hat. Alle uebrigen Stufen bleiben unangetastet. Die geltende console.json
// hat keinen stufen-Schluessel; der Fall ist heute keiner.
test('stufen: bei Widerspruch gewinnt rings_nm auf der konfigurierten Reichweite', () => {
  const cfg = mergeConfig({ radar: { range_nm: 50, rings_nm: [5, 20, 50],
    stufen: [{ range_nm: 10, rings_nm: [2, 5, 10] },
             { range_nm: 50, rings_nm: [10, 25, 50] }] } });
  assert.deepEqual(cfg.radar.stufen.find(s => s.range_nm === 50).rings_nm, [5, 20, 50]);
  assert.deepEqual(cfg.radar.stufen.find(s => s.range_nm === 10).rings_nm, [2, 5, 10]);
});

test('stufen: der Normalfall bleibt unberuehrt (35 mit passenden Ringen, 50 ohne Dublette)', () => {
  const mit35 = mergeConfig({ radar: { range_nm: 35, rings_nm: [10, 20, 35] } });
  const fuenfunddreissig = mit35.radar.stufen.find(s => s.range_nm === 35);
  assert.deepEqual(fuenfunddreissig.rings_nm, [10, 20, 35]);

  const mit50 = mergeConfig({ radar: { range_nm: 50 } });
  const fuenfziger = mit50.radar.stufen.filter(s => s.range_nm === 50);
  assert.equal(fuenfziger.length, 1);
});
