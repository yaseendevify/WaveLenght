# Wavelength (React + Firebase)

Music player with login and cloud sync. Frontend: React + Vite. Backend: Firebase Auth + Firestore (no server of your own to run).

## Run locally
```
npm install
cp .env.example .env     # then fill in the 4 values
npm run dev
```

## Firebase setup (once)
1. Firebase console → your project → Project settings → Your apps → Web app. Copy `apiKey`, `authDomain`, `projectId`, `appId` into `.env`.
2. Authentication → Sign-in method: enable **Email/Password** and **Google**.
3. Firestore Database → Rules: paste the contents of `firestore.rules` and Publish. User data stays private; public playlist documents are readable only by direct share link and writable only by their owner.
4. Authentication → Settings → Authorized domains: add your hosting domain (e.g. `yourapp.netlify.app`). `localhost` is already allowed.

## Discover tab (Jamendo)
Create a free app at developer.jamendo.com, copy the **Client ID** (not the secret) into `VITE_JAMENDO_CLIENT_ID` in `.env`. Liked Jamendo songs sync to your account.

## Deploy
`npm run build`, then upload the `dist` folder to Netlify / Vercel / Cloudflare Pages. If you set env vars on the host instead of `.env`, use the same `VITE_FIREBASE_*` names.

## What syncs
Synced to your account: liked songs, recently played, Spotify links, volume, shuffle/repeat.
Not synced: audio files you add (they stay in that browser's IndexedDB, add them once per device).

## Notes
- Spotify links use Spotify's official embed. Ads and 30-second previews follow your Spotify account (Premium = no ads).
- Only add music you have the right to use.

## Bollywood (JioSaavn)
The Bollywood tab and the main Search page both query the JioSaavn-compatible API at `https://saavn.bycomsolutions.com`. No API key is configured in this project. This is an unofficial third-party API, so availability, CORS behavior, audio URLs, and catalog coverage can change without notice. Verify the API provider's terms and music rights before using streams in a public or commercial release.

## Music catalogs
- **JioSaavn** and **Gaana** are included as additional search sources. The Bollywood page combines both catalogs, and the main Search page queries them alongside the existing Jamendo/Audius sources.
- **Audius** is integrated into Search and Discover. Discover also includes targeted searches for Pakistani music, Coke Studio Pakistan, Pashto, Sindhi, and Saraiki music. These are search queries, not guaranteed regional-catalog filters; availability depends on what Audius creators have uploaded and tagged.
- Gaana integration uses the unofficial public API documented at https://github.com/shnwazdev/shnwazdev-GaanaAPI. It does not require an API key, but upstream availability and regional access are not guaranteed.
- Gaana stream links may be HLS (`.m3u8`). Native HLS playback depends on browser support; this project does not bundle an HLS playback library. If a browser cannot play a returned HLS URL, the song may appear in search but playback can fail.
- Only stream or reuse music where you have the appropriate rights. The API repository's MIT license does not grant rights to Gaana's music catalog.

## Public playlist links

Signed-in users can mark a playlist public and copy its link. Anyone with the link can view the playlist name, description, cover, and catalog track details; visitors cannot edit it. Device-only audio files are not included. Publish the rules in `firestore.rules` before using public links.
