# Praha 1:1 – migrace herního světa

Cíl: GTA 2 pohled shora nad skutečnou sítí ulic pěti pražských čtvrtí, jeden souřadnicový systém pro herní svět i mapové UI.

## Stav

- Hotovo: `web/prague-geo.js` převádí WGS84 ⇄ souřadnice světa v metrech prostřednictvím Web Mercatoru.
- Hotovo: kontrola orientace sever/jih a testy konzistence.
- Zatím není hotovo: reálné geometrie ulic, budov, hranic čtvrtí, kolizní systém, navázání misí ani satelitní vizualizace.

## Zdroj dat

- Silnice, budovy, parky, vodní plochy: OpenStreetMap, licence ODbL, uvést požadovanou atribuci. Stáhnout vybraný výřez přes legitimní export / poskytovatele výřezů, s ohledem na limity serveru.
- Satelitní vrstva: licencovaný poskytovatel (např. MapTiler). MapTiler Cloud nesmí být plošně stahován jako offline herní textura bez příslušného smluvního oprávnění; připojení a API klíč musí být konfigurovatelné. Offline režim zobrazí legálně distribuovanou stylizovanou mapu z OSM geometrií.
- Souřadnice center čtvrtí ve startovní konfiguraci jsou orientační body, NE správní hranice; skutečné hranice načíst ze zdrojových polygonů.

## Migrační kroky

1. Import dat a vyčištění silniční topologie. Každý úsek dostane stabilní ID, geometrii, typ a povolené směry.
2. Společné metrické souřadnice: OSM silnice, budovy, dopravní zastávky, hráč, AI doprava, kolize, misijní body, POI.
3. Vytvářet renderer po prostorových dlaždicích s cache a cullingem, ne generovat město podle čtvercové mřížky.
4. Znovu rozmístit spawny, chodníky, průchody, auta, NPC, podniky a MHD na legální pozice nad silnicemi.
5. Obě mapová UI (minimapa a klávesa M) propojit s týmž souřadnicovým systémem a s POI typy: obchod, Gun Shop, nemocnice, banka, práce, autoservis, ubytovna a policejní služebna. Fyzické herní obchody mohou být fiktivní; na mapě to musí být výslovně rozpoznatelné.
6. Přidat satelitní vrstvy jen v souladu s licencí v online režimu a offline fallback z OSM geometrií.
7. E2E test: pohyb mezi čtvrtěmi, kolize, mise, MHD, načítání, absence výpadků při přiblížení.
8. Po zelených testech a smoke buildu sloučit do main, poté vydat EXE. Launcher načítá herní web obsah z main; větev záměrně nemá aktualizovat běžnou instalaci.

## Kritéria hotového 1:1

- Silnice, parcely a budovy geometricky odpovídají zvolenému reálnému datovému výřezu.
- Vzdálenosti a poloha hráče se převádějí na GPS bez deformace v rámci zvolené projekce.
- Minimapa a svět zobrazují totožné pozice všech POI.
- Geometrie netvrdí přesnost 1:1, dokud nejsou převzata a ověřena zdrojová data.
