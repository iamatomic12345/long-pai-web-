const session = require("express-session");

// Passport's OAuth2 `state` CSRF protection needs req.session to stash a
// nonce between the redirect to the provider and the callback. Scoped to the
// OAuth routes only — the rest of the API stays stateless (JWT).
// MemoryStore is fine for a single dev instance; swap in a shared store
// (e.g. connect-pg-simple) before running more than one server process.
module.exports = session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 5 * 60 * 1000,
  },
});
