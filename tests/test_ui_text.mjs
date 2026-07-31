import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

// Sichtbarer UI-Text darf keine Umlaut-Ersatzschreibung tragen. Am
// 31.07.2026 stand "Verstaerkung" im Fuss der Empfangsseite -- gefunden
// nicht durch Lesen, sondern weil es auf einem Foto fuer die
// Veroeffentlichung stand.
//
// WAS DIESER TEST NICHT KANN, UND WARUM ER ES NICHT VERSPRICHT
//
// Geprueft wird auf "ae" und "oe". Auf "ue" und "ss" ausdruecklich NICHT:
// beide kommen in korrektem Deutsch staendig vor ("Steuerung" traegt "ue",
// "Nachrichten pro Sekunde" waere mit jedem "ss" gefaehrdet). Eine
// Blanko-Regel darauf faende vor allem sich selbst. Wer einen Fall dieser
// Art findet, traegt ihn unten in VERBOTEN ein -- explizite Wortliste
// statt Blanko-Regel.
//
// Und er liest den QUELLTEXT, nicht das gerenderte DOM: Was in einer
// Vorlagen-Einsetzung ${...} steckt, sieht er nicht.
//
// Als grep war dieser Test nicht zu haben: `grep -E '>[^<>]*ae[^<>]*<'`
// findet die Zeile auf diesem Rechner NICHT, dieselbe Regex in Python
// schon. Ein Pruefmittel, dessen Werkzeug den bekannten Treffer verfehlt,
// haette hier still gruen gemeldet.

const AUSNAHMEN = [
  'Daemon',   // Fachbegriff, kein Umlaut
];

const VERBOTEN = [
  // Fuer Faelle mit ue/ss, die die Musterpruefung unten nicht sieht.
  // Beispiel, falls je noetig: 'Zuruecksetzen', 'Groesse'
];

const VERZ = new URL('../console/js/pages/', import.meta.url);

// Kommentare MUESSEN raus, bevor gesucht wird: Der Quelltext dieses
// Projekts ist durchgehend ohne Umlaute kommentiert ("Empfaenger",
// "waere"), das ist Absicht und kein Fehler. Die erste Fassung dieses
// Tests hat genau das gemeldet -- ein Pruefmittel, das eine andere Frage
// beantwortet als die gestellte.
function ohneKommentare(quelle) {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
}

function sichtbareTexte(quelle) {
  // Ein Textknoten braucht ein echtes oeffnendes Tag davor. Ohne diese
  // Bedingung liest die Zerlegung JS-Vergleiche mit: "for (let ft = 10000;
  // ft < FL_MAX" sah wie ein Textknoten aus und meldete "hoehenprofil".
  //
  // Das schliessende "<" wird per Vorausschau geprueft und NICHT verbraucht.
  // Verbraucht man es, fehlt es dem naechsten Tag als Anfang: In stats.js
  // frass der Treffer auf <div class="stats-foot"> das "<" von <span>, und
  // "Verstaerkung" -- der Fall, dessentwegen dieser Test existiert -- wurde
  // uebersprungen. Der Test meldete GRUEN, obwohl der Fehler dastand.
  // Aufgefallen ist das allein am Kalibrierfall unten.
  return [...ohneKommentare(quelle).matchAll(/<[a-z][^<>]*>([^<>]+)(?=<)/gi)]
    .map(m => m[1])
    .filter(t => !t.includes('${') && /[A-Za-zÄÖÜäöü]/.test(t));
}

test('kein ae/oe in sichtbarem UI-Text', () => {
  const funde = [];
  for (const datei of readdirSync(VERZ).filter(n => n.endsWith('.js'))) {
    const quelle = readFileSync(new URL(datei, VERZ), 'utf8');
    for (const text of sichtbareTexte(quelle)) {
      let rest = text;
      for (const a of AUSNAHMEN) rest = rest.split(a).join('');
      const treffer = rest.match(/[A-Za-zÄÖÜäöü]*(ae|oe)[A-Za-zÄÖÜäöü]*/g);
      if (treffer) funde.push(`${datei}: "${text.trim()}" -> ${treffer.join(', ')}`);
    }
  }
  assert.deepEqual(funde, [], `Umlaut-Ersatzschreibung gefunden:\n  ${funde.join('\n  ')}`);
});

test('keine Woerter aus der Verbotsliste im sichtbaren UI-Text', () => {
  const funde = [];
  for (const datei of readdirSync(VERZ).filter(n => n.endsWith('.js'))) {
    const quelle = readFileSync(new URL(datei, VERZ), 'utf8');
    for (const text of sichtbareTexte(quelle)) {
      for (const w of VERBOTEN) {
        if (text.includes(w)) funde.push(`${datei}: "${text.trim()}" -> ${w}`);
      }
    }
  }
  assert.deepEqual(funde, []);
});

// Kalibrierung: Der Musterlauf muss an einem gebauten Fall anschlagen.
// Ohne ihn waere nicht zu unterscheiden, ob oben nichts drinsteht oder ob
// die Zerlegung gar nichts findet.
test('der Musterlauf erkennt einen gebauten Fall', () => {
  const koeder = '// Empfaenger im Kommentar zaehlt nicht\n'
    + '<span>Verstaerkung <b>x</b></span><div>Hoehe</div><i>${x}oesterr</i>';
  const texte = sichtbareTexte(koeder);
  // Gerechnet, nicht geraten: matchAll ueberlappt nicht, also faellt ">x<"
  // als eigener Textknoten mit an -- er traegt nur kein ae/oe.
  assert.deepEqual(texte, ['Verstaerkung ', 'x', 'Hoehe']);
  const mit = texte.filter(t => /(ae|oe)/.test(t));
  assert.deepEqual(mit, ['Verstaerkung ', 'Hoehe'],
    'genau die zwei gebauten Faelle, und der Kommentar ist nicht dabei');
});
