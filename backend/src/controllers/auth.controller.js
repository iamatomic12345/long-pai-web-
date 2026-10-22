const bcrypt = require("bcryptjs");
const { pool } = require("../config/db");
const { signToken } = require("../utils/jwt");
const { passport } = require("../config/passport");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toPublicUser(row) {
  return { id: row.id, name: row.name, email: row.email, points: row.points };
}

async function register(req, res) {
  const { name, email, password } = req.body || {};

  if (typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "กรุณากรอกชื่อ" });
  // the display name shows on stories; users.name is VARCHAR(100)
  if (name.trim().length > 100) return res.status(400).json({ error: "ชื่อยาวได้ไม่เกิน 100 ตัวอักษร" });
  if (typeof email !== "string" || email.length > 255 || !EMAIL_RE.test(email)) return res.status(400).json({ error: "อีเมลไม่ถูกต้อง" });
  if (typeof password !== "string" || password.length < 6) return res.status(400).json({ error: "รหัสผ่านอย่างน้อย 6 ตัว" });

  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email.trim().toLowerCase()]);
  if (existing.rows.length) return res.status(409).json({ error: "อีเมลนี้ถูกใช้งานแล้ว" });

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
     RETURNING id, name, email, points`,
    [name.trim(), email.trim().toLowerCase(), passwordHash]
  );

  const user = result.rows[0];
  const token = signToken({ sub: user.id, email: user.email });
  res.status(201).json({ token, user: toPublicUser(user) });
}

async function login(req, res) {
  const { email, password } = req.body || {};

  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
    return res.status(400).json({ error: "กรุณากรอกอีเมลและรหัสผ่าน" });
  }

  const result = await pool.query(
    "SELECT id, name, email, password_hash, points FROM users WHERE email = $1",
    [email.trim().toLowerCase()]
  );
  const user = result.rows[0];
  if (!user || !user.password_hash) return res.status(401).json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });

  const token = signToken({ sub: user.id, email: user.email });
  res.json({ token, user: toPublicUser(user) });
}

async function me(req, res) {
  const result = await pool.query("SELECT id, name, email, points FROM users WHERE id = $1", [req.user.id]);
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: toPublicUser(user) });
}

function oauthCallback(provider) {
  return (req, res, next) => {
    passport.authenticate(provider, { session: false }, (err, user, info) => {
      const frontendUrl = process.env.FRONTEND_URL;
      if (err || !user) {
        const message = encodeURIComponent(err?.message || info?.message || "เข้าสู่ระบบไม่สำเร็จ");
        return res.redirect(`${frontendUrl}#oauth_error=${message}`);
      }
      const token = signToken({ sub: user.id, email: user.email });
      res.redirect(`${frontendUrl}#token=${token}`);
    })(req, res, next);
  };
}

module.exports = { register, login, me, oauthCallback };
