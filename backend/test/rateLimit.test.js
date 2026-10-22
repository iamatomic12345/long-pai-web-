const test = require("node:test");
const assert = require("node:assert/strict");

// no real database: every query finds nothing, so a login attempt is a plain 401
const dbPath = require.resolve("../src/config/db");
require.cache[dbPath] = {
  id: dbPath, filename: dbPath, loaded: true,
  exports: { pool: { query: async () => ({ rows: [] }), connect: async () => ({ query: async () => ({ rows: [] }), release() {} }) } },
};
process.env.FRONTEND_URL = "https://longpai.example/index.html";
process.env.SESSION_SECRET = "test-only";
const app = require("../src/app");

let server, base;
test.before(() => new Promise((resolve) => {
  server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); });
}));
test.after(() => server.close());

const login = () => fetch(`${base}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "nobody@example.com", password: "wrong-password" }),
});

test("11th failed login within 15 minutes gets 429 with a Thai message", async () => {
  for (let i = 0; i < 10; i++) assert.equal((await login()).status, 401);
  const res = await login();
  assert.equal(res.status, 429);
  const { error } = await res.json();
  assert.match(error, /พยายามเข้าสู่ระบบหลายครั้งเกินไป กรุณารอประมาณ \d+ นาทีแล้วลองใหม่/);
});

test("too many Google sign-in starts redirect back to the app with #oauth_error", async () => {
  for (let i = 0; i < 20; i++) await fetch(`${base}/api/auth/google`, { redirect: "manual" });
  const res = await fetch(`${base}/api/auth/google`, { redirect: "manual" });
  assert.equal(res.status, 302);
  const location = res.headers.get("location");
  assert.ok(location.startsWith("https://longpai.example/index.html#oauth_error="), location);
  assert.match(decodeURIComponent(location.split("#oauth_error=")[1]), /พยายามเข้าสู่ระบบหลายครั้งเกินไป/);
});

test("31st write within 15 minutes gets 429; reads are unaffected", async () => {
  const checkin = () => fetch(`${base}/api/provinces/1/visited`, { method: "POST" }); // 401 without a token, still counted
  for (let i = 0; i < 30; i++) assert.equal((await checkin()).status, 401);
  const res = await checkin();
  assert.equal(res.status, 429);
  assert.match((await res.json()).error, /ทำรายการถี่เกินไป/);
  assert.equal((await fetch(`${base}/api/provinces`)).status, 200);
});

test("/health is not rate limited", async () => {
  for (let i = 0; i < 5; i++) assert.notEqual((await fetch(`${base}/health`)).status, 429);
});
