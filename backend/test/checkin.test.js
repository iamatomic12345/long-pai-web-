const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const { haversineDistanceKm, checkinError } = require("../src/utils/geo");

// Chiang Mai centroid, as seeded
const CHIANG_MAI = { id: 2, latitude: 18.7877477, longitude: 98.99313110000003 };

// the point `km` due north of `p` (along a meridian, so the great-circle distance is exact)
function northOf(p, km) {
  return { lat: p.latitude + (km / 6371) * (180 / Math.PI), lng: p.longitude };
}

test("haversine: kilometers, degrees in, lat/lng order", () => {
  // Bangkok (Democracy Monument) → Chiang Mai is ~585 km in a straight line
  const d = haversineDistanceKm(13.7567, 100.5018, CHIANG_MAI.latitude, CHIANG_MAI.longitude);
  assert.ok(d > 570 && d < 600, `got ${d}`);
  assert.ok(Math.abs(haversineDistanceKm(0, 0, 1, 0) - 111.19) < 0.1);
  assert.equal(haversineDistanceKm(18.5, 99, 18.5, 99), 0);
});

test("check-in 10 km from the province passes", () => {
  const at = northOf(CHIANG_MAI, 10);
  assert.ok(Math.abs(haversineDistanceKm(at.lat, at.lng, CHIANG_MAI.latitude, CHIANG_MAI.longitude) - 10) < 0.01);
  assert.equal(checkinError(at, CHIANG_MAI), null);
});

test("check-in 200 km from the province is refused", () => {
  assert.equal(checkinError(northOf(CHIANG_MAI, 200), CHIANG_MAI), "ตำแหน่งไม่ตรงกับจังหวัดนี้");
});

test("check-in at 49 km passes, 51 km is refused", () => {
  assert.equal(checkinError(northOf(CHIANG_MAI, 49), CHIANG_MAI), null);
  assert.notEqual(checkinError(northOf(CHIANG_MAI, 51), CHIANG_MAI), null);
});

test("missing or non-numeric coordinates are refused", () => {
  for (const body of [undefined, {}, { lat: 18.79 }, { lat: null, lng: null }, { lat: "", lng: "" },
    { lat: "18.79", lng: "98.99" }, { lat: [18.79], lng: [98.99] }, { lat: NaN, lng: 98.99 }, { lat: 91, lng: 98.99 }]) {
    assert.equal(checkinError(body, CHIANG_MAI), "กรุณาเปิดสิทธิ์ตำแหน่งเพื่อเช็คอิน", JSON.stringify(body));
  }
});

test("a province without coordinates refuses check-in instead of letting it through", () => {
  const at = northOf(CHIANG_MAI, 1);
  assert.notEqual(checkinError(at, { id: 2, latitude: null, longitude: null }), null);
});

// the endpoint itself, with the database stubbed out
function loadControllerWithFakeDb() {
  const inserts = [];
  const fakeClient = {
    async query(sql, params) {
      if (/INSERT INTO user_visited_provinces/.test(sql)) { inserts.push(params); return { rows: [{ province_id: params[1] }] }; }
      if (/UPDATE users/.test(sql)) return { rows: [{ points: 50 }] };
      return { rows: [] };
    },
    release() {},
  };
  const fakePool = {
    async query(sql, params) {
      if (/FROM provinces WHERE id/.test(sql)) return { rows: params[0] === CHIANG_MAI.id ? [CHIANG_MAI] : [] };
      return { rows: [] };
    },
    connect: async () => fakeClient,
  };
  const dbPath = require.resolve("../src/config/db");
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { pool: fakePool } };
  const ctrlPath = path.join(__dirname, "../src/controllers/province.controller.js");
  delete require.cache[require.resolve(ctrlPath)];
  return { controller: require(ctrlPath), inserts };
}

function call(handler, body) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(data) { resolve({ status: this.statusCode, data }); },
    };
    handler({ params: { id: String(CHIANG_MAI.id) }, body, user: { id: 1 } }, res).catch(reject);
  });
}

test("POST /api/provinces/:id/visited: 10 km is saved, 200 km and no GPS are refused", async () => {
  const { controller, inserts } = loadControllerWithFakeDb();

  const far = await call(controller.markVisited, northOf(CHIANG_MAI, 200));
  assert.equal(far.status, 400);
  const noGps = await call(controller.markVisited, {});
  assert.equal(noGps.status, 400);
  assert.equal(inserts.length, 0);

  const near = await call(controller.markVisited, northOf(CHIANG_MAI, 10));
  assert.equal(near.status, 201);
  assert.deepEqual(near.data, { visited: true, points: 50 });
  assert.equal(inserts.length, 1);
});
