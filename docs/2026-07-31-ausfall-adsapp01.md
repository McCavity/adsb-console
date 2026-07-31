# Totalausfall adsapp01 am 31.07.2026 — vier Verdachtsmomente, vier Fehlanzeigen

> 31.07.2026, 20:25 bis 20:33 CEST · Ursache **nicht geklärt**
> Ergebnis: Gerät nach Power Cycle gesund; Journal von flüchtig auf persistent umgestellt,
> damit ein Wiederholungsfall überhaupt analysierbar ist.

## Verlauf

| Zeit | Was |
|---|---|
| 20:24:26 | `tar` über den `.git`-Baum des Geräts läuft noch sauber durch |
| ~20:25 | Panel zeigt „keine Daten seit 20:25"; dump1090-fa liefert nicht mehr |
| 20:26 | letzte telegraf-Werte für `mem`; ein `rsync` scheitert im **SSH-Handshake** |
| 20:26–20:30 | `disk` und `temp` kommen noch; lighttpd antwortet mit **500**, dann gar nicht |
| ~20:27 | Panel springt auf Chromiums „aw, snap"; Grafana meldet `dump1090-fa down` |
| 20:26–20:32 | Ping durchgehend beantwortet, Port 22 zu — fünf Minuten am Stück gemessen |
| 20:32:54 | Power Cycle, alle Dienste kommen sauber hoch |

Das Bild ist eindeutig: **Der Kernel lebte, laufende Prozesse arbeiteten weiter, neue ließen
sich nicht mehr starten.** telegraf schrieb noch, während sshd keine Verbindung mehr annahm
und lighttpd Dateien nicht mehr ausliefern konnte.

## Was ausgeschlossen ist

Alle Zahlen aus InfluxDB — die einzige Quelle, die den Neustart überlebt hat.

| Verdacht | Messung über den Ausfall | Ergebnis |
|---|---|---|
| Speichermangel / OOM | RAM stabil **34–37 %**, verfügbar 65 %; Höchstwert 37,3 % um 20:24 | nein |
| Unterspannung / Drosselung | `rpi_throttled.any_now` und `any_ever` = **0**, Takt 1,8 GHz | nein |
| Überhitzung | **73–74,5 °C**, harte Grenze 80 | nein |
| Volle Platte | **4,8 %** belegt (117 GB SSD) | nein |
| I/O-Stau | `usage_iowait` durchgehend **< 0,25 %** | nein |

Der Rückgang der Speichernutzung ab 20:26 auf 24,5 % ist **Folge** der sterbenden Dienste,
nicht ihre Ursache.

> [!warning]
> Ein Zwischenstand dieser Untersuchung meldete einen iowait-Sprung auf 13,7 % und damit
> ein „starkes Signal" für ein I/O-Problem. Das war ein **Artefakt einer verrutschten
> Spaltenzuordnung** im Auswerte-Einzeiler — der Wert gehörte zu einer anderen Reihe. Erst
> die Abfrage mit einem einzigen Feld und eindeutigen Spalten brachte die echten Zahlen.
> Wer CSV blind nach Spaltennummer liest, bekommt plausible Werte zur falschen Frage.

## Warum es nicht zu klären war

`journalctl --list-boots` kannte nach dem Neustart nur den aktuellen Boot. Grund:
`raspberrypi-sys-mods` liefert `/usr/lib/systemd/journald.conf.d/40-rpi-volatile-storage.conf`
mit `Storage=volatile` — die Pi-OS-Vorgabe, um SD-Karten zu schonen. **Dieses Gerät bootet
von SSD**, der Grund entfällt also, der Preis blieb: Mit jedem Neustart ist die Vorgeschichte
weg, samt `dmesg` und jeder Meldung eines OOM-Killers oder USB-Resets.

Ein zweiter Stolperstein bei der Diagnose: `who -b` meldete „20:21" und legte einen früheren
Neustart nahe. Das ist die **prä-NTP-Zeit aus `fake-hwclock`**, in `wtmp` festgehalten, bevor
die Zeit korrigiert war. `uptime -s` sagte korrekt 20:32:54.

## Behoben

Persistentes Journal über ein eigenes Drop-in, das die Paketdatei nicht anfaßt:
`/etc/systemd/journald.conf.d/99-persistent.conf` mit `Storage=persistent` und
`SystemMaxUse=200M`. `99-` gewinnt gegen `40-`, weil systemd Drop-ins über alle
Verzeichnisse hinweg nach Dateinamen sortiert.

Drei Dinge, die dabei nicht selbstverständlich waren und jeweils erst der Nachweis zeigte:

- Ein `systemctl restart systemd-journald` **genügt nicht** — journald schrieb weiter nach
  `/run`. Erst `journalctl --flush` legt es auf die Platte.
- `/etc/systemd/journald.conf.d/` existierte nicht; das erste `tee` scheiterte still bis auf
  seine Fehlermeldung, und die Prüfung meldete danach korrekt weiter `Storage=volatile`.
- Verifiziert wurde am Ende nicht die Konfiguration, sondern ein **zurückgelesener
  Testeintrag** aus `/var/log/journal/`.

**Noch offen:** Ob die Umstellung einen Neustart übersteht, ist damit *nicht* gezeigt — eine
Migration ist erst geprüft, wenn sie einen Reboot überlebt hat. Beim nächsten Neustart
nachziehen.

## Was daraus für den Deploy folgt

Der Ausfall lag zeitlich hinter zwei `rsync`-Trockenläufen und einem `tar` über das
Geräte-`.git`. Ein Zusammenhang ist **nicht belegt**, und die naheliegenden Mechanismen sind
oben ausgeschlossen.

> [!warning]
> Die erste Fassung dieses Abschnitts sprach von „rund zehntausend losen Git-Objekten".
> Nachgezählt sind es **883 Objekte, 6,2 MB, 341 Dateien im rsync-Vergleich** — für einen
> Pi keine nennenswerte Last. Die Zahl war geschätzt und hat die Lasthypothese größer
> aussehen lassen, als sie ist. Wer eine Größenordnung in eine Ursachenanalyse schreibt,
> ohne sie zu zählen, stützt damit genau die Erklärung, die er sucht.

Der Spiegel-Befehl im README trägt trotzdem seit dem 31.07. ein `--exclude '.git'` — nicht
als Fehlerbehebung, sondern weil der Lauf damit **1,1 s** dauert und die Historie auf dem
Gerät niemand braucht.


## Nachtrag: Streßtest am selben Abend — nicht reproduzierbar

Die Last, die zeitlich am Ausfall hing, wurde gezielt wiederholt und dabei **deutlich
überschritten**. Gemessen wurde mit einem Fühler, der alle 2 s ins jetzt persistente Journal
schreibt — genau die Größen, die im Monitoring fehlen: Prozesse, Threads, Zombies, freier
RAM, Load, offene Dateideskriptoren.

Gestuft, damit hinterher zuzuordnen ist, welche Last was tut — pro Lauf eine Variable:

| Stufe | Last | Prozesse | Threads | Zombies | RAM verfügbar min | FDs max |
|---|---|---|---|---|---|---|
| 1 | 5 × `rsync`-Trockenlauf mit `.git` | ±0 | ±0 | 0 | 1198 MB | 2208 |
| 2 | 5 × Chromium seriell | +12 | +97 | 2 | 1045 MB | 3117 |
| 3 | 12 × Chromium, 4 parallel | +23 | +86 | 0 | 1012 MB | 3960 |
| 4 | 24 × Chromium + 3 × `tar` + 3 × `rsync`, alles parallel | +40 | +97 | 0 | **1021 MB** | 4989 |

**Stufe 4 liegt weit über der Last des Ausfallabends, und das Gerät steckt sie weg.** Nach
jeder Runde kehrt der verfügbare Speicher auf rund 1,3 GB zurück; Load 3,1 auf vier Kernen.
Kein Leck: Nach den Läufen sind alle zwölf laufenden Chromium-Prozesse **4363 s alt**, also
vom Kiosk-Start — keiner stammt aus den Testläufen, und die Dateideskriptoren fallen auf den
Ausgangswert zurück.

**Von außen gegengeprüft, unabhängig von den Zahlen aus dem Gerät:** Eine Sonde vom
Arbeitsplatz aus fragte 20 Minuten lang alle 5 s Ping, Port 22 und HTTP ab — **240 Meßpunkte,
fünf Störungen, und alle fünf im Fenster des abschließenden `reboot`** (22:06:36–22:07:11).
Während der gesamten Last war das Gerät durchgehend erreichbar. Am Ausfallabend zeigte
dieselbe Sonde fünf Minuten am Stück `ssh=zu` und `http=000`.

Der Unterschied im Verlauf ist dabei aufschlußreich: Beim gewollten Neustart geht zuerst SSH,
dann HTTP, dann der Ping — und nach 25 s ist alles zurück. Am Ausfallabend blieb der **Ping
minutenlang beantwortet**, während der Userspace schon stand. Ein geordnetes Herunterfahren
sieht anders aus als das, was dort passiert ist.

**Damit ist die Lasthypothese erledigt.** Sie war ohnehin nur eine zeitliche Koinzidenz, und
die Zahl, die sie stützte, war geschätzt (siehe Warnung oben). Die Ursache des Ausfalls
bleibt unbekannt.

### Was der Streßtest zusätzlich bewiesen hat

Der abschließende Neustart war die eigentliche Probe auf die Journal-Umstellung — eine
Migration ist erst geprüft, wenn sie einen Reboot überlebt hat:

```
IDX BOOT ID                          FIRST ENTRY                  LAST ENTRY
 -1 0cf4bca3de0b44288b72694afe7427e2 Fri 2026-07-31 20:21:37 CEST Fri 2026-07-31 22:06:45
  0 122ecd6eea0d466c8faebc5557f13d3a Fri 2026-07-31 22:06:46 CEST Fri 2026-07-31 22:07:04
```

**Zwei Boots, und alle 159 Meßzeilen des vorigen sind lesbar.** Genau das hat am Abend
gefehlt. Fällt das Gerät noch einmal aus, ist die Vorgeschichte da.

### Und wieder das Prüfmittel

Der Auswerter suchte den Stufenmarker als **Teilzeichenkette** und traf damit
`=== STUFE 2 ENDE` statt `=== STUFE 2:`. Ausgewertet wurde die Ruhe **nach** der Last statt
der Last selbst — Stufe 1 und 2 meldeten zuerst „Delta 0", was wie ein Ergebnis aussah.
Aufgefallen an der Zahl der Meßpunkte: zwei statt der erwarteten fünfzig.

Davor hatte derselbe Fühler den **falschen Speicherwert** protokolliert: `read _ _ _ _ VERF _`
über `free -m` liefert `shared`, nicht `available` — 68 MB statt 1235. Gefangen, weil die
Zahl nicht zum vorher gemessenen Wert paßte.
