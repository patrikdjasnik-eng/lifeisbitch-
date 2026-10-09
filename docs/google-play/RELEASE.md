# Google Play beta — pracovní větev / release branch

Stav: technická příprava offline Android bety. Není odesláno do Google Play.
Větev release/google-play-beta je veřejná, protože celý repozitář je veřejný. GitHub nepodporuje soukromé jednotlivé větve. Klíče patří do zabezpečeného úložiště a GitHub Secrets, nikdy do repa.

## Obsah Android 0.1.6-beta
- SDK 36, min. Android 8 / API 26, versionCode 6.
- Lokální profil a postup; bez síťového oprávnění, účtů, analytiky, reklam a plateb.
- Vestavěné informace o soukromí a možnost smazat místní data.
- Mobilní přiblížení a oddálení, lokální fonty, adaptivní ikona.
- Automatický build APK, nepodepsaného AAB, lint a test spuštění/uložení profilu v emulátoru.
- Desktop účty a backend zůstávají v hlavní větvi. Budoucí Android online režim vyžaduje skutečný server, funkční smazání účtu v aplikaci i webovou cestu a nové posouzení Data safety.

## Co zbývá před uzavřeným testem v Play Console
1. Ověřit vlastní Google Play Developer účet a jeho typ. Nenahrávat účetní ani platební údaje do repa.
2. Potvrdit trvalé applicationId cz.rabbithollow.lifeisbitch před prvním uploadem.
3. Vygenerovat a bezpečně zálohovat upload key; zapnout Play App Signing.
4. Doplnit skutečné jméno/provozovatele a kontakt v PRIVACY-DRAFT.md a v mobilní stránce soukromí. Návrh není finální právní dokument.
5. Zveřejnit zásady soukromí na stabilní veřejné HTTPS adrese a vložit adresu do Play Console.
6. Doplnit skutečné screenshoty z Androidu (telefon i tablet), 512×512 store ikonu a 1024×500 feature graphic. Nevydávat obrázky desktopu za Android.
7. Vyplnit Data safety podle skutečného výsledného balíčku a obsahový dotazník IARC. Popsat drogovou tematiku, zločin a policejní honičky pravdivě. Nenabízet hru jako dětskou.
8. Provést fyzické testy podle TEST-PLAN.md. Emulátor nepotvrzuje výkon na slabém telefonu.
9. V Actions spustit Android Play beta s signed_release=true a stáhnout play-upload-signed. Nepodepsaný artefakt není soubor pro odeslání do obchodu.
10. Nahrát AAB do interního nebo uzavřeného testování, zkontrolovat pre-launch report a vyřešit nálezy.
11. U osobního vývojářského účtu vytvořeného po 13. 11. 2023 Google požaduje nejméně 12 testerů přihlášených k uzavřenému testu nepřetržitě alespoň 14 dní před žádostí o produkční přístup. Nelze to nahradit CI testem.

## Upload key
V terminálu na vlastním PC s JDK spusť (heslo zadáš interaktivně):
```powershell
keytool -genkeypair -v -keystore "$env:USERPROFILE\lifeisbitch-upload.jks" -alias lifeisbitch-upload -keyalg RSA -keysize 3072 -validity 10000
```
Ulož dvě bezpečné zálohy klíče a hesla. Nevytvářej nový klíč při každém buildu.
Repository Secrets: ANDROID_UPLOAD_KEY_BASE64 (base64 souboru), ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD.
Klíč ani hesla neposílej do chatu. Workflow je po buildu smaže z dočasného runneru.

## Ověřené zdroje k 9. 10. 2026
- API 36: https://support.google.com/googleplay/android-developer/answer/11926878
- Testování: https://support.google.com/googleplay/android-developer/answer/14151465
- Data safety: https://support.google.com/googleplay/android-developer/answer/10787469
- Uživatelská data a smazání účtu: https://support.google.com/googleplay/android-developer/answer/10144311
- AGP / API 36: https://developer.android.com/build/releases/agp-8-10-0-release-notes

## English
This public branch prepares an offline Android beta, not a Play publication. API 36, local-only player data, no network permission, payments, ads or online accounts. CI builds a debug APK and unsigned AAB and runs lint plus emulator tests. Configure private upload-key secrets and run signed_release to obtain an upload-signed bundle. Keep the upload key backed up.

Before Play testing, verify the developer account and package ID, complete and host a real privacy policy with operator contact, create genuine Android screenshots and store artwork, complete Data safety and IARC, and test on physical devices. Applicable new personal accounts need 12 continuously opted-in closed testers for at least 14 days before applying for production access. Multiplayer and online account support are not included in this Android beta. A branch cannot be private inside a public GitHub repository.
