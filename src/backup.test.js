import { test } from "node:test";
import assert from "node:assert/strict";
import { serializeBackup, parseBackup, planMerge } from "./backup.js";

const NOW = new Date("2026-11-19T12:00:00.000Z");

// Small collection: 2 folders, 3 routes (compact points), 3 photos.
function fixture() {
  return {
    folders: [
      { id: "f1", name: "Camino" },
      { id: "f2", name: "Alps" },
    ],
    routes: [
      { id: "r1", name: "Day 1", photoIds: ["p1", "p2"], folderId: "f1", points: [[-1.5, 42.8, 400, null], [-1.6, 42.9, 420, null]] },
      { id: "r2", name: "Day 2", photoIds: [], folderId: "f1", points: [[-1.7, 43.0, null, 1700000000]] },
      { id: "r3", name: "Ride", photoIds: ["p3"], folderId: null, points: [[6.1, 45.9, 1000, null]] },
    ],
    photos: {
      p1: "data:image/jpeg;base64,AAAA",
      p2: "data:image/jpeg;base64,BBBB",
      p3: "data:image/png;base64,CCCC",
    },
  };
}

function backupText(overrides = {}) {
  return JSON.stringify({ ...serializeBackup(fixture(), NOW), ...overrides });
}

test("serialize -> JSON -> parse round-trips routes, folders and photos", () => {
  const original = fixture();
  const parsed = parseBackup(JSON.stringify(serializeBackup(original, NOW)));

  assert.equal(parsed.app, "traildex");
  assert.equal(parsed.kind, "backup");
  assert.equal(parsed.version, 1);
  assert.equal(parsed.exportedAt, "2026-11-19T12:00:00.000Z");
  assert.deepEqual(parsed.routes, original.routes);
  assert.deepEqual(parsed.folders, original.folders);
  assert.deepEqual(parsed.photos, original.photos);
});

test("parseBackup throws on invalid JSON", () => {
  assert.throws(() => parseBackup("{not json"), /not valid JSON/);
});

test("parseBackup throws on wrong app or kind", () => {
  assert.throws(() => parseBackup(backupText({ app: "other" })), /not a Traildex backup/);
  assert.throws(() => parseBackup(backupText({ kind: "route" })), /not a Traildex backup/);
  assert.throws(() => parseBackup("[]"), /not a Traildex backup/);
});

test("parseBackup throws on an unsupported version", () => {
  assert.throws(() => parseBackup(backupText({ version: 2 })), /Unsupported backup version: 2/);
});

test("parseBackup throws when routes is missing or has the wrong type", () => {
  assert.throws(() => parseBackup(backupText({ routes: undefined })), /"routes" must be a list/);
  assert.throws(() => parseBackup(backupText({ routes: {} })), /"routes" must be a list/);
});

test("parseBackup throws on bad folders, photos and items without id", () => {
  assert.throws(() => parseBackup(backupText({ folders: "x" })), /"folders" must be a list/);
  assert.throws(() => parseBackup(backupText({ photos: [] })), /"photos" must be an object/);
  assert.throws(() => parseBackup(backupText({ photos: { p1: "http://x" } })), /not a data URL/);
  assert.throws(() => parseBackup(backupText({ routes: [{ name: "no id" }] })), /text id/);
});

test("planMerge adds everything when nothing exists yet", () => {
  const backup = parseBackup(backupText());
  const plan = planMerge(backup, [], []);

  assert.equal(plan.routes.length, 3);
  assert.equal(plan.folders.length, 2);
  assert.deepEqual(plan.photoIds.sort(), ["p1", "p2", "p3"]);
  assert.equal(plan.skippedRoutes, 0);
  assert.equal(plan.skippedFolders, 0);
});

test("planMerge skips existing ids and drops the photos of skipped routes", () => {
  const backup = parseBackup(backupText());
  const plan = planMerge(backup, new Set(["r1"]), ["f1"]);

  assert.deepEqual(plan.routes.map((r) => r.id), ["r2", "r3"]);
  assert.deepEqual(plan.folders.map((f) => f.id), ["f2"]);
  assert.deepEqual(plan.photoIds, ["p3"]); // p1 and p2 belonged to the skipped r1
  assert.equal(plan.skippedRoutes, 1);
  assert.equal(plan.skippedFolders, 1);
});

test("planMerge is idempotent: restoring the same backup again adds nothing", () => {
  const backup = parseBackup(backupText());
  const plan = planMerge(backup, ["r1", "r2", "r3"], ["f1", "f2"]);

  assert.equal(plan.routes.length, 0);
  assert.equal(plan.folders.length, 0);
  assert.deepEqual(plan.photoIds, []);
  assert.equal(plan.skippedRoutes, 3);
  assert.equal(plan.skippedFolders, 2);
});
