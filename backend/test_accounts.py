import os
import tempfile
import unittest
from pathlib import Path

with tempfile.TemporaryDirectory() as directory:
    os.environ["LIB_DATABASE"] = str(Path(directory) / "accounts.sqlite3")
    import server
    import accounts

    class AccountsTests(unittest.TestCase):
        def request(self, action, payload):
            with server.connect() as db:
                db.execute("BEGIN IMMEDIATE")
                return accounts.handle(db, action, payload)

        def test_lifecycle(self):
            character = {"id": "LIB-" + "a" * 32, "name": "Žižkovský hráč", "token": "b" * 64, "platform": "win32", "version": "0.1.5"}
            server.register(character)
            payload = {**character, "username": "Rabbit_01", "password": "correct horse battery"}
            created = self.request("register", payload)
            self.assertEqual(created["profile"]["id"], character["id"])
            with self.assertRaises(ValueError):
                self.request("register", payload)
            with self.assertRaises(PermissionError):
                self.request("login", {"username": "Rabbit_01", "password": "wrong password!"})
            logged = self.request("login", payload)
            self.assertEqual(self.request("session", {"session": logged["session"]})["profile"]["username"], "rabbit_01")
            self.request("logout", {"session": logged["session"]})
            with self.assertRaises(PermissionError):
                self.request("session", {"session": logged["session"]})
            with self.assertRaises(PermissionError):
                self.request("recover", {**payload, "recovery": "wrong", "password": "new correct password"})
            recovered = self.request("recover", {**payload, "recovery": created["recovery"], "password": "new correct password"})
            self.assertNotEqual(recovered["recovery"], created["recovery"])
            with self.assertRaises(PermissionError):
                self.request("session", {"session": created["session"]})
            with self.assertRaises(PermissionError):
                self.request("recover", {**payload, "recovery": created["recovery"]})
            with self.assertRaises(PermissionError):
                self.request("login", payload)
            self.assertTrue(self.request("login", {**payload, "password": "new correct password"})["ok"])
            with server.connect() as db:
                stored = db.execute("SELECT password_hash,recovery_hash FROM accounts").fetchone()
            self.assertNotEqual(stored[0], payload["password"])
            self.assertNotEqual(stored[1], recovered["recovery"])

    unittest.main()
