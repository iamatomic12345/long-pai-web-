const test = require("node:test");
const assert = require("node:assert/strict");

process.env.SESSION_SECRET = "test-only";
const app = require("../src/app");

let server, base;
test.before(() => new Promise((resolve) => {
  server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); });
}));
test.after(() => server.close());

for (const [path, title] of [["/terms", "Terms of Use"], ["/privacy", "Privacy Policy"], ["/data-deletion", "Data Deletion"]]) {
  test(`${path} is served as an HTML page`, async () => {
    const res = await fetch(base + path);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /text\/html/);
    assert.match(await res.text(), new RegExp(`<title>[^<]*${title}`));
  });
}

test("the terms cover the required points in both languages", async () => {
  const html = await (await fetch(base + "/terms")).text();
  for (const s of ["ยังไม่ใช่การจองจริง", "ละเมิดลิขสิทธิ์", "ลบ Story", "อยู่ในจังหวัดนั้นจริง", "ยกเลิกไม่ได้",
    "not a real booking", "infringe copyright", "delete any Story", "really in that province", "cannot be undone",
    "thitiwut560072@gmail.com"]) {
    assert.ok(html.includes(s), s);
  }
});

test("an unknown page gets the HTML 404 page with a link home", async () => {
  const res = await fetch(base + "/no-such-page", { headers: { Accept: "text/html" } });
  assert.equal(res.status, 404);
  assert.match(res.headers.get("content-type"), /text\/html/);
  const html = await res.text();
  assert.match(html, /ไม่พบหน้านี้/);
  assert.match(html, /<a class="btn btn-primary" href="\/">/);
});

test("unknown /api paths still answer JSON, even for a browser", async () => {
  for (const p of ["/api/nope", "/api/stories/1/nope"]) {
    const res = await fetch(base + p, { headers: { Accept: "text/html" } });
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: "Not found" });
  }
});

test("a non-browser client gets JSON for an unknown page", async () => {
  const res = await fetch(base + "/no-such-page", { headers: { Accept: "application/json" } });
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: "Not found" });
});
