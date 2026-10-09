import json
from server import connect

with connect() as db:
    db.row_factory = __import__("sqlite3").Row
    rows = db.execute("SELECT id,name,first_seen,last_seen,launches,platform,version FROM players ORDER BY last_seen DESC").fetchall()
print(json.dumps([dict(row) for row in rows], ensure_ascii=False, indent=2))
