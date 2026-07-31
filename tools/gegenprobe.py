#!/usr/bin/env python3
"""Gegenproben vor der Veroeffentlichung der Fotos.

Zwei Fragen, beide mit vorher feststehender Antwort:

  A) Taucht eine Kennung aus den Bildern in den ECHTEN Daten auf?
     Erwartet: nein. Danach derselbe Detektor mit einem echten Callsign
     gefuettert -- er MUSS anschlagen, sonst hat er nichts geprueft.

  B) Traegt eines der Bilder Ortsdaten?
     Erwartet: nein (PNG aus Chromium). Danach derselbe Detektor an einem
     selbstgebauten JPEG MIT GPS -- er MUSS anschlagen.

Ein Detektor, der nie ROT war, ist unkalibriert.
"""
import io
import json
import re
import struct
import sys
from pathlib import Path


def kennungen_aus_szene(aircraft_pfad, range_pfad):
    """Obermenge dessen, was in den Bildern steht: alle Callsigns und Hex
    der synthetischen Quelle."""
    k = set()
    d = json.load(open(aircraft_pfad))
    for a in d['aircraft']:
        k.add(a['hex'].lower())
        if a.get('flight'):
            k.add(a['flight'].strip().upper())
    r = json.load(open(range_pfad))
    for rec in r['records']:
        k.add(rec['hex'].lower())
        if rec.get('callsign'):
            k.add(rec['callsign'].strip().upper())
    return k


def treffer_in_echt(kennungen, echte_texte):
    """Wortgenau, nicht als Teilzeichenkette: 'SYN2000' darf nicht an
    'SYN20001' anschlagen und umgekehrt."""
    treffer = []
    for k in sorted(kennungen):
        muster = re.compile(r'(?<![0-9A-Za-z])' + re.escape(k) + r'(?![0-9A-Za-z])',
                            re.IGNORECASE)
        for name, text in echte_texte.items():
            if muster.search(text):
                treffer.append((k, name))
    return treffer


def png_chunks(pfad):
    daten = Path(pfad).read_bytes()
    if daten[:8] != b'\x89PNG\r\n\x1a\n':
        return None
    i, chunks = 8, []
    while i + 8 <= len(daten):
        laenge = struct.unpack('>I', daten[i:i + 4])[0]
        typ = daten[i + 4:i + 8].decode('latin-1')
        chunks.append((typ, laenge))
        i += 12 + laenge
    return chunks


def hat_gps_ifd(tiff):
    """Liest den TIFF-Kopf und IFD0 wirklich, statt nach zwei Bytes zu
    suchen. Ein Byte-Muster fuer Tag 0x8825 waere in einem JPEG-Rumpf
    reiner Zufall -- und der erste Entwurf dieses Detektors hat bei der
    Kalibrierung genau deshalb NICHT ausgeloest, obwohl GPS drinstand."""
    if len(tiff) < 8 or tiff[:2] not in (b'II', b'MM'):
        return False
    e = '<' if tiff[:2] == b'II' else '>'
    off = struct.unpack(e + 'I', tiff[4:8])[0]
    if off + 2 > len(tiff):
        return False
    anzahl = struct.unpack(e + 'H', tiff[off:off + 2])[0]
    for i in range(anzahl):
        p = off + 2 + i * 12
        if p + 2 > len(tiff):
            break
        if struct.unpack(e + 'H', tiff[p:p + 2])[0] == 0x8825:
            return True
    return False


ORT_SCHLUESSEL = ('exif', 'gps', 'location', 'latitude', 'longitude',
                  'quicktime.location', 'xmp')


def ortsdaten(pfad):
    """Meldet, WAS gefunden wurde -- und 'nicht pruefbar' statt Gruen,
    wenn die Datei kein bekanntes Format hat."""
    daten = Path(pfad).read_bytes()
    chunks = png_chunks(pfad)
    funde = []
    # Durchsucht werden nur METADATEN, nie die ganze Datei. Die erste Fassung
    # suchte die Schluesselwoerter in den Rohbytes und schlug am 31.07.2026 auf
    # empfang.png an: Die drei Buchstaben "gps" standen bei Byte 3050 mitten im
    # komprimierten Pixelstrom, zwischen \xac und \xb7. Ein Treffer im IDAT ist
    # Zufall, kein Befund -- das Pruefmittel beantwortete eine andere Frage.
    durchsuchbar = b''
    if chunks is not None:
        for typ, _ in chunks:
            if typ in ('eXIf', 'tEXt', 'iTXt', 'zTXt'):
                funde.append(f'PNG-Chunk {typ}')
                durchsuchbar = daten      # dann lohnt die Textsuche

    elif daten[:2] == b'\xff\xd8':
        # JPEG: APP1-Segmente durchgehen
        i = 2
        while i + 4 <= len(daten):
            if daten[i] != 0xFF:
                break
            marker, laenge = daten[i + 1], struct.unpack('>H', daten[i + 2:i + 4])[0]
            if marker == 0xE1:
                rumpf = daten[i + 4:i + 4 + laenge]
                if rumpf.startswith(b'Exif\x00\x00'):
                    funde.append('JPEG APP1/Exif')
                    if hat_gps_ifd(rumpf[6:]):
                        funde.append('EXIF-Tag 0x8825 (GPS-IFD)')
            if marker == 0xDA:
                break
            i += 2 + laenge
        durchsuchbar = daten              # JPEG: Segmente sind Metadaten genug
    else:
        return None, ['nicht pruefbar: unbekanntes Format']
    roh = durchsuchbar.lower()
    for s in ORT_SCHLUESSEL:
        if s.encode() in roh:
            funde.append(f'Zeichenkette "{s}"')
    return (len(funde) > 0), funde


def main():
    basis = Path(sys.argv[1])
    echt_air = Path(sys.argv[2])
    echt_range = Path(sys.argv[3])

    print('=== A) Kennungen gegen die echten Daten ===')
    kennungen = kennungen_aus_szene(basis / 'skyaware/data/aircraft.json',
                                    basis / 'data/range.json')
    echte = {'echte aircraft.json': echt_air.read_text(),
             'echte range.json': echt_range.read_text()}
    print(f'{len(kennungen)} Kennungen aus der synthetischen Quelle geprueft')
    tr = treffer_in_echt(kennungen, echte)
    print('  Ergebnis:', 'GRUEN, kein Treffer' if not tr else f'ROT: {tr}')

    print('\n  Kalibrierung -- ein ECHTES Callsign in die Pruefmenge geschmuggelt:')
    echt_doc = json.loads(echte['echte aircraft.json'])
    koeder = next(a['flight'].strip() for a in echt_doc['aircraft'] if a.get('flight'))
    tr2 = treffer_in_echt({koeder}, echte)
    print(f'  Koeder "{koeder}":',
          f'ROT wie gefordert, {len(tr2)} Treffer' if tr2
          else 'GRUEN -- der Detektor prueft NICHTS')

    print('\n=== B) Ortsdaten in den Bildern ===')
    # NICHT nur 'bild-*.png': Am 31.07.2026 lief dieser Abschnitt ueber NULL
    # Dateien und meldete trotzdem Gruen, weil die Bilder inzwischen radar.png
    # statt bild-radar.png hiessen. Ein Pruefmittel, das nichts messen konnte,
    # meldet "nicht pruefbar" -- niemals Gruen.
    bilder = sorted(set(basis.glob('*.png')) | set(basis.glob('*.jpg'))
                    - {basis / 'koeder-mit-gps.jpg'})
    if not bilder:
        print('  NICHT PRUEFBAR: keine Bilddateien in', basis)
        return 2
    alle_sauber = True
    for p in bilder:
        hat, funde = ortsdaten(p)
        if hat is None or hat:
            alle_sauber = False
        print(f'  {p.name:20s} {"SAUBER" if hat is False else "PRUEFEN: " + str(funde)}')

    print('\n  Kalibrierung -- selbstgebautes JPEG MIT GPS:')
    koeder_jpg = basis / 'koeder-mit-gps.jpg'
    hat, funde = ortsdaten(koeder_jpg)
    print(f'  {koeder_jpg.name}:',
          f'ROT wie gefordert -> {funde}' if hat
          else 'GRUEN -- der Detektor prueft NICHTS')

    ok = (not tr) and bool(tr2) and alle_sauber and bool(hat)
    print('\nGESAMT:', 'GRUEN' if ok else 'ROT')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
