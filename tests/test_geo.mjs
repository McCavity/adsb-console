import test from 'node:test';
import assert from 'node:assert/strict';
import {
  haversineNm, bearingDeg, formatBearing, flightLevel,
  formatCallsign, sectorOf, isEmergency, nmToPx,
} from '../console/js/geo.js';

test('ein Breitengrad ist 60 NM', () => {
  // Die Seemeile ist als eine Bogenminute definiert -> 1 Grad = 60 NM.
  // Auf einer Kugel mit mittlerem Erdradius kommen 60,04 heraus.
  assert.ok(Math.abs(haversineNm(0, 0, 1, 0) - 60) < 0.1);
  assert.ok(Math.abs(haversineNm(49, 8, 50, 8) - 60) < 0.1);
});

test('eine Viertelumrundung am Aequator', () => {
  assert.ok(Math.abs(haversineNm(0, 0, 0, 90) - 5403.6) < 5);
});

test('gleiche Punkte haben Abstand null', () => {
  assert.equal(haversineNm(49.5, 8.5, 49.5, 8.5), 0);
});

test('die vier Himmelsrichtungen', () => {
  assert.ok(Math.abs(bearingDeg(0, 0, 1, 0) - 0) < 0.01);
  assert.ok(Math.abs(bearingDeg(0, 0, 0, 1) - 90) < 0.01);
  assert.ok(Math.abs(bearingDeg(0, 0, -1, 0) - 180) < 0.01);
  assert.ok(Math.abs(bearingDeg(0, 0, 0, -1) - 270) < 0.01);
});

test('Peilung liegt immer in 0..360', () => {
  for (const [la, lo] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const b = bearingDeg(0, 0, la, lo);
    assert.ok(b >= 0 && b < 360, `Peilung ausserhalb: ${b}`);
  }
});

test('Norden wird 360 geschrieben, nicht 000', () => {
  assert.equal(formatBearing(0), '360°');
  assert.equal(formatBearing(360), '360°');
  assert.equal(formatBearing(72), '072°');
  assert.equal(formatBearing(359.6), '360°');
  assert.equal(formatBearing(null), '—');
});

test('Flugflaeche', () => {
  assert.equal(flightLevel(7325), 'FL073');
  assert.equal(flightLevel(38975), 'FL390');
  assert.equal(flightLevel(0), 'FL000');
  assert.equal(flightLevel(null), '—');
  assert.equal(flightLevel('ground'), '—');   // dump1090 liefert das woertlich
});

test('Callsigns kommen mit Fuellzeichen', () => {
  assert.equal(formatCallsign('DLA7TT  '), 'DLA7TT');
  assert.equal(formatCallsign('   '), null);
  assert.equal(formatCallsign(undefined), null);
});

test('Sektoren zu je zehn Grad', () => {
  assert.equal(sectorOf(0), 0);
  assert.equal(sectorOf(9.99), 0);
  assert.equal(sectorOf(10), 1);
  assert.equal(sectorOf(359.9), 35);
  assert.equal(sectorOf(360), 0);
});

test('Notfall nur bei aussagekraeftigem Wert', () => {
  // Gemessen am Geraet: emergency ist bei voellig normalen Zielen vorhanden,
  // mit den Werten null oder "none". "Feld gesetzt" waere die falsche Bedingung.
  assert.equal(isEmergency({ squawk: '1000', emergency: 'none' }), false);
  assert.equal(isEmergency({ squawk: '1000', emergency: null }), false);
  assert.equal(isEmergency({ squawk: '1000' }), false);
  assert.equal(isEmergency({ squawk: '7700' }), true);
  assert.equal(isEmergency({ squawk: '7600' }), true);
  assert.equal(isEmergency({ squawk: '7500' }), true);
  assert.equal(isEmergency({ squawk: '1000', emergency: 'general' }), true);
});

test('Umrechnung NM auf Pixel', () => {
  assert.equal(nmToPx(0, 50, 310), 0);
  assert.equal(nmToPx(50, 50, 310), 310);
  assert.equal(nmToPx(25, 50, 310), 155);
});

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
