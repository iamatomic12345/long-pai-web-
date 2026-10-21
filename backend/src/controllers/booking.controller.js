const { pool } = require("../config/db");
const { BAHT_PER_POINT } = require("../config/rewards");

const MAX_PAX = 20;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const BOOKING_COLUMNS = `b.id, b.tour_id, t.name AS tour_name, t.province AS tour_province,
  b.pax, to_char(b.date, 'YYYY-MM-DD') AS date, b.contact_name, b.phone,
  b.total, b.points_earned, b.created_at`;

async function list(req, res) {
  const result = await pool.query(
    `SELECT ${BOOKING_COLUMNS}
     FROM bookings b
     JOIN tours t ON t.id = b.tour_id
     WHERE b.user_id = $1
     ORDER BY b.created_at`,
    [req.user.id]
  );
  res.json({ bookings: result.rows });
}

async function create(req, res) {
  const { tourId, pax, date, contactName, phone } = req.body || {};

  const paxCount = Number(pax);
  if (!Number.isInteger(paxCount) || paxCount < 1 || paxCount > MAX_PAX) {
    return res.status(400).json({ error: `จำนวนผู้เดินทางต้องอยู่ระหว่าง 1-${MAX_PAX} คน` });
  }
  // round-trip check rejects impossible dates like 2026-02-31, which Date() silently rolls over
  const parsed = typeof date === "string" && DATE_RE.test(date) ? new Date(`${date}T00:00:00Z`) : null;
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    return res.status(400).json({ error: "วันที่เดินทางไม่ถูกต้อง" });
  }
  if (!contactName || !String(contactName).trim()) return res.status(400).json({ error: "กรุณากรอกชื่อผู้จอง" });
  if (!phone || !String(phone).trim()) return res.status(400).json({ error: "กรุณากรอกเบอร์โทรศัพท์" });

  const tour = await pool.query("SELECT id, price FROM tours WHERE id = $1", [String(tourId || "")]);
  if (!tour.rows.length) return res.status(404).json({ error: "Tour not found" });

  // priced server-side — the client's total/earn are display-only
  const total = tour.rows[0].price * paxCount;
  const pointsEarned = Math.round(total / BAHT_PER_POINT);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const inserted = await client.query(
      `INSERT INTO bookings (user_id, tour_id, pax, date, contact_name, phone, total, points_earned)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [req.user.id, tour.rows[0].id, paxCount, date, String(contactName).trim(), String(phone).trim(), total, pointsEarned]
    );

    const updated = await client.query(
      "UPDATE users SET points = points + $1 WHERE id = $2 RETURNING points",
      [pointsEarned, req.user.id]
    );

    const booking = await client.query(
      `SELECT ${BOOKING_COLUMNS} FROM bookings b JOIN tours t ON t.id = b.tour_id WHERE b.id = $1`,
      [inserted.rows[0].id]
    );

    await client.query("COMMIT");
    res.status(201).json({ booking: booking.rows[0], points: updated.rows[0].points });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { list, create };
