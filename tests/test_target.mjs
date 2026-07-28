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
