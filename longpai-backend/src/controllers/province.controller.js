const { pool } = require("../config/db");
const { haversineDistanceKm } = require("../utils/geo");

const VISIT_POINTS = 50;
const MAX_CHECKIN_DISTANCE_KM = 50;

async function list(req, res) {
  const result = await pool.query(
    "SELECT id, name, region, spot, grid_col AS col, grid_row AS row, image_url FROM provinces ORDER BY id"
  );
  res.json({ provinces: result.rows });
}

async function listVisited(req, res) {
  const result = await pool.query(
    `SELECT p.id, p.name, p.region, p.spot, v.visited_at
     FROM user_visited_provinces v
     JOIN provinces p ON p.id = v.province_id
     WHERE v.user_id = $1
     ORDER BY v.visited_at DESC`,
    [req.user.id]
  );
  res.json({ visited: result.rows });
}

async function markVisited(req, res) {
  const provinceId = Number(req.params.id);
  if (!Number.isInteger(provinceId)) return res.status(400).json({ error: "Invalid province id" });

  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  const hasValidCoords =
    Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  if (!hasValidCoords) {
    return res.status(400).json({ error: "กรุณาเปิดสิทธิ์ตำแหน่งเพื่อเช็คอิน" });
  }

  const province = await pool.query(
    "SELECT id, latitude, longitude FROM provinces WHERE id = $1",
    [provinceId]
  );
  if (!province.rows.length) return res.status(404).json({ error: "Province not found" });

  const { latitude: provinceLat, longitude: provinceLng } = province.rows[0];
  // provinces are always seeded with coordinates; if a row is somehow missing
  // them, don't block check-in on a data gap that isn't the user's fault
  if (provinceLat !== null && provinceLng !== null) {
    const distanceKm = haversineDistanceKm(lat, lng, provinceLat, provinceLng);
    if (distanceKm > MAX_CHECKIN_DISTANCE_KM) {
      return res.status(400).json({ error: "ตำแหน่งไม่ตรงกับจังหวัดนี้" });
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const inserted = await client.query(
      `INSERT INTO user_visited_provinces (user_id, province_id, latitude, longitude) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, province_id) DO NOTHING
       RETURNING province_id`,
      [req.user.id, provinceId, lat, lng]
    );

    let points;
    if (inserted.rows.length) {
      const updated = await client.query(
        "UPDATE users SET points = points + $1 WHERE id = $2 RETURNING points",
        [VISIT_POINTS, req.user.id]
      );
      points = updated.rows[0].points;
    } else {
      const current = await client.query("SELECT points FROM users WHERE id = $1", [req.user.id]);
      points = current.rows[0].points;
    }

    await client.query("COMMIT");
    res.status(inserted.rows.length ? 201 : 200).json({ visited: true, points });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function unmarkVisited(req, res) {
  const provinceId = Number(req.params.id);
  if (!Number.isInteger(provinceId)) return res.status(400).json({ error: "Invalid province id" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const deleted = await client.query(
      "DELETE FROM user_visited_provinces WHERE user_id = $1 AND province_id = $2 RETURNING province_id",
      [req.user.id, provinceId]
    );

    let points;
    if (deleted.rows.length) {
      const updated = await client.query(
        "UPDATE users SET points = GREATEST(0, points - $1) WHERE id = $2 RETURNING points",
        [VISIT_POINTS, req.user.id]
      );
      points = updated.rows[0].points;
    } else {
      const current = await client.query("SELECT points FROM users WHERE id = $1", [req.user.id]);
      points = current.rows[0].points;
    }

    await client.query("COMMIT");
    res.json({ visited: false, points });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { list, listVisited, markVisited, unmarkVisited };
