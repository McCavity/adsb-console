import test from 'node:test';
import assert from 'node:assert/strict';
import { naechsterWechsel } from '../console/js/carousel.js';

// Beide Faelle hier sind historische Fehler am Panel, nicht erfundene
// Randfaelle: 15 statt 60 s (Standzeit lief nach der Beruehrung weiter statt
// ersetzt zu werden) und 75 statt 60 s (resumeMs wurde zur Standzeit
// ADDIERT statt sie zu ersetzen). Beide waeren mit einem Aufruf sichtbar
// gewesen, ohne DOM und ohne Stoppuhr am Panel.

test('nach Beruehrung genau resumeMs -- nicht dwellMs (waere der 15s-Fehler)', () => {
  const r = naechsterWechsel({
    seiteIndex: 0, seitenzahl: 3, dwellMs: 15000, resumeMs: 60000,
    ausloeser: 'beruehrung',
  });
  assert.equal(r.inMs, 60000);
});

test('nach Beruehrung genau resumeMs -- nicht dwellMs + resumeMs (waere der 75s-Fehler)', () => {
  const r = naechsterWechsel({
    seiteIndex: 1, seitenzahl: 3, dwellMs: 15000, resumeMs: 60000,
    ausloeser: 'beruehrung',
  });
  assert.equal(r.inMs, 60000);
  assert.notEqual(r.inMs, 15000 + 60000);
});

test('resumeMs gilt unabhaengig davon, auf welcher Seite man steht', () => {
  for (const [seiteIndex, dwellMs] of [[0, 15000], [1, 60000], [2, 105000]]) {
    const r = naechsterWechsel({
      seiteIndex, seitenzahl: 3, dwellMs, resumeMs: 60000, ausloeser: 'beruehrung',
    });
    assert.equal(r.inMs, 60000, `Seite ${seiteIndex} mit dwellMs ${dwellMs}`);
  }
});

test('automatischer Wechsel nach dwellMs, nicht resumeMs', () => {
  const r = naechsterWechsel({
    seiteIndex: 0, seitenzahl: 3, dwellMs: 15000, resumeMs: 60000,
    ausloeser: 'automatisch',
  });
  assert.equal(r.inMs, 15000);
});

test('Umlauf am Ende der Liste', () => {
  const r = naechsterWechsel({
    seiteIndex: 2, seitenzahl: 3, dwellMs: 15000, resumeMs: 60000,
    ausloeser: 'automatisch',
  });
  assert.equal(r.seiteIndex, 0);
});

test('sonst schlicht die naechste Seite', () => {
  const r = naechsterWechsel({
    seiteIndex: 0, seitenzahl: 3, dwellMs: 15000, resumeMs: 60000,
    ausloeser: 'automatisch',
  });
  assert.equal(r.seiteIndex, 1);
});

test('Beruehrung veraendert die Seite nicht, nur die Wartezeit', () => {
  // Bei einer Beruehrung wechselt die sichtbare Seite nicht sofort -- sie
  // bleibt stehen und der naechste automatische Wechsel wird lediglich um
  // resumeMs verschoben. Der zurueckgegebene seiteIndex ist die Seite, zu
  // der NACH Ablauf von inMs gewechselt wird, nicht die aktuell sichtbare.
  const r = naechsterWechsel({
    seiteIndex: 1, seitenzahl: 4, dwellMs: 20000, resumeMs: 60000,
    ausloeser: 'beruehrung',
  });
  assert.equal(r.seiteIndex, 2);
  assert.equal(r.inMs, 60000);
});

test('der geplante Wechsel zeigt nie auf die gerade sichtbare Seite', () => {
  // Genau diese Zusicherung wurde am 28.07. verletzt -- nicht von dieser
  // Funktion, sondern vom Aufrufer, der ihr einen veralteten seiteIndex
  // gab. Steht der Vertrag hier, ist er beim naechsten Lesen sichtbar.
  for (let n = 2; n <= 7; n++) {
    for (let i = 0; i < n; i++) {
      for (const ausloeser of ['automatisch', 'beruehrung']) {
        const r = naechsterWechsel({ seiteIndex: i, seitenzahl: n,
                                     dwellMs: 45000, resumeMs: 60000, ausloeser });
        assert.notEqual(r.seiteIndex, i, `n=${n} i=${i} ${ausloeser}`);
      }
    }
  }
});

test('bei nur einer Seite bleibt es zwangslaeufig dieselbe', () => {
  // Der einzige Fall, in dem Ziel und sichtbare Seite zusammenfallen
  // duerfen -- und deshalb der Grund, warum goTo() auch dann planen muss,
  // wenn es die Seite gar nicht wechselt.
  const r = naechsterWechsel({ seiteIndex: 0, seitenzahl: 1,
                               dwellMs: 45000, resumeMs: 60000, ausloeser: 'automatisch' });
  assert.equal(r.seiteIndex, 0);
});
