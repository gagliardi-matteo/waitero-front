# WaiterO Mobile Deployment

This Angular app is packaged for iOS and Android with Capacitor without replacing the existing UI.

## Local Setup

Run from `waitero-front`:

```bash
npm install
npm run assets:mobile
npm run build:mobile
```

`build:mobile` runs the Angular production build and then `cap sync`. The Capacitor web directory is `dist/front/browser`, which is the Angular 19 application builder browser output.

## Daily Commands

```bash
npm run build:mobile
npm run build:mobile:lan
npm run sync:mobile
npm run open:ios
npm run open:android
```

Use `open:ios` on macOS with Xcode installed. Use `open:android` with Android Studio installed.

## API and Realtime Networking

The production Angular build uses `src/environments/environment.prod.generated.ts`, currently pointing to:

```text
https://waitero-back-production-f19d.up.railway.app/api
```

Mobile builds must use HTTPS only. Android is configured with `allowMixedContent: false`, so any HTTP image, SSE, WebSocket, or API endpoint will fail by design. For WebSocket endpoints, use `wss://`; for SSE, keep the existing `https://` `EventSource` URLs.

JWT auth stored in `localStorage` works in Capacitor WebView storage. If the backend later moves auth to cookies, configure the Spring Boot CORS policy for the Capacitor origins `capacitor://localhost` and `https://localhost`, enable secure cookies, and use HTTPS.

## Local Device Testing On LAN

For local mobile testing, use the Angular `mobile` build configuration. That configuration replaces `src/environments/environment.ts` with `src/environments/environment.mobile.ts`.

Current mobile dev environment:

```text
src/environments/environment.mobile.ts
```

Example content:

```ts
export const environment = {
  production: false,
  apiUrl: 'http://192.168.1.53:8080/api',
  googleMapsApiKey: ''
};
```

Build and sync the app for a phone on your LAN with:

```bash
npm run build:mobile:lan
```

Requirements:

- `environment.mobile.ts` must contain your current computer LAN IP.
- Phone and computer must be on the same Wi-Fi network.
- Spring Boot must listen on `0.0.0.0:8080`, not only `127.0.0.1`.
- Firewall must allow inbound connections on port `8080`.
- Backend CORS must allow requests from Capacitor origins if your backend enforces origin checks.
- Android debug builds now allow cleartext HTTP for LAN testing through `android/app/src/debug/AndroidManifest.xml`. Release builds keep the stricter production settings.
- iOS still requires HTTPS or a temporary ATS exception in Xcode when you test against `http://IP_DEL_PC:8080`. Do not keep that exception in the App Store build.

Do not ship a store build with a LAN IP. Use the production HTTPS API for release builds.

## Native Behavior Included

- Splash screen configuration in `capacitor.config.ts`
- Status bar color/style configuration in `capacitor.config.ts` and runtime initialization
- Android hardware back button handling
- Light haptic feedback on touch actions
- Safe-area viewport handling for notches and home indicators
- Touch-first hover fallbacks for coarse pointers

## App Icons and Splash Assets

Source assets live in `resources/`:

```text
resources/icon.png
resources/splash.png
```

Regenerate platform assets after replacing those source files:

```bash
npm run assets:mobile
npm run sync:mobile
```

For store submission, replace the generated placeholder-style assets with final brand artwork before archiving.

## Android Release Build

1. Run `npm run build:mobile`.
2. Open Android Studio with `npm run open:android`.
3. Set version fields in `android/app/build.gradle`:
   - `versionCode`
   - `versionName`
4. Create or select a release signing key in Android Studio:
   - Build > Generate Signed Bundle / APK
   - Choose Android App Bundle for Play Store submission
5. Build the signed `.aab`.
6. Upload the `.aab` to Play Console.

Keep the package id as `com.waitero.app`.

## iOS Release Build

1. Run `npm run build:mobile`.
2. On macOS, open Xcode with `npm run open:ios`.
3. In Xcode, set:
   - Bundle Identifier: `com.waitero.app`
   - Display Name: `WaiterO`
   - Version and Build
   - Signing Team
4. Select a generic iOS device or connected device.
5. Product > Archive.
6. Distribute App > App Store Connect.

## Common Pitfalls

- Blank screen after launch: run `npm run build:mobile` or `npm run build:mobile:lan` before opening native IDEs, and verify `webDir` remains `dist/front/browser`.
- API calls fail on device: confirm the selected environment file contains the expected API URL and the backend allows Capacitor origins.
- SSE/WebSocket disconnects in background: mobile OSes can suspend WebViews; refresh active dashboard data on app resume if needed.
- Fonts or remote assets load slowly: bundle critical fonts/assets locally before final store submission.
- Android cleartext errors: use the debug build plus the LAN mobile configuration for local HTTP testing, and keep production on HTTPS only.
- iOS archive fails: run the iOS build on macOS with current Xcode and a valid Apple Developer team.
