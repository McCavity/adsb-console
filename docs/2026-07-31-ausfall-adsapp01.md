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
