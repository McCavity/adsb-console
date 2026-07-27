# Woher der Daemon die Empfängerposition nimmt — am Gerät gemessen

> 2026-07-27, read-only auf `adsapp01`. Keine Koordinate wurde dabei ausgegeben,
> protokolliert oder abgelegt; gemessen wurden nur Formeigenschaften.

## Warum diese Messung existiert

Ein früherer Entwurfsstand behauptete, die exakte Position stehe in
`/etc/default/dump1090-fa` unter `LAT=`/`LON=`. Der Daemon wäre damit beim ersten Start
auf dem Gerät abgebrochen — und **kein Test hätte das gefangen**, weil die Tests gegen
ein selbstgeschriebenes Fixture liefen, das die Annahme bloß wiederholte.

Der Irrtum stammt aus einem `grep -oiE "(lat|lon)[a-z]*[ =:\"]+"`, dessen Ausgabe
`LAT=LON=` lautete. Das las sich wie zwei Schlüsselnamen, war aber das Zeilenende von
`RECEIVER_LAT=` und `RECEIVER_LON=`. Ein Meßmittel, das eine andere Frage beantwortete
als die gestellte — mit einem Ergebnis, das gerade plausibel genug war, um sofort falsch
gedeutet zu werden.

## Befund

| Frage | Antwort | Wie festgestellt |
|---|---|---|
| Schlüsselnamen in `/etc/default/dump1090-fa` | `RECEIVER_LAT` / `RECEIVER_LON` | Datei zeilenweise gelesen, Zahlen maskiert |
| Werte dort | **leer** (Länge 0, unquotiert) | dieselbe Lesung |
| Woher dump1090 die Position dann hat | piaware-Konfiguration, durchgereicht als Prozeßargument | `/etc/piaware.conf` enthält den Schlüssel; der Prozeß trägt `--lat`/`--lon` |
| Form der Argumente | eigenes Token (`--lat`, dann der Wert), **nicht** `--lat=…` | `tr '\0' '\n' < /proc/<pid>/cmdline`, Zähltreffer auf `^--lat$` = 1 |
| Genauigkeit | 5 Nachkommastellen (≈ 1 m) | Längenmessung, ohne Wertausgabe |
| Zahl passender Prozesse | genau 1 | `pgrep -c dump1090` |
| `hidepid` gesetzt? | nein — `proc /proc proc rw,relatime 0 0` | `/proc/mounts` |
| Rechte der cmdline | `-r--r--r--`, Eigentümer `dump1090` | `ls -l /proc/<pid>/cmdline` |
| Fremd-UID-Lesbarkeit | **ja** — als uid 1000 aus einem `dump1090`-eigenen Prozeß gelesen | Testlauf als Benutzer `pi` |

## Konsequenz für den Entwurf

Maßgeblich ist die **wirksame** Position: die Argumente `--lat`/`--lon` des laufenden
`dump1090-fa`, gelesen aus `/proc/<pid>/cmdline`. Das ist die einzige Quelle, die
unabhängig davon stimmt, welche Konfigurationsschicht den Wert geliefert hat — sie zeigt,
was der Decoder wirklich benutzt, statt einer von mehreren möglichen Quellen zu vertrauen.

Da `/proc` ohne `hidepid` gemountet ist und die chmod-Bits weltlesbar sind, wird auch der
unprivilegierte Dienstnutzer `atc` sie lesen können.

## Gegenprobe, deren Antwort vorher feststand

Die fertige Funktion wurde auf dem Gerät ausgeführt und ihr Ergebnis gegen die öffentlich
ausgelieferte, auf zwei Stellen gerundete `receiver.json` gehalten: Die Abweichung liegt
unter 0,01° — beide müssen übereinstimmen, und sie tun es. Ohne diese Gegenprobe wäre
„die Funktion hat etwas zurückgegeben" kein Beweis dafür, daß sie das Richtige
zurückgegeben hat.

## Was diese Messung **nicht** zeigt

- Sie ist ein Momentzustand. Startet dump1090-fa künftig ohne Position (leere
  piaware-Konfiguration), liefert der Daemon einen klaren `RuntimeError` statt falscher
  Entfernungen — geprüft ist dieser Pfad nur im Test, nicht am Gerät.
- Ob der Dienstnutzer `atc` tatsächlich liest, ist erst nach seiner Anlage in Aufgabe 4
  belegbar. Bis dahin stützt sich die Aussage auf die Mount-Optionen und die
  Dateirechte, nicht auf einen Lauf unter diesem Konto.
