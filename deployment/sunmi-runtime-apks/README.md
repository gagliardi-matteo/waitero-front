# Sunmi runtime APKs

Pacchetti usati sul Sunmi `V2_PRO-ST` con Android `7.1.2` / SDK `25` / `armeabi-v7a`.

## Contenuto

- `waitero-kitchen-1.0.1-v7-esper-release-signed.apk`
  - APK WaiterO installato sul device.
- `com.android.chrome.apk`
- `com.android.chrome.auxiliary_search.apk`
- `com.android.chrome.cablev2_authenticator.apk`
- `com.android.chrome.chrome.apk`
- `com.android.chrome.config.en.apk`
- `com.android.chrome.feedv2.apk`
- `com.android.chrome.read_aloud_playback.apk`
- `com.android.chrome.survey.apk`
  - Split APK di Google Chrome `119.0.6045.193`, variante `armeabi-v7a`, compatibile con Android 7.

## Installazione manuale via ADB

Installare Chrome come split package:

```powershell
adb install-multiple -r `
  .\com.android.chrome.apk `
  .\com.android.chrome.auxiliary_search.apk `
  .\com.android.chrome.cablev2_authenticator.apk `
  .\com.android.chrome.chrome.apk `
  .\com.android.chrome.config.en.apk `
  .\com.android.chrome.feedv2.apk `
  .\com.android.chrome.read_aloud_playback.apk `
  .\com.android.chrome.survey.apk
```

Installare WaiterO:

```powershell
adb install -r .\waitero-kitchen-1.0.1-v7-esper-release-signed.apk
```

## Note WebView

Su questo Sunmi il provider WebView effettivo e' `com.android.chrome`.

La verifica post-installazione ha confermato:

```text
WebViewFactory: Loading com.android.chrome version 119.0.6045.193
```

Il pacchetto standalone `com.google.android.webview` risulta disabilitato sul device. Non e' stato incluso qui perche' il file WebView recuperato durante il test non era un APK valido, ma una pagina HTML. Per questo device e per WaiterO e' sufficiente aggiornare Chrome alla versione 119 compatibile con Android 7.

Chrome/WebView 150+ e WebView Canary 152 non sono compatibili con questo Sunmi perche' richiedono Android piu' recente.
