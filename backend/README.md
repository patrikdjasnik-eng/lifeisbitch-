# Registr hráčů / Player registry

Backend ukládá ID, jméno postavy, datum prvního a posledního přihlášení, počet spuštění, platformu a verzi aplikace do SQLite. Neuchovává IP adresy v databázi ani systémový fingerprint. Registrace probíhá při zahájení hry v desktop aplikaci, nikoliv při pouhém stažení. Počítadlo znamená zahájení herních relací. Browser se neregistruje.

## Spuštění na Windows

V kořeni repa spusť:

```powershell
python backend/server.py
```

Databáze je standardně v uživatelské složce LifeIsBitch/players.sqlite3. Proměnná LIB_DATABASE může nastavit jinou cestu. Zálohu SQLite dělej přes sqlite3 backup API. Neumisťuj databázi do veřejné webové složky.

Desktop aplikace používá výchozí adresu http://127.0.0.1:8789. Pro ostatní hráče nastav před spuštěním aplikace:

```powershell
$env:LIB_REGISTRY_URL = "https://tvoje-domena.cz"
& ".\\Life Is Bitch.exe"
```

Pro sdílený registr nasaď backend na trvalý server s HTTPS reverse proxy. LIB_HOST a LIB_PORT mění rozhraní a port backendu. Výchozí localhost je určený pro lokální testování. SQLite na Vercel serverless není trvalé úložiště; tento backend tam nenasazuj jako SQLite funkci.

Pokud server není dostupný, hra pokračuje offline a další zahájení hry registraci zkusí znovu. Registrační token se ukládá na zařízení a backend uchovává jen jeho hash. ID nelze přepsat jiným tokenem. Obnovení profilu bez jeho tokenu vyžaduje administrátorskou obnovu.

## Lokální přehled hráčů

```powershell
python backend/list_players.py
```

Přehled není veřejný HTTP endpoint.

## Test

```powershell
python backend/test_registry.py
```

Registrace klientem dokládá kontakt spuštěné aplikace, nikoliv kryptografický důkaz instalace. Endpoint je možné napodobit; veřejné skóre zatím nepřijímá a neposkytuje.

## English

Run python backend/server.py with Python 3.11+. Player records persist in SQLite under your user directory by default. Set LIB_DATABASE to change the database location. The desktop app registers a named character when starting a game session. Web downloads alone are not tracked.

The default client endpoint is localhost port 8789. Set LIB_REGISTRY_URL to your HTTPS server URL for a shared registry; run the backend on durable storage behind a reverse proxy. SQLite in Vercel serverless is not durable. An unreachable registry never prevents offline play; registration retries on the next game start.

Use python backend/list_players.py for a local administrative listing and python backend/test_registry.py for tests. Stored fields are player ID, character name, first/last timestamps, session count, platform, version and hashed registration token. No public listing endpoint or verified online scores are provided. Client requests are not cryptographic proof of installation.

## Účty bez e-mailu / Email-free accounts

Desktop 0.1.5 přidává registraci pomocí přihlašovacího jména a hesla (10–128 znaků). Jméno postavy zůstává samostatné a podporuje 40 znaků a diakritiku. Hesla používají PBKDF2-SHA256, 600 000 iterací a náhodnou sůl. Server ukládá hashe tokenů relace a obnovovacího kódu. Relace platí 7 dní; aplikace si token pamatuje pouze v aktuální relaci okna.

Ztracené heslo lze obnovit jednorázovým obnovovacím kódem. Po obnově se kód otočí a všechny relace se zruší. Ztráta hesla i kódu vyžaduje administrátorskou obnovu. Každá IP má limit 10 požadavků na účty za minutu. Veřejný server provozuj za HTTPS proxy s další ochranou a trvalým diskem.

Účet zatím neukládá herní postup do cloudu a nepřidává multiplayer. Pro společnou registraci kamarádů použij jeden veřejný server a LIB_REGISTRY_URL ve všech instalacích. Výchozí localhost je soukromá databáze na konkrétním PC.

Desktop 0.1.5 supports username/password registration without email, sign-in, sign-out and one-time recovery codes. Passwords use salted PBKDF2-SHA256 with 600,000 iterations. Session tokens and recovery codes are stored hashed. Sessions expire after seven days; the client retains its session token only for the window session. Recovery rotates the code and revokes all sessions. Account routes allow ten requests per IP per minute. Use an HTTPS reverse proxy and persistent storage for public hosting.

Accounts do not yet include multiplayer or cloud game saves. Friends need the same public registry endpoint configured through LIB_REGISTRY_URL.
