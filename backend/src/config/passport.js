const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const { pool } = require("./db");

function extractEmail(profile) {
  return profile.emails && profile.emails[0] && profile.emails[0].value;
}

async function findOrCreateOAuthUser(profile, providerName) {
  const email = extractEmail(profile);
  if (!email) {
    throw new Error(`${providerName} ไม่ได้ส่งอีเมลกลับมา กรุณาอนุญาตสิทธิ์การเข้าถึงอีเมลแล้วลองใหม่`);
  }
  const normalizedEmail = email.toLowerCase();

  const existing = await pool.query(
    "SELECT id, name, email, points FROM users WHERE email = $1",
    [normalizedEmail]
  );
  if (existing.rows.length) return existing.rows[0];

  const name = profile.displayName || normalizedEmail.split("@")[0];
  const inserted = await pool.query(
    `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, NULL)
     RETURNING id, name, email, points`,
    [name, normalizedEmail]
  );
  return inserted.rows[0];
}

const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const facebookEnabled = Boolean(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET);

if (googleEnabled) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
        state: true,
      },
      (accessToken, refreshToken, profile, done) => {
        findOrCreateOAuthUser(profile, "Google")
          .then((user) => done(null, user))
          .catch((err) => done(err));
      }
    )
  );
}

if (facebookEnabled) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: process.env.FACEBOOK_CALLBACK_URL,
        profileFields: ["id", "displayName", "emails"],
        // passport-facebook defaults to v3.2, which Meta has retired
        graphAPIVersion: "v26.0",
        state: true,
      },
      (accessToken, refreshToken, profile, done) => {
        findOrCreateOAuthUser(profile, "Facebook")
          .then((user) => done(null, user))
          .catch((err) => done(err));
      }
    )
  );
}

module.exports = { passport, googleEnabled, facebookEnabled };
