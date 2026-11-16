# Traildex · agent guide

Traildex is a web app for collecting hikes, bike rides and Camino stages on a 3D globe. It is live at https://traildex.vercel.app; the Android app (Capacitor) is not published yet. The README describes the product. This file describes how to work in the repo.

## Stack

- Vanilla JavaScript (ES modules), HTML and CSS. No framework, no TypeScript.
- Vite 8 for development and builds. Tested on Node 22.
- MapLibre GL JS 6: globe projection, terrain and hillshade.
- IndexedDB through `idb-keyval`. There is no backend: all data stays on the device.
- Capacitor 8 for Android, with `@capacitor-community/background-geolocation`.
- Vercel deploys the `main` branch.

## Commands

| Command | What it does |
|---|---|
| `npm install` | Installs dependencies |
| `npm run dev` | Dev server at http://localhost:5173 |
| `npm run build` | Production build in `dist/` |
| `npm run preview` | Serves `dist/` locally |
| `npm run build:geo` | Regenerates `public/geo` from Natural Earth (downloads data) |
| `npm run android` | Builds, runs `cap sync android` and opens Android Studio |

## Checks

A task is not done until every command below exits with code 0. Run them in this order from the repo root.

| # | Command | What it checks |
|---|---|---|
| 1 | `npm run build` | The app compiles and every import resolves |

Do not replace this list with other commands. New checks are added here when they exist. Vite's warning about chunks larger than 500 kB is known and is not a failure.

The build does not cover the map, GPS recording or IndexedDB. Those are checked by hand in the browser or on a phone: say so instead of reporting them as tested.

## Project structure

```
src/
  main.js            app state, map layers and navigation
  ui.js, detail.js   home list and route detail
  collectionView.js  collection: maps, cards and achievements
  album.js, geo.js   which countries and regions each route crosses
  rarity.js, cards.js, achievements.js, medals.js
  recorder.js, tracker.js, recordView.js, elevation.js   GPS recording
  stats.js, stages.js, parseTrack.js                     track maths and GPX/KML parsing
  storage.js         IndexedDB persistence
scripts/             build-geo.mjs and build-demo.py generate data under public/
android/             Capacitor Android project
```

## Conventions

- Code comments are in Spanish, matching the existing ones. Commit messages and the README are in English.
- `public/geo/` and `public/demo/routes.json` are generated: change them through their script, not by hand.
- `dist/` and `node_modules/` are never committed.
- No new dependencies unless the task asks for them.

## Android

- The `applicationId` is `io.github.rafagcmc.traildex`. The Gradle `namespace` and the Java package are still `io.github.rafagcmc.trailglobe`. This is intentional for now: do not rename them as a side effect of another task.
- Background recording needs `android.useLegacyBridge: true` in `capacitor.config.json`. Do not remove it.
- `npm run android` needs Android Studio installed.

## Boundaries

- This repo is public: no personal data, keys, tokens or URLs containing a token, in any file.
- Do not read or write `.env*` files or keystores (`*.jks`, `*.keystore`).
- Do not upload to Google Play or deploy by hand. The repo owner does that.
