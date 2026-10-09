# Launcher 0.1.3

Jednou nainstaluj nový Windows balíček přes Install.cmd. Stejná ikona pak otevře launcher s kontrolou aktualizací z main. Herní webové soubory stahuje automaticky do uživatelského adresáře; uložení hry zůstává ve stejné aplikaci a na stejné adrese game://local.

Bez internetu nebo při selhání kontroly lze hrát předchozí verzi. Soubory se ověřují proti Git blob hashům a přepnutí proběhne až po kompletním stažení. Launcher nevyžaduje Git ani přihlášení na veřejný GitHub. GitHub rate limit může kontrolu dočasně omezit.

Aktualizace Electronu, launcheru a jiných souborů desktop vyžaduje nový instalační balíček. Tato verze automaticky aktualizuje pouze složku web. Před změnou rozhraní desktop/hra vydat nový kompatibilní launcher.

F11: celá obrazovka. --safe-mode vypíná hardwarovou akceleraci. --smoke ověřuje zabalenou hru bez síťových aktualizací.
