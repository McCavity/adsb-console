#!/usr/bin/env python3
"""Spec 11: Ueberlebt eine statische synthetische Quelle die Frischeanzeige?

Messstand, laeuft auf adsapp01. Zwei Laufarten gegen denselben eingefrorenen
Stand und dieselbe statische Datei:

  A (Behauptung)   --fail-after weggelassen: der Server antwortet immer
  B (Kalibrierung) --fail-after 3: aircraft.json kommt dreimal, danach 503

Ohne B ist A wertlos -- ein Instrument, das nie ROT war, ist unkalibriert.
B ist zugleich die Gegenprobe auf die virtuelle Uhr: "keine Daten seit HH:MM"
kann per Konstruktion nur erscheinen, wenn auf der Seitenuhr wirklich 60 s
vergangen sind (console.js:89, ms >= 60000 bei at != null).

Die Zaehlung der Abrufe steht unter jedem Lauf: sie belegt unabhaengig von
der Anzeige, dass ueberhaupt gepollt wurde.
"""

import argparse
import http.server
import json
import re
import socketserver
import subprocess
import sys
import threading
from collections import Counter
from html.parser import HTMLParser

TREFFER = Counter()
FAIL_AFTER = None


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        pfad = self.path.split('?')[0]
        TREFFER[pfad] += 1
        if FAIL_AFTER is not None and pfad.endswith('/aircraft.json') \
           and TREFFER[pfad] > FAIL_AFTER:
            self.send_error(503, 'Quelle absichtlich abgeschaltet')
            return
        super().do_GET()

    def log_message(self, *_):
        pass


class Ernte(HTMLParser):
    """Liest die Kopfzeile und die Klassen der sichtbaren Seite aus dem DOM."""

    def __init__(self):
        super().__init__()
        self.titel = None
        self.age = None
        self.dot_klasse = None
        self.aktive_klasse = None
        self._sammle = None
        self._puffer = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        ident = a.get('id')
        klasse = a.get('class', '')
        if ident == 'page-title':
            self._sammle = 'titel'
            self._puffer = []
        elif ident == 'age':
            self._sammle = 'age'
            self._puffer = []
        elif ident == 'age-dot':
            self.dot_klasse = klasse
        elif tag == 'div' and 'page' in klasse.split() and 'active' in klasse.split():
            self.aktive_klasse = klasse

    def handle_data(self, daten):
        if self._sammle:
            self._puffer.append(daten)

    def handle_endtag(self, _tag):
        if self._sammle:
            setattr(self, self._sammle, ''.join(self._puffer).strip())
            self._sammle = None


def daemon_alter(dom):
    """Die Systemseite rechnet written_at gegen die echte Uhr -- zweite Flaeche."""
    m = re.search(r'geschrieben vor</span>\s*<span class="db-wert([^"]*)">([^<]*)<', dom)
    return (m.group(2).strip(), m.group(1).strip() or '(keine)') if m else (None, None)


def main():
    global FAIL_AFTER
    p = argparse.ArgumentParser()
    p.add_argument('--dir', required=True)
    p.add_argument('--port', type=int, default=8099)
    p.add_argument('--budget', type=int, required=True, help='virtuelle ms')
    p.add_argument('--fail-after', type=int, default=None)
    p.add_argument('--label', default='')
    p.add_argument('--profil', default='/var/tmp/spec11-prof')
    args = p.parse_args()
    FAIL_AFTER = args.fail_after

    handler = lambda *a, **k: Handler(*a, directory=args.dir, **k)
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.ThreadingTCPServer(('127.0.0.1', args.port), handler)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()

    url = f'http://127.0.0.1:{args.port}/index.html'
    try:
        aus = subprocess.run(
            ['chromium', '--headless', '--disable-gpu', '--no-sandbox',
             '--hide-scrollbars', '--window-size=1280,720',
             f'--user-data-dir={args.profil}',
             f'--virtual-time-budget={args.budget}', '--dump-dom', url],
            capture_output=True, text=True, timeout=300)
    finally:
        srv.shutdown()
        srv.server_close()

    dom = aus.stdout
    e = Ernte()
    e.feed(dom)
    alter_wert, alter_klasse = daemon_alter(dom)

    print(json.dumps({
        'lauf': args.label,
        'budget_ms': args.budget,
        'fail_after': args.fail_after,
        'seite': e.titel,
        'age_text': e.age,
        'age_dot_klasse': e.dot_klasse,
        'aktive_seite_klasse': e.aktive_klasse,
        'daemon_geschrieben_vor_s': alter_wert,
        'daemon_wert_klasse': alter_klasse,
        'abrufe': {k: v for k, v in sorted(TREFFER.items()) if k.endswith('.json')},
        'chromium_exit': aus.returncode,
    }, ensure_ascii=False))
    return 0 if dom else 1


if __name__ == '__main__':
    sys.exit(main())
