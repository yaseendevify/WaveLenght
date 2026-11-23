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
3. Firestore Database → Rules: paste the contents of `firestore.rules` and Publish (each user can only read/write their own document).
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
