// Pure backup logic: no DOM and no IndexedDB, so it can be tested with `node --test`.
// A backup is one JSON object with every route, folder and photo (as data URLs).

export const BACKUP_VERSION = 1;

const NOT_A_BACKUP = "This file is not a Traildex backup.";

// Builds the backup object. `now` is a parameter only to keep tests deterministic.
export function serializeBackup({ routes, folders, photos }, now = new Date()) {
  return {
    app: "traildex",
    kind: "backup",
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    routes,
    folders,
    photos,
  };
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkList(backup, key) {
  if (!Array.isArray(backup[key])) {
    throw new Error(`Backup is damaged: "${key}" must be a list.`);
  }
  for (const item of backup[key]) {
    if (!isPlainObject(item) || typeof item.id !== "string") {
      throw new Error(`Backup is damaged: every item in "${key}" needs a text id.`);
    }
  }
}

function isPoint(p) {
  return Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]);
}

// Validates the structure before anything is written. Throws an Error with a
// readable message when the file is not a usable backup.
export function parseBackup(text) {
  let backup;
  try {
    backup = JSON.parse(text);
  } catch {
    throw new Error("The file is not valid JSON.");
  }

  if (!isPlainObject(backup) || backup.app !== "traildex" || backup.kind !== "backup") {
    throw new Error(NOT_A_BACKUP);
  }
  if (backup.version !== BACKUP_VERSION) {
    throw new Error(`Unsupported backup version: ${backup.version}.`);
  }

  checkList(backup, "routes");
  checkList(backup, "folders");

  for (const route of backup.routes) {
    if (!Array.isArray(route.points) || !route.points.every(isPoint)) {
      throw new Error(`Backup is damaged: route "${route.id}" needs points with numeric lon and lat.`);
    }
  }

  if (!isPlainObject(backup.photos)) {
    throw new Error('Backup is damaged: "photos" must be an object.');
  }
  for (const [id, url] of Object.entries(backup.photos)) {
    if (typeof url !== "string" || !url.startsWith("data:")) {
      throw new Error(`Backup is damaged: photo "${id}" is not a data URL.`);
    }
  }

  return backup;
}

// Decides what to write: only items whose id is not already present, and only
// the photos referenced by the routes being added.
export function planMerge(backup, existingRouteIds, existingFolderIds) {
  const knownRoutes = new Set(existingRouteIds);
  const knownFolders = new Set(existingFolderIds);

  // Ids repeated inside the backup are skipped too: the first one wins.
  const seenFolders = new Set();
  const folders = backup.folders.filter((f) => {
    if (knownFolders.has(f.id) || seenFolders.has(f.id)) return false;
    seenFolders.add(f.id);
    return true;
  });

  // A route can only point to a folder that will exist after the restore.
  const reachableFolders = new Set([...knownFolders, ...backup.folders.map((f) => f.id)]);

  // Routes are copied so photo ids the backup does not carry (and folder ids that
  // would dangle) can be fixed without mutating the parsed backup.
  const photoIds = new Set();
  const seenRoutes = new Set();
  const routes = backup.routes
    .filter((r) => {
      if (knownRoutes.has(r.id) || seenRoutes.has(r.id)) return false;
      seenRoutes.add(r.id);
      return true;
    })
    .map((route) => {
      let out = route;
      if (out.folderId != null && !reachableFolders.has(out.folderId)) {
        out = { ...out, folderId: null };
      }
      if (Array.isArray(out.photoIds)) {
        const present = out.photoIds.filter((id) => id in backup.photos);
        for (const id of present) photoIds.add(id);
        out = { ...out, photoIds: present };
      }
      return out;
    });

  return {
    routes,
    folders,
    photoIds: [...photoIds],
    skippedRoutes: backup.routes.length - routes.length,
    skippedFolders: backup.folders.length - folders.length,
  };
}
