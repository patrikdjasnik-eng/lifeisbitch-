"""Password accounts without email; persistent SQLite sessions."""
import hashlib
import hmac
import re
import secrets
import time

def initialize(db):
    db.execute("""CREATE TABLE IF NOT EXISTS accounts (
      username TEXT PRIMARY KEY, player_id TEXT UNIQUE NOT NULL,
      password_salt TEXT NOT NULL, password_hash TEXT NOT NULL,
      recovery_hash TEXT NOT NULL, created_at INTEGER NOT NULL
    )""")
    db.execute("""CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, username TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    )""")
    db.execute("CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at)")

def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()

def password_hash(password, salt):
    if not isinstance(password, str) or not 10 <= len(password) <= 128:
        raise ValueError("Heslo musí mít 10–128 znaků.")
    return hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 600000).hex()

def issue_session(db, username):
    token = secrets.token_hex(32)
    now = int(time.time())
    db.execute("DELETE FROM sessions WHERE expires_at <= ?", (now,))
    db.execute("INSERT INTO sessions VALUES (?,?,?)", (digest(token), username, now + 86400 * 7))
    return token

def profile(db, username):
    row = db.execute("SELECT p.id,p.name FROM players p JOIN accounts a ON a.player_id=p.id WHERE a.username=?", (username,)).fetchone()
    return {"id": row[0], "name": row[1], "username": username}

def authenticate(db, token):
    if not isinstance(token, str) or not re.fullmatch(r"[a-f0-9]{64}", token):
        raise PermissionError("Přihlášení vypršelo.")
    row = db.execute("SELECT username FROM sessions WHERE token_hash=? AND expires_at>?", (digest(token), int(time.time()))).fetchone()
    if not row:
        raise PermissionError("Přihlášení vypršelo.")
    return row[0]

def handle(db, action, payload):
    if not isinstance(payload, dict):
        raise ValueError("Neplatná žádost.")
    initialize(db)
    if action in ("session", "logout"):
        username = authenticate(db, payload.get("session"))
        if action == "logout":
            db.execute("DELETE FROM sessions WHERE token_hash=?", (digest(payload["session"]),))
            return {"ok": True}
        return {"ok": True, "profile": profile(db, username)}
    username = payload.get("username", "")
    if not isinstance(username, str) or not re.fullmatch(r"[A-Za-z0-9_-]{3,24}", username):
        raise ValueError("Přihlašovací jméno: 3–24 znaků, písmena bez diakritiky, čísla, _ nebo -.")
    username = username.lower()
    password = payload.get("password")
    if action == "register":
        if db.execute("SELECT 1 FROM accounts WHERE username=?", (username,)).fetchone():
            raise ValueError("Toto přihlašovací jméno je obsazené.")
        player_id, token = payload.get("id"), payload.get("token")
        if not isinstance(player_id, str) or not isinstance(token, str):
            raise ValueError("Nejdřív vyplň jméno postavy.")
        row = db.execute("SELECT token_hash FROM players WHERE id=?", (player_id,)).fetchone()
        if not row or not hmac.compare_digest(row[0], digest(token)):
            raise PermissionError("Postavu nelze připojit.")
        if db.execute("SELECT 1 FROM accounts WHERE player_id=?", (player_id,)).fetchone():
            raise ValueError("Postava už má účet. Použij přihlášení.")
        salt, recovery = secrets.token_hex(16), secrets.token_hex(24)
        hashed = password_hash(password, salt)
        db.execute("INSERT INTO accounts VALUES (?,?,?,?,?,?)", (username, player_id, salt, hashed, digest(recovery), int(time.time())))
        return {"ok": True, "session": issue_session(db, username), "profile": profile(db, username), "recovery": recovery}
    row = db.execute("SELECT password_salt,password_hash,recovery_hash,player_id FROM accounts WHERE username=?", (username,)).fetchone()
    if action == "login":
        # Neexistující účet provádí stejnou drahou kontrolu jako chybné heslo.
        hashed = password_hash(password, row[0] if row else "0" * 32)
        if not row or not hmac.compare_digest(row[1], hashed):
            raise PermissionError("Nesprávné jméno nebo heslo.")
        registry_token = secrets.token_hex(32)
        db.execute("UPDATE players SET token_hash=? WHERE id=?", (digest(registry_token), row[3]))
        return {"ok": True, "session": issue_session(db, username), "profile": profile(db, username), "registryToken": registry_token}
    if action == "recover":
        recovery = payload.get("recovery", "")
        if not isinstance(recovery, str) or not row or not hmac.compare_digest(row[2], digest(recovery)):
            raise PermissionError("Nesprávné jméno nebo obnovovací kód.")
        salt, recovery = secrets.token_hex(16), secrets.token_hex(24)
        hashed = password_hash(password, salt)
        db.execute("UPDATE accounts SET password_salt=?,password_hash=?,recovery_hash=? WHERE username=?", (salt, hashed, digest(recovery), username))
        db.execute("DELETE FROM sessions WHERE username=?", (username,))
        return {"ok": True, "recovery": recovery}
    raise ValueError("Neplatná akce.")
