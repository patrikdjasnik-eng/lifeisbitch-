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

## 2026-10-09 · Životní systémy / Life systems

- Ubytovna: postel 150 herních Kč na noc, spánek +40 zdraví, posun dne. Domov odemyká pokoj za 450 herních Kč.
- Potraviny a obchodní centra: jídlo, voda a lékárnička s cenami a doplněním zdraví.
- Banka: bezplatný účet, hotovostní vklady/výběry, úvěr 1 000 Kč s pevnou 10% cenou a splatností 7 dní, částečné splácení. Finance odemyká úvěr 5 000 Kč a mobilní banku.
- Telefon P / tlačítko: herní SMS NPC (5 Kč, jedna denně), historie, tarifní účty 80 Kč každé 3 herní dny, splatnost a úhrada. Kontakty odemykají další NPC. Premium spojuje všechny tři balíčky.
- Den běží 5 minut aktivního hraní; v menu a pauze stojí. Stav součástí původního save, staré savy získají výchozí životní stav.
- Balíčky jsou konfigurační příprava, žádný checkout ani skutečné placené licence. `lifeEntitlements` je prázdné: lokální konfigurace není bezpečné ověření nákupu. Před prodejem doplnit backend/store ověření, ceny a finální rozsah. Online Premium z dřívějšího plánu zůstává budoucí funkcí.
- EN: Added hostel rental/sleep, grocery shopping, bank accounts/transfers/loans, recurring bills and NPC SMS with persistence. Optional housing/finance/social bundles and Premium are configuration scaffolding only; purchases and online mode are not implemented.
- Validation: `npm test`, bank/rental/bill/SMS edge cases, saves, service entrances/floors. Desktop installer not rebuilt in this change.

## 2026-10-09 · Textový design / Typography

Oranžové písmo a růžové akce podle vybraného náhledu. Pozadí textu v úvodním menu a HUD jsou průhledná; mise se při otevřeném menu skryje, aby se nepřekrývala s titulkem. Dialogy služeb mají čitelnou vlastní plochu. ImageGen použit pro vizuální předlohu, živé UI implementované v CSS. / Orange typography, magenta actions and transparent menu/HUD backgrounds; hide mission HUD behind the start menu.

Ukládání času každých 10 sekund aktivní hry a při pagehide zabraňuje ztrátě celého rozehraného dne. Gameplay testy ověřeny před začleněním do main.

## Launcher 0.1.3 / Automatické herní aktualizace

Tmavě modré UI, oranžový titulek, růžové akce, ukazatel stahování. Automatická kontrola main, stažení web do staging, ověření Git blob hashů, atomické přepnutí markeru, offline fallback, izolované IPC. Pouze herní web aktualizace; launcher/Electron přes nový instalátor. Testy updateru zahrnují přerušenou aktualizaci, offline, traversal, symlinky a poškozenou cache. Windows runtime/build nutné ověřit v CI.
