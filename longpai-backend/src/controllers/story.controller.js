const { pool } = require("../config/db");

const STORY_POINTS = 20;
const MAX_LIMIT = 50;

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
    `SELECT s.id, s.caption, s.emoji, s.image_data, s.created_at,
            u.id AS author_id, u.name AS author_name,
            p.name AS province, p.region
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

async function create(req, res) {
  const { provinceId, caption, emoji, image } = req.body || {};

  if (!image) return res.status(400).json({ error: "กรุณาแนบรูปภาพ" });

  let resolvedProvinceId = null;
  if (provinceId !== undefined && provinceId !== null) {
    const id = Number(provinceId);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid province id" });
    const province = await pool.query("SELECT id FROM provinces WHERE id = $1", [id]);
    if (!province.rows.length) return res.status(404).json({ error: "Province not found" });
    resolvedProvinceId = id;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const inserted = await client.query(
      `INSERT INTO stories (user_id, province_id, caption, emoji, image_data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, caption, emoji, image_data, created_at`,
      [req.user.id, resolvedProvinceId, (caption || "").trim(), emoji || null, image]
    );

    const updated = await client.query(
      "UPDATE users SET points = points + $1 WHERE id = $2 RETURNING id, name, points",
      [STORY_POINTS, req.user.id]
    );

    await client.query("COMMIT");

    const story = inserted.rows[0];
    const author = updated.rows[0];
    res.status(201).json({
      story: { ...story, author_id: author.id, author_name: author.name },
      points: author.points,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function remove(req, res) {
  const storyId = Number(req.params.id);
  if (!Number.isInteger(storyId)) return res.status(400).json({ error: "Invalid story id" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query("SELECT user_id FROM stories WHERE id = $1 FOR UPDATE", [storyId]);
    if (!existing.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Story not found" });
    }
    if (existing.rows[0].user_id !== req.user.id) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "คุณลบได้เฉพาะสตอรี่ของตัวเอง" });
    }

    await client.query("DELETE FROM stories WHERE id = $1", [storyId]);

    const updated = await client.query(
      "UPDATE users SET points = GREATEST(0, points - $1) WHERE id = $2 RETURNING points",
      [STORY_POINTS, req.user.id]
    );

    await client.query("COMMIT");
    res.json({ deleted: true, points: updated.rows[0].points });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { list, create, remove };
