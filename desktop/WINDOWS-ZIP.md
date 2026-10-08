# Windows ZIP

Rozbal celý ZIP. Hru lze spustit přímo přes `game/Life Is Bitch.exe`. `Install.cmd` zkopíruje hru do uživatelského profilu, vytvoří BETA ikonu na ploše a spustí hru. Administrátor není potřeba.

Tento balíček používá přímé EXE místo NSIS samorozbalovacího instalátoru, který v jednom CI běhu skončil chybou 0xC0000005. CI ověřuje skutečné spuštění zkopírované hry, nákup, MHD a cíl zástupce.
