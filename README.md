# Life Is Bitch · Betonové sny

Hratelný prototyp pouliční hry v češtině. Stylizované pražské čtvrti, auta, levelování a průřez interiéry. Zdroj hry je ve `web/` a obsahuje lokální Three.js včetně licence.

## Android

Android 8.0+, orientace na šířku, dotykové ovládání, offline obsah a uložený postup. Používá systémový Android WebView; pro 3D je potřeba funkční WebGL. Projekt vychází z webového prototypu, nejde zatím o nativní AA hru.

GitHub Actions → Android APK and AAB → úspěšný běh → artifact `life-is-bitch-android`.

- `app-debug.apk`: přímo instalovatelná testovací verze s debug podpisem.
- `app-release.aab`: nepodepsaný bundle, před Google Play vyžaduje vlastní upload klíč a release podpis. Debug klíč nepoužívat pro vydání.

Lokálně: Android Studio otevřít složku `android`, nainstalovat SDK 35, Build → Generate Signed App Bundle / APK. CLI s JDK 17, SDK 35 a Gradle 8.9: `cd android` a `gradle :app:assembleDebug :app:bundleRelease`.

Web: spustit HTTP server ve `web/`, například `python -m http.server 8080`.

## Ovládání

Šipky na displeji: pohyb a řízení. E: dveře, kontakty a schody. F: auto. Tlačítka sprintu, brzdy a mapy jsou dole. Pozastavení přes horní tlačítko nebo Android Zpět.

## Stav ověření

Herní logika a Three.js geometrie prošly testy původního prototypu. Android sestavení potvrzuje pouze zelený Actions běh; výkon na skutečném telefonu vyžaduje samostatné ověření.
