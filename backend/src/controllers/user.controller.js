const { pool } = require("../config/db");

// the signed-in user, including role — read fresh from the database each time
async function me(req, res) {
  const result = await pool.query(
    "SELECT id, name, email, points, role FROM users WHERE id = $1",
    [req.user.id]
  );
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user });
}

module.exports = { me };
