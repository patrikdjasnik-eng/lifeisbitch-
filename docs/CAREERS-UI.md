# Kariérní mise a webové UI

Větev: `release/google-play-beta`. Společná úprava pro web, desktop a Android.

Po pěti úvodních úkolech otevři **Kariéra (K)** nebo tlačítko v HUDu. Obě série lze střídat. Aktivní může být jedna kariérní mise nebo jedna opakovatelná zásilka. Každá mise má tři označená místa; vystup z auta a použij E, potom potvrď interakci. Peníze, XP a respekt se přičtou až na konci.

Postup každého kroku se ukládá lokálně do existujícího uloženého postupu. Starší uložené hry začnou s nulou dokončených kariérních misí, bez ztráty původních statistik. Zrušenou misi lze začít znovu, dokončenou misi nelze opakovat pro další odměnu. Tyto úkoly používají dialogové interakce; pracovní minihry ani nové animace práce v této aktualizaci nejsou.

UI používá barvy a zabalené fonty Bebas Neue / Manrope z dodaného webového mockupu. HUD zůstává průhledný, BETA a značka studia viditelné. Licence fontů jsou ve web/licenses.

## Ulice — 20 misí

| # | Název | Level | Kč | XP |
|---|---|---|---|---|
| 1 | Druhá noc | 1 | 1400 | 85 |
| 2 | Cizí slib | 1 | 1660 | 97 |
| 3 | Praskliny | 1 | 1920 | 109 |
| 4 | Zásilka pro Leu | 1 | 2180 | 121 |
| 5 | Dluh na papíře | 2 | 2440 | 133 |
| 6 | Prázdné místo | 2 | 2700 | 145 |
| 7 | Pozvánka za město | 2 | 2960 | 157 |
| 8 | Hranice důvěry | 2 | 3220 | 169 |
| 9 | Drahá noc | 3 | 3480 | 181 |
| 10 | Starý kamarád | 3 | 3740 | 193 |
| 11 | Pověst | 3 | 4000 | 205 |
| 12 | Nesplněná dohoda | 3 | 4260 | 217 |
| 13 | Rodinný stůl | 4 | 4520 | 229 |
| 14 | Za zavřeným klubem | 4 | 4780 | 241 |
| 15 | Cena jména | 4 | 5040 | 253 |
| 16 | Druhá šance | 4 | 5300 | 265 |
| 17 | Poslední velká noc | 5 | 5560 | 277 |
| 18 | Ticho po dešti | 5 | 5820 | 289 |
| 19 | Účet s Viktorem | 5 | 6080 | 301 |
| 20 | Vlastní jméno | 5 | 6340 | 313 |

## Práce — 20 questů

| # | Název | Level | Kč | XP |
|---|---|---|---|---|
| 1 | První výplata | 1 | 850 | 85 |
| 2 | Ranní zásobování | 1 | 1020 | 97 |
| 3 | Čistý dvůr | 1 | 1190 | 109 |
| 4 | Knihy pro školu | 1 | 1360 | 121 |
| 5 | Pneumatiky | 2 | 1530 | 133 |
| 6 | Směna v kavárně | 2 | 1700 | 145 |
| 7 | Ztracená peněženka | 2 | 1870 | 157 |
| 8 | Prádlo na ráno | 2 | 2040 | 169 |
| 9 | Světla výlohy | 3 | 2210 | 181 |
| 10 | Sobotní trh | 3 | 2380 | 193 |
| 11 | Noční inventura | 3 | 2550 | 205 |
| 12 | Dopisy sousedům | 3 | 2720 | 217 |
| 13 | Zahrada mezi domy | 4 | 2890 | 229 |
| 14 | Hudba do výlohy | 4 | 3060 | 241 |
| 15 | Před vernisáží | 4 | 3230 | 253 |
| 16 | Ranní vydání | 4 | 3400 | 265 |
| 17 | Pomoc v depu | 5 | 3570 | 277 |
| 18 | Klíče od dílny | 5 | 3740 | 289 |
| 19 | Dobré reference | 5 | 3910 | 301 |
| 20 | Pevná půda | 5 | 4080 | 313 |

## Ověření

`npm test` ověřuje katalog 40 misí / 120 cílů, odemykání, obnovení postupu, neplatná data, vzdálenost interakce, přístupnost mapových bodů a jedinou odměnu za dokončení. Workflow Game UI smoke ověřuje UI v prohlížeči přes podporovaný 2D fallback a ukládá screenshoty; nenahrazuje měření 3D výkonu na fyzickém telefonu. Android Play beta vytváří APK/AAB, spouští lint a test aplikace v emulátoru.
