# Plán dalšího vývoje

## Premium a online hraní

- Základní offline hra zdarma.
- Premium za 800 Kč s přístupem k online hraní.
- Pracovní předpoklad: jednorázový nákup; model platby potvrdit před implementací.
- Premium i multiplayer jsou plánované, v aktuální verzi nejsou implementované.
- Nejprve malý multiplayer prototyp, potom účty, serverem ověřené oprávnění a platby.
- Server rozhoduje o pohybu, inventáři, odměnách a ekonomice; klient pouze posílá vstupy.
- Vydání pro Steam a Android bude potřebovat platformní ověřování nákupu.
- Hosting, kapacitu serveru a pravidla online světa určit po testu prototypu.

## Hudba

Plánované rádio: oldschool trap, UK drill a boom bap. Vyřešit vlastní smyčky nebo dodané beaty s právy k použití. Aktuální zvuk města zatím zůstává.

## Windows

Electron obaluje současný webový prototyp. Hra se načítá z lokálních souborů přes vlastní protokol a ukládá postup do uživatelského profilu. F11 přepíná celou obrazovku.

GitHub Actions → Windows EXE → artifact life-is-bitch-windows obsahuje instalační EXE pro Windows x64. Instalátor není podepsaný vydavatelským certifikátem. CI ověřuje spuštění hry i vytvoření balíčku; výkon na hráčově PC se ověřuje zvlášť.

Lokální vývoj: Node.js 22, npm install, npm run desktop:start. Sestavení na Windows: npm run desktop:build.
