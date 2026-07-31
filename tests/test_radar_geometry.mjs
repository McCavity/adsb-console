import test from 'node:test';
import assert from 'node:assert/strict';
import { projectToCanvas } from '../console/js/geo.js';
import { hintergrundSignatur, radarEinstellungen } from '../console/js/pages/radar.js';
import { mergeConfig } from '../console/js/config.js';
import { erzeugeAnsicht, setzeStufe, schalteLayer, gilt } from '../console/js/ansicht.js';

const R = 310, RANGE = 50;

test('Norden liegt oben, nicht unten', () => {
  const p = projectToCanvas(25, 0, RANGE, R);
  assert.ok(Math.abs(p.x) < 0.001, `x sollte 0 sein, ist ${p.x}`);
  assert.ok(p.y < 0, `Norden muss negatives y haben, ist ${p.y}`);
  assert.ok(Math.abs(p.y + 155) < 0.001);
});

test('Osten liegt rechts', () => {
  const p = projectToCanvas(25, 90, RANGE, R);
  assert.ok(Math.abs(p.x - 155) < 0.001);
  assert.ok(Math.abs(p.y) < 0.001);
});

test('Sueden und Westen', () => {
  const s = projectToCanvas(50, 180, RANGE, R);
  assert.ok(Math.abs(s.y - 310) < 0.001);
  const w = projectToCanvas(50, 270, RANGE, R);
  assert.ok(Math.abs(w.x + 310) < 0.001);
});

test('die Station selbst liegt im Mittelpunkt', () => {
  const p = projectToCanvas(0, 123, RANGE, R);
  assert.ok(Math.abs(p.x) < 0.001 && Math.abs(p.y) < 0.001);
});

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
