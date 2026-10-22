const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const zlib = require("zlib");

const { storyImage } = require("../src/middleware/storyUpload");
const { storyFields } = require("../src/controllers/story.controller");

// the upload middleware alone, on a throwaway app: reports what it accepted
const app = express();
app.post("/upload", storyImage, (req, res) => res.json({ type: req.file?.imageType, ext: req.file?.imageExt }));

let server, base;
test.before(() => new Promise((resolve) => {
  server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); });
}));
test.after(() => server.close());

// a real 1×1 PNG
function tinyPng() {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(Buffer.from([0, 255, 0, 0]))), chunk("IEND", Buffer.alloc(0)),
  ]);
}
const JPEG_HEAD = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([4, 0, 0, 0]), Buffer.from("WEBPVP8 ")]);

function upload(bytes, filename, type, fields = {}) {
  const form = new FormData();
  form.append("image", new Blob([bytes], { type }), filename);
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return fetch(`${base}/upload`, { method: "POST", body: form }).then(async (r) => ({ status: r.status, data: await r.json() }));
}

test("real png, jpeg and webp are accepted", async () => {
  assert.deepEqual((await upload(tinyPng(), "a.png", "image/png")).data, { type: "image/png", ext: ".png" });
  assert.equal((await upload(JPEG_HEAD, "a.jpg", "image/jpeg")).status, 200);
  assert.equal((await upload(WEBP, "a.webp", "image/webp")).status, 200);
});

test("an HTML file renamed to .jpg is refused by its content", async () => {
  const res = await upload(Buffer.from("<script>alert(1)</script>"), "evil.jpg", "image/jpeg");
  assert.equal(res.status, 400);
  assert.equal(res.data.error, "รองรับเฉพาะไฟล์ jpg, png หรือ webp");
});

test("a png declared as jpeg is refused (declared type and bytes must agree)", async () => {
  assert.equal((await upload(tinyPng(), "a.jpg", "image/jpeg")).status, 400);
});

test("gif and svg are refused", async () => {
  assert.equal((await upload(Buffer.from("GIF89a"), "a.gif", "image/gif")).status, 400);
  assert.equal((await upload(Buffer.from("<svg onload=alert(1)>"), "a.svg", "image/svg+xml")).status, 400);
});

test("over 5 MB is refused", async () => {
  const big = Buffer.concat([tinyPng(), Buffer.alloc(5 * 1024 * 1024)]);
  const res = await upload(big, "big.png", "image/png");
  assert.equal(res.status, 400);
  assert.equal(res.data.error, "ไฟล์รูปต้องมีขนาดไม่เกิน 5MB");
});

test("an oversized text field is refused", async () => {
  const res = await upload(tinyPng(), "a.png", "image/png", { caption: "ก".repeat(9000) });
  assert.equal(res.status, 400);
});

test("caption: trimmed, ≤500 characters, control characters dropped, HTML kept as plain text", () => {
  assert.deepEqual(storyFields({ caption: "  สวยมาก  " }), { caption: "สวยมาก", emoji: null });
  assert.equal(storyFields({ caption: "ก".repeat(500) }).error, undefined);
  assert.match(storyFields({ caption: "ก".repeat(501) }).error, /ไม่เกิน 500/);
  assert.equal(storyFields({ caption: "a\u0000b\u0007c\nd" }).caption, "abc\nd");
  // stored verbatim; React escapes it on display
  assert.equal(storyFields({ caption: "<img src=x onerror=alert(1)>" }).caption, "<img src=x onerror=alert(1)>");
});

test("caption/emoji of the wrong type or length are refused", () => {
  assert.ok(storyFields({ caption: ["a", "b"] }).error);
  assert.ok(storyFields({ emoji: "🏝️".repeat(10) }).error);
  assert.equal(storyFields({ emoji: "🏝️" }).emoji, "🏝️");
});
