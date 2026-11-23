const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, dependencies = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    exports, Date, Math, console,
    require: (name) => {
      if (name in dependencies) return dependencies[name];
      throw Error(name);
    },
  });
  return exports;
}
const rules = load("src/lib/service-arrival.ts", { zod: require("zod") });
const now = new Date("2026-11-22T21:10:00Z");
const service = { id: "service", startsAt: new Date("2026-11-22T21:00:00Z"), endsAt: null };
const point = { latitude: -19.8984834, longitude: -44.075543, accuracy: 15, observedAt: now, action: "ENTER" };

function setup() {
  let consent = true;
  let revokedDuringWrite = false;
  let events = [service];
  const rows = new Map();
  const db = {
    arrivalConsent: { findUnique: async () => ({ enabled: consent }) },
    appSetting: { findUnique: async () => null },
    event: { findMany: async () => events },
    servicePresence: {
      findUnique: async ({ where }) => rows.get(JSON.stringify(where)) ?? null,
      upsert: async ({ where, create, update }) => {
        const key = JSON.stringify(where);
        const row = rows.get(key);
        if (row) Object.assign(row, update);
        else rows.set(key, { leftAt: null, ...create });
      },
      update: async ({ where, data }) => Object.assign(rows.get(JSON.stringify(where)), data),
    },
    $transaction: async (operation) => operation({
      ...db,
      arrivalConsent: { findUnique: async () => ({ enabled: consent && !revokedDuringWrite }) },
    }),
  };
  const api = load("src/server/service-arrival.ts", {
    "@/server/db": { prisma: db },
    "@/lib/service-arrival": rules,
    "@/server/weekly-services": { ensureWeeklyServices: async () => {} },
  });
  return {
    api, rows,
    set consent(value) { consent = value; },
    set revokedDuringWrite(value) { revokedDuringWrite = value; },
    set events(value) { events = value; },
  };
}

test("Arrival distance, coordinate validation and forty-minute threshold respect boundaries", () => {
  assert.equal(rules.distanceMeters(point, point), 0);
  assert.ok(rules.distanceMeters(point, { latitude: point.latitude + 0.002, longitude: point.longitude }) > 200);
  assert.equal(rules.arrivalObservationSchema.safeParse({ ...point, accuracy: 150 }).success, false);
  assert.equal(rules.arrivalObservationSchema.safeParse({ ...point, latitude: 100 }).success, false);
  assert.equal(rules.volunteerArrivalStatus(null, service.startsAt, new Date("2026-11-22T21:39:59Z")), "WAITING");
  assert.equal(rules.volunteerArrivalStatus(null, service.startsAt, new Date("2026-11-22T21:40:00Z")), "ABSENT");
  assert.equal(rules.volunteerArrivalStatus(now, service.startsAt, new Date("2026-11-22T23:00:00Z")), "ARRIVED");
});

test("Repeated observations count one person per service and preserve the first arrival", async () => {
  const state = setup();
  assert.equal((await state.api.recordGeoArrival("m1", point, now)).ok, true);
  const later = new Date(now.getTime() + 120000);
  await state.api.recordGeoArrival("m1", { ...point, action: "PING", observedAt: later }, later);
  assert.equal(state.rows.size, 1);
  const row = [...state.rows.values()][0];
  assert.equal(row.arrivedAt, now);
  assert.equal(row.lastSeenAt, later);
  assert.equal("latitude" in row, false);
  assert.equal("longitude" in row, false);
  await state.api.recordGeoArrival("m2", point, now);
  assert.equal(state.rows.size, 2);
});

test("Opt-out, revoked consent, stale GPS, outside location and closed service windows reject arrivals", async () => {
  const state = setup();
  state.consent = false;
  assert.equal((await state.api.recordGeoArrival("m1", point, now)).code, "CONSENT_REQUIRED");
  state.consent = true;
  assert.equal((await state.api.recordGeoArrival("m1", { ...point, latitude: point.latitude + 0.01 }, now)).code, "OUTSIDE");
  assert.equal((await state.api.recordGeoArrival("m1", { ...point, observedAt: new Date(now.getTime() - 16 * 60000) }, now)).code, "STALE_LOCATION");
  state.revokedDuringWrite = true;
  assert.equal((await state.api.recordGeoArrival("m1", point, now)).code, "CONSENT_REQUIRED");
  state.revokedDuringWrite = false;
  state.events = [{ ...service, startsAt: new Date(now.getTime() + 2 * 3600000) }];
  assert.equal((await state.api.recordGeoArrival("m1", point, now)).count, 0);
  assert.equal(state.rows.size, 0);
});

test("Exit and re-entry do not duplicate attendance, and stale pings do not undo a newer exit", async () => {
  const state = setup();
  await state.api.recordGeoArrival("m1", point, now);
  const left = new Date(now.getTime() + 120000);
  await state.api.recordGeoArrival("m1", { ...point, latitude: point.latitude + 0.01, action: "EXIT", observedAt: left }, left);
  const row = [...state.rows.values()][0];
  assert.equal(row.leftAt, left);
  await state.api.recordGeoArrival("m1", { ...point, action: "PING" }, left);
  assert.equal(row.leftAt, left);
  const back = new Date(left.getTime() + 120000);
  await state.api.recordGeoArrival("m1", { ...point, observedAt: back }, back);
  assert.equal(row.leftAt, null);
  assert.equal(row.arrivedAt, now);
  assert.equal(state.rows.size, 1);
});

test("Mobile registers headless tasks, sends nothing before device opt-in and stops on withdrawal", async () => {
  const values = new Map();
  const tasks = new Map();
  let consent = false;
  let geofenceStarted = false;
  let locationStarted = false;
  let observations = 0;
  const status = () => ({
    memberId: "m1", consent, config: rules.defaultArrivalConfig,
    services: [{ id: "service", from: new Date(Date.now() - 60000).toISOString(), to: new Date(Date.now() + 3600000).toISOString() }],
  });
  const location = () => ({ timestamp: Date.now(), coords: { ...point, accuracy: 15 } });
  const mobile = load("apps/mobile/src/services/arrival.ts", {
    "@react-native-async-storage/async-storage": { default: {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => { values.set(key, value); },
      multiRemove: async (keys) => keys.forEach((key) => values.delete(key)),
    } },
    "react-native": { Platform: { OS: "android" } },
    "expo-task-manager": { defineTask: (name, callback) => tasks.set(name, callback) },
    "expo-location": {
      Accuracy: { High: 4 },
      GeofencingEventType: { Enter: 1, Exit: 2 },
      getBackgroundPermissionsAsync: async () => ({ granted: true }),
      requestBackgroundPermissionsAsync: async () => ({ granted: true }),
      requestForegroundPermissionsAsync: async () => ({ granted: true }),
      getLastKnownPositionAsync: async () => location(),
      getCurrentPositionAsync: async () => location(),
      hasStartedGeofencingAsync: async () => geofenceStarted,
      hasStartedLocationUpdatesAsync: async () => locationStarted,
      startGeofencingAsync: async () => { geofenceStarted = true; },
      stopGeofencingAsync: async () => { geofenceStarted = false; },
      startLocationUpdatesAsync: async () => { locationStarted = true; },
      stopLocationUpdatesAsync: async () => { locationStarted = false; },
    },
    "@/services/api/client": {
      ApiError: class extends Error {},
      api: {
        get: async () => status(),
        post: async (path, data) => {
          if (path.endsWith("/consent")) consent = data.enabled;
          else observations += 1;
          return { ok: true, count: 1, message: "Chegada registrada" };
        },
      },
    },
  });
  assert.equal(tasks.size, 2);
  await mobile.syncArrivalMonitoring();
  assert.equal(observations, 0);
  assert.equal(geofenceStarted, false);
  await mobile.enableArrivalHere();
  await mobile.requestBackgroundArrival();
  assert.equal(geofenceStarted, true);
  assert.equal(locationStarted, true);
  assert.equal(observations, 1);
  await tasks.get("viva-church-arrival-geofence")({ data: { eventType: 1 }, error: null });
  assert.equal(observations, 2);
  await mobile.disableArrivalHere();
  assert.equal(consent, false);
  assert.equal(geofenceStarted, false);
  assert.equal(locationStarted, false);
  await tasks.get("viva-church-arrival-geofence")({ data: { eventType: 1 }, error: null });
  assert.equal(observations, 2);
});
