const crypto = require("crypto");
const { pool } = require("../config/db");
const { REWARD_TIERS } = require("../config/rewards");

const CODE_ATTEMPTS = 5;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// same LP-<tag>-<random> shape the frontend used to generate locally
function generateCode(tier) {
  const tag = tier.kind === "pct" ? `${tier.value}OFF` : `B${tier.value}`;
  const bytes = crypto.randomBytes(6);
  const suffix = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
  return `LP-${tag}-${suffix}`;
}

function toPublicCoupon(row) {
  const tier = REWARD_TIERS.find((t) => t.id === row.tier_id);
  return {
    id: row.id,
    code: row.code,
    tier_id: row.tier_id,
    label: tier ? tier.label : row.code,
    kind: row.kind,
    value: row.value,
    cost: row.cost,
    used: row.used,
    created_at: row.created_at,
  };
}

async function list(req, res) {
  const result = await pool.query(
    `SELECT id, code, tier_id, kind, value, cost, used, created_at
     FROM coupons WHERE user_id = $1 ORDER BY created_at`,
    [req.user.id]
  );
  res.json({ coupons: result.rows.map(toPublicCoupon) });
}

async function redeem(req, res) {
  const tier = REWARD_TIERS.find((t) => t.id === req.body?.tierId);
  if (!tier) return res.status(400).json({ error: "ไม่พบรางวัลนี้" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // conditional decrement: only succeeds if the balance covers the cost, so
    // two concurrent redeems can't both spend the same points
    const updated = await client.query(
      "UPDATE users SET points = points - $1 WHERE id = $2 AND points >= $1 RETURNING points",
      [tier.cost, req.user.id]
    );
    if (!updated.rows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "แต้มไม่พอสำหรับรางวัลนี้" });
    }

    let coupon = null;
    for (let attempt = 0; attempt < CODE_ATTEMPTS && !coupon; attempt++) {
      const inserted = await client.query(
        `INSERT INTO coupons (user_id, code, tier_id, kind, value, cost)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (code) DO NOTHING
         RETURNING id, code, tier_id, kind, value, cost, used, created_at`,
        [req.user.id, generateCode(tier), tier.id, tier.kind, tier.value, tier.cost]
      );
      coupon = inserted.rows[0] || null;
    }
    if (!coupon) throw new Error("Could not generate a unique coupon code");

    await client.query("COMMIT");
    res.status(201).json({ coupon: toPublicCoupon(coupon), points: updated.rows[0].points });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { list, redeem };
