const test = require("node:test");
const assert = require("node:assert/strict");

// database stub: users lookups find nothing; "boom" in a query simulates a DB failure
const dbPath = require.resolve("../src/config/db");
require.cache[dbPath] = {
  id: dbPath, filename: dbPath, loaded: true,
  exports: { pool: { query: async (sql) => {
    if (/FROM provinces/.test(sql)) throw new Error('relation "provinces" does not exist');
    return { rows: [] };
  } } },
};
process.env.SESSION_SECRET = "test-only";
const app = require("../src/app");

let server, base;
test.before(() => new Promise((resolve) => {
  server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); });
}));
test.after(() => server.close());

const post = (path, raw) => fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: raw })
  .then(async (r) => ({ status: r.status, data: await r.json() }));

test("a 500 never shows the internal error message", async () => {
  const res = await fetch(`${base}/api/provinces`);
  assert.equal(res.status, 500);
  const { error } = await res.json();
  assert.equal(error, "เกิดข้อผิดพลาดในระบบ ลองใหม่อีกครั้ง");
  assert.doesNotMatch(error, /relation|provinces/);
});

test("login/register with non-string fields → 400, not 500", async () => {
  for (const body of [{ email: 123, password: "x" }, { email: "a@b.co", password: { x: 1 } }, { email: ["a@b.co"], password: "xxxxxx" }]) {
    assert.equal((await post("/api/auth/login", JSON.stringify(body))).status, 400, JSON.stringify(body));
  }
  const reg = await post("/api/auth/register", JSON.stringify({ name: "a", email: "a@b.co", password: 123456 }));
  assert.equal(reg.status, 400);
});

test("malformed JSON gets a plain Thai 400", async () => {
  const bad = await post("/api/auth/login", "{not json");
  assert.deepEqual(bad, { status: 400, data: { error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" } });
});

test("JSON bodies over 100 KB are refused with 413", async () => {
  const big = await post("/api/auth/login", JSON.stringify({ email: "a@b.co", password: "x".repeat(200 * 1024) }));
  assert.deepEqual(big, { status: 413, data: { error: "ข้อมูลที่ส่งมามีขนาดใหญ่เกินไป" } });
});
