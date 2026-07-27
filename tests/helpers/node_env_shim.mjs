// Node-Testumgebung hat kein `location` -- anders als der Browser, in dem
// console/js/data.js tatsaechlich laeuft. data.js liest `location.search`
// im Modul-Toplevel (Zeile 19), um den Notfall-Testpfad `?source=` zu lesen.
// Das ist als Datei "existiert und wird nicht veraendert" gesetzt (Aufgabe 10),
// darum hier kein Fix an data.js, sondern ein reiner Test-Shim: importiert
// werden, BEVOR board.js (und damit transitiv console.js -> data.js) evaluiert
// wird, damit der Modul-Toplevel von data.js nicht mit ReferenceError stirbt.
// Siehe task-10-report.md fuer den roten Kalibrierungslauf, der das belegt.
//
// Liegt bewusst in tests/helpers/, NICHT direkt in tests/: der Testbefehl
// `node --test tests/*.mjs` (siehe global-constraints.md) expandiert nicht
// rekursiv -- eine Datei direkt in tests/ waere sonst selbst ein (leerer,
// aber gruen gezaehlter) Testfall und haette die Zaehlung auf 25 verzerrt.
globalThis.location ??= { search: '' };
