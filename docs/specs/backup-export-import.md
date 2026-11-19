# Spec · Backup export and restore
Status: approved · 2026-11-19

## Problem
Traildex has no backend: every route, folder, stage split, note and photo lives only in the IndexedDB of one browser. Clearing site data, changing phone or switching browser loses the whole collection, and the only way back in today is re-importing GPX files one by one, without photos, notes, folders or stages.

## Scope
- New pure module `src/backup.js` (no DOM, no IndexedDB) with:
  - `serializeBackup({ routes, folders, photos })` → backup object: `{ app: "traildex", kind: "backup", version: 1, exportedAt, routes, folders, photos }`. Routes keep the compact point format used in `storage.js` (`[lon, lat, ele, t]`). `photos` maps photo id → data URL (`data:image/...;base64,...`).
  - `parseBackup(text)` → validated backup object, or throws an `Error` with a readable message when the JSON is invalid, `app`/`kind` do not match, `version` is not `1`, or `routes`/`folders`/`photos` have the wrong type.
  - `planMerge(backup, existingRouteIds, existingFolderIds)` → `{ routes, folders, photoIds, skippedRoutes, skippedFolders }`: only items whose `id` is not already present, plus only the photo ids referenced by the routes being added.
- `src/storage.js`: helpers to read the raw stored routes (compact points) and to write a route that is already compact, so export/restore does not expand and re-compact points; and a helper to save a photo under a given id, because `savePhoto` creates a new id and restored routes must keep pointing to their photos.
- Export (web only): an **Export** button next to **Import** on the home screen (`src/ui.js`). It reads all routes, folders and photos, converts photo blobs to data URLs, and downloads `traildex-backup-YYYY-MM-DD.json` (local date) through a Blob URL and `<a download>`. With no routes other than samples the button is disabled.
- Sample routes and folders (`demo: true`) are not exported; they can be loaded again from the sample button.
- Restore: the existing file input (`#fileInput`, handler in `src/main.js`) also accepts `.json`. A `.json` file goes through `parseBackup` → `planMerge` → writes folders, photos and routes → updates the in-memory lists → shows a message `Restored X routes, Y folders · Z already present`. `.gpx`/`.kml` keep the current flow unchanged.
- Restored routes go through `ensureGeo` like newly imported routes, so country/region data is recomputed when `GEO_VERSION` changed.
- In the native app (`isNativeApp()`), the Export button is not shown and the file input does not accept `.json`, so restore is web only too.

## Out of scope
- Export of a single route as GPX (next spec).
- Export/restore inside the Android app (needs `@capacitor/filesystem` and `@capacitor/share`; later spec).
- "Replace everything" mode, conflict resolution, or updating a route that already exists with the same id.
- ZIP or any compression; encryption; cloud sync.
- Backup versions other than `1`.

## Risks
- **Size**: photos in base64 make the file ~33 % larger than the stored blobs, and everything is built in memory. Acceptable for personal collections; no streaming in this spec.
- **Partial restore**: if a write fails half way, some items are already saved. Order is folders → photos → routes, so a saved route never points to a missing photo or folder. Re-importing the same file completes the rest, because merge skips existing ids.
- **Untrusted file**: a `.json` could be anything. `parseBackup` validates structure before any write. Route names and notes are already escaped with `esc()` when rendered.
- **Resolved**: sample routes are stored in IndexedDB with `demo: true` and are excluded from the export (see Scope). A route of the user kept inside a sample folder keeps a `folderId` that the backup does not carry; `planMerge` sets it to `null` when the folder is neither in the backup nor on the device.
- **Assumption to confirm**: tests use Node's built-in runner (`node --test`, Node 22), so no new dependency.
- **Not covered by commands**: download, IndexedDB writes and UI are checked by hand in the browser.

## Acceptance criteria
| # | Criterion | How to check | Type |
|---|---|---|---|
| 1 | The app builds | `npm run build` exits 0 | cmd |
| 2 | Pure backup logic is tested: serialize → `JSON.stringify` → `parseBackup` round-trips routes, folders and photos; `parseBackup` throws on invalid JSON, wrong `app`/`kind`, `version: 2` and a missing `routes`; `planMerge` skips routes and folders whose id exists and drops the photos of skipped routes, skips ids repeated inside the backup and nulls a `folderId` that would dangle; `parseBackup` rejects routes without numeric `[lon, lat]` points | `node --test src/backup.test.js` exits 0 | cmd |
| 3 | The new test is part of the repo checks | `AGENTS.md` Checks table has a row 2 with `node --test src/backup.test.js`; `git grep -n "node --test src/backup.test.js" AGENTS.md` exits 0 | cmd |
| 4 | Export and restore keep the whole collection | In `npm run dev`, with ≥ 3 routes (one in a folder, one multi-day, one with ≥ 1 photo and notes), press **Export** → a file `traildex-backup-<today>.json` downloads. Open http://localhost:5173 in a private window (empty IndexedDB), **Import** that file → message `Restored 3 routes and 1 folder · 0 skipped (already on this device or repeated in the file)` (numbers matching the collection, singular for 1); same route count, folder, day split, notes and photo visible in route detail | manual |
| 5 | Restoring is idempotent and rejects bad files without writing | In the same private window, **Import** the same file again → message reports 0 routes and 0 folders restored and everything skipped as already on this device; route count unchanged. Import a `.json` that is not a Traildex backup (e.g. `package.json`) → error message shown, route count unchanged | manual |
| 6 | GPX/KML import is unchanged | **Import** a `.gpx` file → the "Add route" dialog opens with the name, date and summary as before, and saving adds the route | manual |
