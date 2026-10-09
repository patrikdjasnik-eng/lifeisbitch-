"""Local SQLite player registry. Run with Python 3.11+."""
import hashlib
import json
import os
import re
import sqlite3
import threading
import time
import unicodedata
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

DB_PATH = Path(os.environ.get("LIB_DATABASE", str(Path.home() / "LifeIsBitch" / "players.sqlite3")))
DB_PATH.parent.mkdir(parents=True, exist_ok=True)
limits = {}
lock = threading.Lock()

def connect():
    db = sqlite3.connect(DB_PATH, timeout=10)
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("""CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, token_hash TEXT NOT NULL,
      first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL,
      launches INTEGER NOT NULL DEFAULT 1, platform TEXT NOT NULL, version TEXT NOT NULL
    )""")
    return db

def register(payload):
    if not isinstance(payload, dict):
        raise ValueError("Invalid payload")
    player_id, token = payload.get("id"), payload.get("token")
    name = unicodedata.normalize("NFC", payload.get("name", "")) if isinstance(payload.get("name"), str) else ""
    name = " ".join(name.split())
    if not isinstance(player_id, str) or not re.fullmatch(r"LIB-[a-f0-9]{32}", player_id):
        raise ValueError("Invalid player ID")
    if not isinstance(token, str) or not re.fullmatch(r"[a-f0-9]{64}", token):
        raise ValueError("Invalid registration token")
    if not 3 <= len(name) <= 24 or not all(c.isalnum() or c in " _'-" for c in name):
        raise ValueError("Invalid character name")
    platform, version = payload.get("platform"), payload.get("version")
    if platform not in ("win32", "linux", "darwin") or not isinstance(version, str) or not re.fullmatch(r"[0-9A-Za-z.+-]{1,32}", version):
        raise ValueError("Invalid application metadata")
    digest = hashlib.sha256(token.encode()).hexdigest()
    now = int(time.time())
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        existing = db.execute("SELECT token_hash FROM players WHERE id=?", (player_id,)).fetchone()
        if existing and existing[0] != digest:
            raise PermissionError("Player ID belongs to another registration")
        if existing:
            db.execute("UPDATE players SET name=?,last_seen=?,launches=launches+1,platform=?,version=? WHERE id=?", (name, now, platform, version, player_id))
        else:
            db.execute("INSERT INTO players VALUES (?,?,?,?,?,1,?,?)", (player_id, name, digest, now, now, platform, version))
    return {"registered": True, "id": player_id}

class Handler(BaseHTTPRequestHandler):
    def reply(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        self.reply(200 if self.path == "/health" else 404, {"ok": self.path == "/health"})

    def do_POST(self):
        if self.path != "/api/players/register":
            return self.reply(404, {"error": "Not found"})
        with lock:
            now = time.monotonic()
            for address in list(limits):
                if limits[address][0] < now - 60:
                    del limits[address]
            address = self.client_address[0]
            stamp, count = limits.get(address, (now, 0))
            limits[address] = (stamp, count + 1)
        if count >= 30:
            return self.reply(429, {"error": "Try later"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 2048:
                return self.reply(413, {"error": "Invalid body size"})
            payload = json.loads(self.rfile.read(length))
            self.reply(200, register(payload))
        except PermissionError as error:
            self.reply(409, {"error": str(error)})
        except (ValueError, TypeError):
            self.reply(400, {"error": "Invalid registration"})
        except sqlite3.Error:
            self.reply(503, {"error": "Database unavailable"})

    def setup(self):
        super().setup()
        self.connection.settimeout(10)

    def log_message(self, *args):
        pass

if __name__ == "__main__":
    connect().close()
    host = os.environ.get("LIB_HOST", "127.0.0.1")
    port = int(os.environ.get("LIB_PORT", "8789"))
    print(f"Player registry: http://{host}:{port} · database: {DB_PATH}")
    ThreadingHTTPServer((host, port), Handler).serve_forever()
