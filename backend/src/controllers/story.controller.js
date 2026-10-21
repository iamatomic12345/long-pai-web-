const { pool } = require("../config/db");
const { saveStoryImage, removeStoryImage } = require("../services/storyStorage");

const STORY_POINTS = 20;
const MAX_LIMIT = 50;
const MAX_CAPTION = 500;

// image_url is the uploaded photo (Supabase Storage URL, or /uploads/... in local dev);
// image_data only exists on stories posted before uploads
const STORY_COLUMNS = `s.id, s.caption, s.emoji, s.image_url, s.image_data, s.created_at,
  u.id AS author_id, u.name AS author_name,
  p.id AS province_id, p.name AS province, p.region`;

async function list(req, res) {
  const limit = Math.min(MAX_LIMIT, Number(req.query.limit) || 20);
  const before = req.query.before ? new Date(req.query.before) : null;

  const params = [limit];
  let where = "";
  if (before && !Number.isNaN(before.getTime())) {
    params.push(before.toISOString());
    where = "WHERE s.created_at < $2";
  }

  const result = await pool.query(
    `SELECT ${STORY_COLUMNS}
     FROM stories s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN provinces p ON p.id = s.province_id
     ${where}
     ORDER BY s.created_at DESC
     LIMIT $1`,
    params
  );

  res.json({ stories: result.rows });
}

// multipart/form-data: image (file, via storyImage middleware), caption?, provinceId?
async function create(req, res) {
  if (!req.file) return res.status(400).json({ error: "กรุณาแนบรูปภาพ" });

  const { provinceId, caption, emoji } = req.body || {};
  const text = (caption || "").trim();
  if (text.length > MAX_CAPTION) return res.status(400).json({ error: `แคปชั่นยาวได้ไม่เกิน ${MAX_CAPTION} ตัวอักษร` });

  let resolvedProvinceId = null;
  if (provinceId !== undefined && provinceId !== null && provinceId !== "") {
    const id = Number(provinceId);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid province id" });
    const province = await pool.query("SELECT id FROM provinces WHERE id = $1", [id]);
    if (!province.rows.length) return res.status(404).json({ error: "Province not found" });
    resolvedProvinceId = id;
  }

  // store the photo only once the request is known to be valid
  let imageUrl;
  try {
    imageUrl = await saveStoryImage(req.file.buffer, { ext: req.file.imageExt, contentType: req.file.imageType });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: "อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const inserted = await client.query(
      `INSERT INTO stories (user_id, province_id, caption, emoji, image_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [req.user.id, resolvedProvinceId, text, emoji || null, imageUrl]
    );

    const updated = await client.query(
      "UPDATE users SET points = points + $1 WHERE id = $2 RETURNING points",
      [STORY_POINTS, req.user.id]
    );

    const story = await client.query(
      `SELECT ${STORY_COLUMNS}
       FROM stories s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN provinces p ON p.id = s.province_id
       WHERE s.id = $1`,
      [inserted.rows[0].id]
    );

    await client.query("COMMIT");
    res.status(201).json({ story: story.rows[0], points: updated.rows[0].points });
  } catch (err) {
    await client.query("ROLLBACK");
    await removeStoryImage(imageUrl); // don't leave an orphaned photo behind
    throw err;
  } finally {
    client.release();
  }
}

// the owner, or an admin, may delete a story. The role is read from the
// database on every request — never from the token or anything the client sends
async function remove(req, res) {
  const storyId = Number(req.params.id);
  if (!Number.isInteger(storyId)) return res.status(400).json({ error: "Invalid story id" });

  const client = await pool.connect();
  let deletedImage = null;
  try {
    await client.query("BEGIN");

    const existing = await client.query("SELECT user_id, image_url FROM stories WHERE id = $1 FOR UPDATE", [storyId]);
    if (!existing.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Story not found" });
    }
    const story = existing.rows[0];

    const me = await client.query("SELECT role FROM users WHERE id = $1", [req.user.id]);
    const isOwner = story.user_id === req.user.id;
    const isAdmin = me.rows[0]?.role === "admin";
    if (!isOwner && !isAdmin) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "คุณไม่มีสิทธิ์ลบสตอรี่นี้" });
    }

    await client.query("DELETE FROM stories WHERE id = $1", [storyId]);

    // the points came from posting, so they come back off the poster — not the admin
    await client.query(
      "UPDATE users SET points = GREATEST(0, points - $1) WHERE id = $2",
      [STORY_POINTS, story.user_id]
    );
    const caller = await client.query("SELECT points FROM users WHERE id = $1", [req.user.id]);

    await client.query("COMMIT");
    deletedImage = story.image_url;
    res.json({ deleted: true, byAdmin: !isOwner, points: caller.rows[0]?.points ?? 0 });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  // only once the row is gone for good (Supabase Storage or local disk; a missing photo is fine)
  if (deletedImage) await removeStoryImage(deletedImage);
}

module.exports = { list, create, remove };
