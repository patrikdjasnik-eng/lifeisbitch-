# Life Is Bitch · Betonové sny

Hratelný prototyp pouliční hry v češtině. Výchozí vizuál je noční top-down město ve stylu GTA2: auta, pěší, MHD, levelování, inventář, vzdělání, policejní test a průřez interiéry. Zdroj hry je ve `web/`.

## 🚀 Spuštění hry v prohlížeči

### Nejrychlejší varianta – Python

1. Nainstaluj Python 3.
2. Otevři terminál v kořenové složce repozitáře.
3. Spusť:

```powershell
cd web
python -m http.server 8080
```

4. V prohlížeči otevři **http://localhost:8080**.

Pokud příkaz `python` ve Windows nefunguje, vyzkoušej `py -m http.server 8080`. Server ukončíš klávesami `Ctrl+C`.

Alternativně můžeš použít Node.js:

```bash
npx http-server web -p 8080
```

### Android

Android 8.0+, orientace na šířku, dotykové ovládání, offline obsah a uložený postup. Aplikace používá systémový Android WebView; nejde zatím o nativní AAA hru.

Testovací APK lze stáhnout z úspěšného GitHub Actions běhu **Android APK and AAB** jako artifact `life-is-bitch-android`. Soubor `app-debug.apk` je testovací APK s debug podpisem. `app-release.aab` je nepodepsaný bundle a před vydáním na Google Play vyžaduje vlastní upload klíč a release podpis.

Lokální sestavení vyžaduje Android Studio nebo JDK 17, Android SDK 35 a Gradle 8.9. V adresáři `android` lze spustit:

```bash
gradle :app:assembleDebug :app:bundleRelease
```

## Ovládání

- Šipky na displeji nebo WASD: pohyb a řízení.
- E: dveře, kontakty, MHD a schody.
- F: nastoupit do auta / vystoupit.
- I: inventář.
- P: telefon.
- M: mapa.
- Uložení: nabídka Player.

## Stav ověření

Herní logika má testy prototypu včetně Zahradního Města, questů, MHD, policejního testu, inventáře a samostudia. Úspěšný Android Actions build potvrzuje sestavení, nikoli výkon na každém fyzickém telefonu.
