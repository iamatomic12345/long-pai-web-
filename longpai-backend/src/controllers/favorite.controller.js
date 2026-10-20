const { pool } = require("../config/db");

async function list(req, res) {
  const result = await pool.query(
    "SELECT tour_id FROM favorites WHERE user_id = $1 ORDER BY created_at",
    [req.user.id]
  );
  res.json({ favorites: result.rows.map((r) => r.tour_id) });
}

async function add(req, res) {
  const { tourId } = req.params;
  const tour = await pool.query("SELECT id FROM tours WHERE id = $1", [tourId]);
  if (!tour.rows.length) return res.status(404).json({ error: "Tour not found" });

  await pool.query(
    "INSERT INTO favorites (user_id, tour_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [req.user.id, tourId]
  );
  res.json({ tourId, favorite: true });
}

async function remove(req, res) {
  await pool.query("DELETE FROM favorites WHERE user_id = $1 AND tour_id = $2", [req.user.id, req.params.tourId]);
  res.json({ tourId: req.params.tourId, favorite: false });
}

module.exports = { list, add, remove };
