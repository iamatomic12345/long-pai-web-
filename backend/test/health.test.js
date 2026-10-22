const test = require("node:test");
const assert = require("node:assert/strict");

// a database stub whose behaviour each test switches
let dbMode = "up";
const dbPath = require.resolve("../src/config/db");
require.cache[dbPath] = {
  id: dbPath, filename: dbPath, loaded: true,
  exports: {
    pool: {
      query: (sql) => {
        assert.equal(sql, "SELECT 1");
        if (dbMode === "up") return Promise.resolve({ rows: [{ "?column?": 1 }] });
        if (dbMode === "down") return Promise.reject(new Error("connect ECONNREFUSED"));
        return new Promise(() => {}); // "hang": never answers
      },
    },
  },
};
process.env.SESSION_SECRET = "test-only";
const app = require("../src/app");

let server, base;
test.before(() => new Promise((resolve) => {
  server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); });
}));
test.after(() => server.close());

const health = () => fetch(`${base}/health`).then(async (r) => ({ status: r.status, data: await r.json() }));

test("200 when the database answers SELECT 1", async () => {
  dbMode = "up";
  assert.deepEqual(await health(), { status: 200, data: { ok: true, db: "ok" } });
});

test("503 when the database refuses the connection", async () => {
  dbMode = "down";
  assert.deepEqual(await health(), { status: 503, data: { ok: false, db: "unreachable" } });
});

test("503 within ~5 s when the database hangs", async () => {
  dbMode = "hang";
  const started = Date.now();
  const res = await health();
  assert.equal(res.status, 503);
  assert.ok(Date.now() - started < 7000);
});
