# Schriftmessung am Panel — B612 auf der Polarseite

> 30.07.2026 · Gerät `adsapp01` · Chromium 150.0.7871.181 (Debian 13, aarch64)
> Anlaß: offene Entscheidung aus dem Schluß-Review der Stufe 3
> Ergebnis: **B612 übernommen**, `BILD.rand` 34 → 36, `PEIL_SCHRIFT.breite` 30 → 32

## Was gemessen wurde und warum nicht gerechnet

Die Polarseite forderte im CSS `"B612 Mono"`, die `@font-face` heißt `'B612Mono'` — für CSS
zwei verschiedene Familien. Die Seite bekam still den Fallback, während
`document.fonts.check()` `true` meldete. Die Frage war deshalb nicht „sieht B612 besser
aus", sondern: **Was kostet die echte Schrift an Platz, und paßt das Bild dann noch?**

Gerechnet wurde vorher schon (0,05 px Restabstand). Eine gerechnete Zahl über eine fremde
Schrift auf einem fremden Renderer ist eine Behauptung — deshalb dieselbe Zahl noch einmal,
aus dem Chromium des Geräts.

## Meßstand

Eingefrorene Kopie des **ausgelieferten** Verzeichnisses unter `/var/tmp/polarmess`, dazu
die zu diesem Zeitpunkt ausgelieferte `range.json` — dieselbe Eingabe für jeden Lauf, damit
die Drift des laufenden Systems nicht ins Ergebnis wandert. Ausgeliefert wird sie von einem
eigenen `python3 -m http.server` auf 8099; der produktive lighttpd und der Kiosk bleiben
unangetastet. Gemessen wird mit demselben Chromium-Binary im Headless-Modus,
`--window-size=1280,720`, `--dump-dom`.

Vorher geprüft, daß die Kopie das Original ist: **alle 18 ausgelieferten Dateien
hashgleich** mit dem Arbeitsbaum (`sha256`, `console/` gegen `/var/www/html/atc/`,
`config/console.json` gegen `console.json`).

**Was dieser Meßstand nicht teilt:** den Kiosk-Prozeß selbst (labwc, `--kiosk`, echtes
Panel). Geteilt werden Binary, Version, Fontconfig und Gerätepixelverhältnis — der
Kiosk-Benutzer `atc` hat **kein** eigenes `~/.config/fontconfig`, beide sehen also dieselbe
Schriftauswahl; `dpr = 1`; und das Layout steht in festen Pixeln (`html, body { width:
1280px; height: 720px }`), hängt also nicht an der Fenstergröße. `grim` ist auf dem Gerät
nicht installiert und wurde für diese Messung auch nicht installiert — ein Abbild des
echten Framebuffers gibt es daher nicht.

## Kalibrierung: kann der Meßstand die Schrift überhaupt unterscheiden?

Vier Varianten derselben Textmarke, gemessen mit `getComputedTextLength()` auf einem
SVG-`<text class="pol-peil">`; Größe und Laufweite kommen aus `console.css`, nur die
Familie wird getauscht:

| Familie | „090" |
|---|---|
| `'B612Mono'` (richtiger Name) | **31,953 px** |
| `"B612 Mono"` (der kaputte Name) | 29,797 px |
| `'GibtsNichtXY7'` (Phantasiename) | 29,797 px |
| `monospace` pur | 29,797 px |

Der kaputte Name, der Phantasiename und der pure Fallback liefern **denselben** Wert — das
Instrument sieht den Unterschied also, wenn es einen gibt, und der kaputte Name wirkt
nachweislich nicht. `document.fonts.check("15px \"B612 Mono\"")` meldete dabei auf dem Pi
weiterhin **`true`**: Die Selbstauskunft der Schrift-API taugt hier nicht als Beleg, die
Zeichenbreite schon.

## Der Preis, gemessen

| | Fallback | B612 |
|---|---|---|
| „090", Vorschub bei 15 px + `letter-spacing .06em` | 29,797 px | **31,953 px** |
| Oberlänge / Unterlänge | 14 / 4 px | **14 / 4 px** |
| Ringbeschriftung „100 NM" bei 13 px | 46,969 px | 50,703 px |
| Tinte („090", `actualBoundingBox`) | 28,862 px | 29,300 px |

**Ober- und Unterlänge ändern sich nicht** — `PEIL_SCHRIFT.oben/unten` bleiben gültig, nur
`breite` wandert. Aufgerundet auf **32**: Diese Zahl bewacht einen Abstand, und ein Wächter
rundet zu seinen Ungunsten.

## Zwei Befunde, die vorher nicht auf dem Zettel standen

**1. Nicht nur die 090-Marke ist eng, die 270-Marke genauso.** Beide fielen mit B612 bei
`rand = 34` auf **0,047 px** zum Außenring — die eine per `text-anchor="end"` an der
rechten, die andere per `"start"` an der linken Bildkante. Der Vorbefund nannte nur die
090; die Symmetrie war übersehen worden.

**2. Der Radarkreis benutzt B612 längst für genau dieselben zwei Elemente.** `radar.js`
setzt `ctx.font = '13px B612Mono, ui-monospace, monospace'` für Ringbeschriftung *und*
Peilungsmarken. Am Gerät nachgemessen, nicht aus dem Quelltext geschlossen:

| Canvas-Font | „090" |
|---|---|
| `13px B612Mono, ui-monospace, monospace` | **25,350 px** |
| `13px ui-monospace, monospace` | 23,480 px |
| `13px GibtsNichtXY7, ui-monospace, monospace` | 23,480 px |

Damit war die Frage keine Geschmacksfrage mehr: Zwei Rundbilder derselben Konsole zeigten
dieselben Elemente in zwei verschiedenen Schriften. Das ist keine Entscheidung, sondern ein
Rest.

## Entscheidung und ihre Kosten

**B612 auch im Polarkreis** (`.pol-peil`, `.pol-ring-t`). Bezahlt wird der Platzbedarf über
**eine** Konstante: `BILD.rand` 34 → 36. Die Marken hängen seit dem 29.07. an dieser Zahl
und wandern mit; der Kreis wird dadurch 4 px kleiner (`R_PX` 276 → 274).

Gegenprobe nach der Umstellung, Außenring **aus dem gezeichneten Kreis gelesen** statt aus
einer Konstanten übernommen (r = 274, Mitte 310 → Ring 36..584):

| Marke | Kasten | Luft zum Ring | Luft zur Bildkante |
|---|---|---|---|
| 000 | 294,0..326,0 / 8,0..26,0 | 10,000 | 8,000 |
| 090 | 586,0..618,0 / 301,0..319,0 | **2,047** | 2,000 |
| 180 | 294,0..326,0 / 596,0..614,0 | 12,000 | 6,000 |
| 270 | 2,0..34,0 / 301,0..319,0 | **2,047** | 2,000 |

Vorher (Fallback, `rand = 34`) waren es 2,203 px — der Zustand ist also wiederhergestellt,
nicht bloß repariert.

## Was der Wächtertest daraus gelernt hat

`test_polar.mjs` prüfte auf **Überlappung**. 0,047 px sind keine Überlappung: Der Test
hätte die Umstellung anstandslos durchgelassen und dabei grün gemeldet. Ein Abstand, den
niemand bewacht, ist beim nächsten Schriftwechsel wieder weg.

Neu ist deshalb `PEIL_LUFT = 1.5` — der geforderte Mindestabstand steht jetzt als Zahl da.
**Kalibriert am echten Fall:** mit `rand = 34` und `breite = 32` (also genau der Zustand,
den die alte Fassung durchgelassen hätte) fällt der Test:

```
✖ keine Peilungsmarke laeuft ueber die Bildkante oder in den Aussenring
  AssertionError: 90: Marke haelt keine 1.5 px zum Aussenring
  (Kasten 586..618 / 301..319, Ring 34..586)
```

Danach zurückgebaut: **168 JS-Tests + 44 Daemon-Tests grün.**
