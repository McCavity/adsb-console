#!/usr/bin/env bash
# Sucht die tatsaechliche Empfaengerposition im Repo -- die einzige Regel dieses
# Projekts, deren Verletzung nicht reparabel ist, sobald sie gepusht wurde
# (sie ist faktisch eine Wohnadresse).
#
# WARUM DIESES SKRIPT KEINE KOORDINATE ENTHAELT
#
# Ein Pruefmittel, das ein Geheimnis sucht, muss eine Beschreibung des
# Geheimnisses tragen -- und wird damit selbst zum Leck. Die erste Fassung
# dieses Skripts (28.07.) trug die gerundete echte Position woertlich als
# Koeder fuer den Selbsttest: genau den Wert, den der Schluss-Review der
# Stufe 1 aus der Spec entfernt hatte. Der eigene Lauf hat es gefunden.
# Auch grobe Suchbaender waeren schon ein Ortsfinder auf wenige Kilometer.
#
# Deshalb kommt die Position zur LAUFZEIT von aussen und wird nie abgelegt:
#   1. aus ATC_RECEIVER_LAT / ATC_RECEIVER_LON, falls gesetzt, sonst
#   2. aus receiver.json des Geraets (ATC_HOST, Vorgabe adsapp01).
#
# WENN BEIDES FEHLSCHLAEGT, MELDET DAS SKRIPT NICHT GRUEN, SONDERN
# "NICHT PRUEFBAR" (Exit 2). Ein Pruefmittel, das stillschweigend besteht,
# wenn es gar nicht messen konnte, ist schlimmer als keines.
#
# KALIBRIERUNG: `--selbsttest` baut den Koeder zur Laufzeit in einem eigenen
# git-Baum ausserhalb des Repos und muss ihn finden. Ein Instrument, das nie
# rot war, ist unkalibriert.

set -u

ATC_HOST="${ATC_HOST:-adsapp01}"

# Holt lat und lon, gibt sie auf zwei Zeilen aus. Rueckgabe 1 = nicht ermittelbar.
hole_position() {
  if [ -n "${ATC_RECEIVER_LAT:-}" ] && [ -n "${ATC_RECEIVER_LON:-}" ]; then
    printf '%s\n%s\n' "$ATC_RECEIVER_LAT" "$ATC_RECEIVER_LON"
    return 0
  fi
  local roh
  roh="$(ssh -o ConnectTimeout=8 -o BatchMode=yes "$ATC_HOST" \
        'curl -s --max-time 5 http://127.0.0.1/skyaware/data/receiver.json' 2>/dev/null)" || return 1
  [ -n "$roh" ] || return 1
  printf '%s' "$roh" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
    print(d["lat"]); print(d["lon"])
except Exception:
    sys.exit(1)
' || return 1
}

# Beide Werte muessen in DERSELBEN Datei vorkommen. Einzeln sind sie
# harmlos: console/data/airports.json traegt hunderte Flugplatzkoordinaten,
# und eine davon teilt schon mal zwei Nachkommastellen mit dem Empfaenger.
suche_paar() {
  local wurzel="$1" lat="$2" lon="$3" gefunden=0 datei
  # Punkt maskieren, damit er in der Regex kein Jokerzeichen ist.
  local lat_re="${lat//./\\.}" lon_re="${lon//./\\.}"
  while IFS= read -r datei; do
    case "$datei" in *.ttf|*.png|*.jpg|*.woff2) continue ;; esac
    [ -f "$datei" ] || continue
    if grep -qF "$lat" "$datei" 2>/dev/null && grep -qF "$lon" "$datei" 2>/dev/null; then
      echo "TREFFER: $datei traegt beide Werte der Empfaengerposition"
      grep -nE "$lat_re|$lon_re" "$datei" | head -10
      gefunden=1
    fi
  done < <(git -C "$wurzel" ls-files | sed "s|^|$wurzel/|")
  return $gefunden
}

WURZEL="$(git rev-parse --show-toplevel)"

if ! POS="$(hole_position)"; then
  echo "NICHT PRUEFBAR: Empfaengerposition nicht zu ermitteln." >&2
  echo "  Entweder ATC_RECEIVER_LAT und ATC_RECEIVER_LON setzen," >&2
  echo "  oder $ATC_HOST erreichbar machen (ATC_HOST setzt den Host)." >&2
  echo "  Kein Gruen ohne Messung." >&2
  exit 2
fi
LAT="$(printf '%s' "$POS" | sed -n 1p)"
LON="$(printf '%s' "$POS" | sed -n 2p)"

if [ "${1:-}" = "--selbsttest" ]; then
  # Den Fehlerfall absichtlich herstellen -- in einem eigenen git-Baum
  # ausserhalb dieses Repos, damit hier nichts abgelegt wird.
  T="$(mktemp -d)"
  trap 'rm -rf "$T"' EXIT INT TERM
  git -C "$T" init -q
  printf 'const rcv = { lat: %s, lon: %s };\n' "$LAT" "$LON" > "$T/koeder.js"
  git -C "$T" add -A
  if suche_paar "$T" "$LAT" "$LON" > /dev/null; then
    echo "SELBSTTEST FEHLGESCHLAGEN: der Koeder wurde NICHT gefunden." >&2
    echo "Das Pruefmittel ist unbrauchbar -- es meldet Gruen, wo Rot noetig ist." >&2
    exit 2
  fi
  # Gegenprobe in die andere Richtung: ein leerer Baum muss GRUEN sein.
  L="$(mktemp -d)"
  trap 'rm -rf "$T" "$L"' EXIT INT TERM
  git -C "$L" init -q
  printf 'const x = 1;\n' > "$L/harmlos.js"
  git -C "$L" add -A
  if ! suche_paar "$L" "$LAT" "$LON" > /dev/null; then
    echo "SELBSTTEST FEHLGESCHLAGEN: harmloser Baum wurde als Treffer gemeldet." >&2
    exit 2
  fi
  echo "Selbsttest bestanden: Koeder gefunden, harmloser Baum nicht gemeldet."
  exit 0
fi

if ! suche_paar "$WURZEL" "$LAT" "$LON"; then
  echo
  echo "ROT: Eine Datei traegt beide Werte der Empfaengerposition."
  echo "Nicht selbst beheben -- melden. Die Regel steht in CLAUDE.md."
  exit 1
fi
echo "Gruen: keine Datei traegt beide Werte der Empfaengerposition."
