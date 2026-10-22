const test = require("node:test");
const assert = require("node:assert/strict");
const { useTestDb } = require("./helpers/testDb");

process.env.JWT_SECRET = "test-only";
process.env.SESSION_SECRET = "test-only";
process.env.FRONTEND_URL = "https://longpai.example/index.html";

let server, base, pool, tokens = {}, storyId;

test.before(async () => {
  ({ pool } = await useTestDb());
  const { signToken } = require("../src/utils/jwt");
  for (const [name, role] of [["owner", "user"], ["a", "user"], ["b", "user"], ["c", "user"], ["d", "user"], ["admin", "admin"]]) {
    const { rows } = await pool.query(
      "INSERT INTO users (name, email, role) VALUES ($1, $2, $3) RETURNING id",
      [name, `${name}@example.com`, role]
    );
    tokens[name] = signToken({ sub: rows[0].id, email: `${name}@example.com` });
    if (name === "owner") {
      const s = await pool.query("INSERT INTO stories (user_id, caption, image_url) VALUES ($1, 'hello', 'https://x/y.jpg') RETURNING id", [rows[0].id]);
      storyId = s.rows[0].id;
    }
  }
  const app = require("../src/app");
  await new Promise((resolve) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); }); });
});
test.after(() => server && server.close());

const api = (path, { method = "GET", as, body } = {}) =>
  fetch(`${base}${path}`, {
    method,
    headers: { ...(as ? { Authorization: `Bearer ${tokens[as]}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => ({ status: r.status, data: await r.json() }));
const feedIds = async () => (await api("/api/stories")).data.stories.map((s) => s.id);

test("guests can't report; owners can't report their own story", async () => {
  assert.equal((await api(`/api/stories/${storyId}/report`, { method: "POST" })).status, 401);
  assert.equal((await api(`/api/stories/${storyId}/report`, { method: "POST", as: "owner" })).status, 400);
});

test("one report per user per story", async () => {
  const first = await api(`/api/stories/${storyId}/report`, { method: "POST", as: "a", body: { reason: "สแปม" } });
  assert.equal(first.status, 201);
  assert.deepEqual(first.data, { reported: true, hidden: false });
  const again = await api(`/api/stories/${storyId}/report`, { method: "POST", as: "a" });
  assert.equal(again.status, 409);
  assert.equal(again.data.error, "คุณรายงานสตอรี่นี้ไปแล้ว");
});

test("the 3rd report hides the story from the feed", async () => {
  assert.equal((await api(`/api/stories/${storyId}/report`, { method: "POST", as: "b" })).data.hidden, false);
  assert.ok((await feedIds()).includes(storyId));
  assert.equal((await api(`/api/stories/${storyId}/report`, { method: "POST", as: "c" })).data.hidden, true);
  assert.ok(!(await feedIds()).includes(storyId));
});

test("only admins see the reported list", async () => {
  assert.equal((await api("/api/stories/reported", { as: "a" })).status, 403);
  const { status, data } = await api("/api/stories/reported", { as: "admin" });
  assert.equal(status, 200);
  assert.equal(data.stories.length, 1);
  assert.equal(data.stories[0].id, storyId);
  assert.equal(data.stories[0].report_count, 3);
  assert.equal(data.stories[0].hidden, true);
  assert.deepEqual(data.stories[0].reasons, ["สแปม"]);
});

test("admin restore puts it back; old reports stop counting, new ones still do", async () => {
  assert.equal((await api(`/api/stories/${storyId}/restore`, { method: "POST", as: "a" })).status, 403);
  assert.equal((await api(`/api/stories/${storyId}/restore`, { method: "POST", as: "admin" })).status, 200);
  assert.ok((await feedIds()).includes(storyId));
  assert.equal((await api("/api/stories/reported", { as: "admin" })).data.stories.length, 0);
  // a, b, c already reported; d's new report is 1 open report, not 4
  assert.equal((await api(`/api/stories/${storyId}/report`, { method: "POST", as: "d" })).data.hidden, false);
  assert.equal((await api("/api/stories/reported", { as: "admin" })).data.stories[0].report_count, 1);
});

test("admin delete removes the story and its reports", async () => {
  assert.equal((await api(`/api/stories/${storyId}`, { method: "DELETE", as: "admin" })).status, 200);
  assert.equal((await api("/api/stories/reported", { as: "admin" })).data.stories.length, 0);
  const left = await pool.query("SELECT count(*)::int AS n FROM story_reports");
  assert.equal(left.rows[0].n, 0);
});
