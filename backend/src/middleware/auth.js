const { verifyToken } = require("../utils/jwt");
const { pool } = require("../config/db");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// after requireAuth: the role is read from the database on every request, never from
// the token, so demoting someone takes effect immediately
async function requireAdmin(req, res, next) {
  try {
    const me = await pool.query("SELECT role FROM users WHERE id = $1", [req.user.id]);
    if (me.rows[0]?.role !== "admin") return res.status(403).json({ error: "สำหรับผู้ดูแลระบบเท่านั้น" });
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAuth, requireAdmin };
