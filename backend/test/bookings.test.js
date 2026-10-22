const test = require("node:test");
const assert = require("node:assert/strict");
const { useTestDb } = require("./helpers/testDb");

process.env.JWT_SECRET = "test-only";
process.env.SESSION_SECRET = "test-only";

let server, base, pool, token;

test.before(async () => {
  ({ pool } = await useTestDb());
  await pool.query("INSERT INTO tours (id, name, province, region, price) VALUES ('t1', 'Trip', 'น่าน', 'north', 1000)");
  const { rows } = await pool.query("INSERT INTO users (name, email) VALUES ('u', 'u@example.com') RETURNING id");
  token = require("../src/utils/jwt").signToken({ sub: rows[0].id, email: "u@example.com" });
  const app = require("../src/app");
  await new Promise((resolve) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); }); });
});
test.after(() => server && server.close());

const book = (body) => fetch(`${base}/api/bookings`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
}).then(async (r) => ({ status: r.status, data: await r.json() }));

test("a demo booking needs no phone, and none is stored even if sent", async () => {
  const res = await book({ tourId: "t1", pax: 2, date: "2026-12-01", contactName: "สมชาย", phone: "0812345678" });
  assert.equal(res.status, 201);
  assert.equal(res.data.booking.total, 2000);
  assert.equal("phone" in res.data.booking, false);
  const stored = await pool.query("SELECT phone FROM bookings");
  assert.deepEqual(stored.rows, [{ phone: null }]);
});

test("contact name is still required and length-limited", async () => {
  assert.equal((await book({ tourId: "t1", pax: 1, date: "2026-12-01" })).status, 400);
  assert.equal((await book({ tourId: "t1", pax: 1, date: "2026-12-01", contactName: "ก".repeat(101) })).status, 400);
});
