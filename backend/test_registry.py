import os
import tempfile
import unittest
from pathlib import Path

with tempfile.TemporaryDirectory() as directory:
    os.environ["LIB_DATABASE"] = str(Path(directory) / "test.sqlite3")
    import server

    class RegistryTests(unittest.TestCase):
        def test_registration(self):
            data = {"id": "LIB-" + "a" * 32, "name": "Žižkov Adam", "token": "b" * 64, "platform": "win32", "version": "0.1.3"}
            server.register(data)
            server.register(data)
            with server.connect() as db:
                row = db.execute("SELECT name,launches,token_hash FROM players").fetchone()
            self.assertEqual(row[:2], ("Žižkov Adam", 2))
            self.assertNotEqual(row[2], data["token"])
            with self.assertRaises(PermissionError):
                server.register({**data, "token": "c" * 64})
            with self.assertRaises(ValueError):
                server.register({**data, "name": "<script>"})
            with self.assertRaises(ValueError):
                server.register({**data, "id": "'; DROP TABLE players"})

    unittest.main()
