#!/usr/bin/env bash
# install-daemon.sh — installs the ATC writer daemon (range records + system state).
#
# Run from the repository root on the ADS-B receiver itself:
#   sudo ./install-daemon.sh
#
# Separate from install-console.sh on purpose: the daemon writes data files into an
# existing lighttpd docroot and needs no display at all, while the console script only
# adds the kiosk that shows them. Run this one FIRST — it creates the system user
# (atc) that install-console.sh requires and refuses to proceed without, and it
# creates the docroot subtree (/var/www/html/atc, .../data) that both scripts share.
#
# This does not touch the ADS-B stack itself (dump1090-fa, piaware, fr24feed) or the
# lighttpd configuration — lighttpd is assumed already running with /var/www/html as
# its docroot, exactly as install-console.sh assumes it when it later copies the
# frontend there.

set -euo pipefail

SERVICE_USER=atc
SERVICE_FILE=atc-daemon.service
DAEMON_LIB_DIR=/usr/local/lib/atc-console
DAEMON_STATE_DIR=/var/lib/atc-console
WEBROOT=/var/www/html/atc
SYSTEM_JSON_URL="http://127.0.0.1/atc/data/system.json"

if [[ $EUID -ne 0 ]]; then
    echo "ERROR: run as root or with sudo." >&2
    exit 1
fi

if [[ ! -f "$SERVICE_FILE" || ! -f daemon/atc_daemon.py || ! -f daemon/schema.sql ]]; then
    echo "ERROR: run this script from the repository root (need $SERVICE_FILE," >&2
    echo "  daemon/atc_daemon.py and daemon/schema.sql)." >&2
    exit 1
fi

# curl is only needed here for the proof step at the end, but it may not be on the
# system yet if this runs before install-console.sh (which normally brings it in for
# its own ExecStartPre check). Idempotent either way.
if ! command -v curl > /dev/null 2>&1; then
    echo "Installing curl (needed to verify the daemon's output below) …"
    apt-get update -qq
    apt-get install -y --no-install-recommends curl
fi

# atc is a plain system account with no login shell — install-console.sh's error
# message points here for exactly this reason ("install atc-daemon.service first, it
# creates the system user"). --system also gets it its own private group on Debian,
# which is all atc-daemon.service's Group=atc needs.
if id "$SERVICE_USER" > /dev/null 2>&1; then
    echo "System user '$SERVICE_USER' already exists — skipping creation."
else
    echo "Creating system user '$SERVICE_USER' …"
    useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
fi

echo "Creating $WEBROOT and $WEBROOT/data …"
install -d -o "$SERVICE_USER" -g "$SERVICE_USER" -m 0755 "$WEBROOT" "$WEBROOT/data"

echo "Installing atc_daemon.py and schema.sql to $DAEMON_LIB_DIR …"
install -d -m 0755 "$DAEMON_LIB_DIR"
install -m 0755 daemon/atc_daemon.py "$DAEMON_LIB_DIR/atc_daemon.py"
install -m 0644 daemon/schema.sql "$DAEMON_LIB_DIR/schema.sql"

# StateDirectory= in the unit makes systemd create this with the right ownership
# before ExecStart runs, but a re-run of this script on a tree left behind by a
# previous partial install should still repair ownership rather than trust it.
if [[ -d "$DAEMON_STATE_DIR" ]]; then
    chown "$SERVICE_USER:$SERVICE_USER" "$DAEMON_STATE_DIR"
fi

echo "Installing systemd unit …"
install -m 0644 "$SERVICE_FILE" "/etc/systemd/system/$SERVICE_FILE"
systemctl daemon-reload
systemctl enable --now "$SERVICE_FILE"

# Prove the daemon is actually producing output instead of trusting
# "enable --now" or "systemctl is-active" — both only say the process is running,
# not that it ever got past read_receiver_position() (which raises if the running
# dump1090-fa carries no --lat/--lon) or wrote anything. system.json is written on
# the daemon's very first loop tick, so this should resolve within a few seconds if
# all is well; bounded so a daemon that never manages it doesn't hang this script.
echo "Waiting for $SYSTEM_JSON_URL to answer …"
READY=0
for _ in $(seq 1 30); do
    if curl -sf -o /dev/null "$SYSTEM_JSON_URL"; then
        READY=1
        break
    fi
    sleep 2
done

if [[ "$READY" -ne 1 ]]; then
    echo "ERROR: $SYSTEM_JSON_URL did not answer within 60s." >&2
    echo "  This does not necessarily mean the install failed — the daemon" >&2
    echo "  legitimately refuses to start if the running dump1090-fa carries no" >&2
    echo "  --lat/--lon (see read_receiver_position() in daemon/atc_daemon.py)." >&2
    echo "  Check:" >&2
    echo "    systemctl status $SERVICE_FILE" >&2
    echo "    journalctl -u $SERVICE_FILE -n 50" >&2
    echo "    ps -C dump1090-fa -o args=" >&2
    exit 1
fi
echo "$SYSTEM_JSON_URL answers with 200 — the daemon is writing output."

echo ""
echo "Daemon installed."
echo "  systemctl status $SERVICE_FILE"
echo "  journalctl -u $SERVICE_FILE -f"
echo ""
echo "Next: install the kiosk with 'sudo ./install-console.sh --rotate 90 --output DSI-1'"
echo "(90/DSI-1 measured for THIS panel — see docs/messungen/2026-07-27-panel-rotation.md)."
