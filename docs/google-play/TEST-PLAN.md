# Android beta — akceptační test / Acceptance test

Zaznamenat model telefonu, Android, verzi WebView a číslo buildu. Testovat minimálně jeden slabší telefon, jeden běžný telefon a tablet.

- Čistá instalace, otevření, pojmenování postavy včetně diakritiky, zavření a opětovné spuštění.
- Chůze, sprint, řízení/brzda, vystoupení, zoom +/− a minimapa.
- Dokončení příběhového úkolu, nákup, vstup/výstup z budovy a schodiště.
- Přepnutí do jiné aplikace, uzamčení displeje a návrat bez ztráty postupu či zaseknutých tlačítek.
- Kontrola režimu na výšku i šířku, výřezu displeje, gest, tabletu a změny velikosti okna.
- Soukromí dostupné v menu, smazání se potvrzuje, po smazání vzniká čistý profil.
- Režim letadlo: všechny herní funkce dostupné, žádné nefunkční online tlačítko.
- 30 minut jízdy a pohybu po městě: zaznamenat FPS, zahřívání, baterii, pády a ANR.
- Aktualizace ze starší bety zachová postup; odinstalování data odstraní.
- Před Play: žádný debug signing, zkontrolovat manifest finálního AAB a veřejný privacy odkaz.

CI ověřuje start offline WebView, absenci INTERNET oprávnění, vytvoření postavy, dotykové prvky, soukromí a přetrvání profilu po obnově Activity. Nenahrazuje skutečný fyzický test nebo 14denní uzavřený test.

English: record device/Android/WebView/build; test low-end and regular phones plus a tablet. Verify first launch and persistence, movement/driving/interiors, touch zoom, background/lock/resume, different screen shapes, local-data deletion confirmation, airplane mode and a 30-minute performance session. CI is a smoke test, not a substitute for physical testing or Play's closed-test requirement.
