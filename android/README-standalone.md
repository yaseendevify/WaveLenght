# Native Android app

The `standalone` Android flavor is built from Android native views and Android's native audio APIs. It does not package or render the React website, use WebView, or require Chrome for its main interface. The current native foundation includes song search against JioSaavn and Audius, streaming playback, on-device audio selection, local favourites, and listening history. This is an initial native implementation; it does not yet match every feature of the web app or sync the native library with Firebase.

## Debug build

With JDK 17, Android SDK platform 36, and Android Build Tools 36.0.0 installed, run:

```sh
npm run android:debug
```

The debug package uses `com.wavelength.music.debug` so it can be installed beside the release app.

## Signed release build

This native app uses a separate application ID (`com.wavelength.music.native`) from the existing web TWA, so it installs as its own app. It also needs its own release keystore. Keep the keystore and `release-signing.properties` backed up privately; neither belongs in Git. Copy `release-signing.properties.example` to `release-signing.properties` and fill in the local password values.

Build the signed APK with:

```sh
npm run android:build
```

The release output is under `android/app/build/outputs/apk/standalone/release/`. The app version code is incremented so a correctly signed build can upgrade the existing package.
