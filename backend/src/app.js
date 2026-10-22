const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const { passport } = require("./config/passport");
const authRoutes = require("./routes/auth.routes");
const provinceRoutes = require("./routes/province.routes");
const storyRoutes = require("./routes/story.routes");
const bookingRoutes = require("./routes/booking.routes");
const couponRoutes = require("./routes/coupon.routes");
const favoriteRoutes = require("./routes/favorite.routes");
const meRoutes = require("./routes/me.routes");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const { UPLOAD_ROOT } = require("./services/storyStorage");
const { apiLimiter } = require("./middleware/rateLimit");
const { pool } = require("./config/db");

// the web page lives in ../frontend; serving it here puts the whole app on one origin
const FRONTEND_DIR = path.join(__dirname, "..", "..", "frontend");

const app = express();

// On Render a request reaches the app through three proxies: Cloudflare, Render's load
// balancer (10.x) and a local sidecar (the socket is ::1) — X-Forwarded-For arrives as
// "<client>, <cloudflare>, <10.x>". Trusting exactly those three hops makes req.ip the
// visitor's address (rate limits are per IP) and lets X-Forwarded-Proto set the secure
// OAuth cookie. Anything a client writes into X-Forwarded-For sits further left and is ignored
app.set("trust proxy", 3);

// browsers may call the API only from the frontend's own origin (FRONTEND_URL,
// which also tells OAuth where to send people back). Non-browser clients are unaffected
function frontendOrigin() {
  try {
    return new URL(process.env.FRONTEND_URL).origin;
  } catch {
    console.warn("FRONTEND_URL is missing or invalid — cross-origin browser requests will be refused");
    return false;
  }
}

// no CSP: the bundled page unpacks its scripts at runtime (blob: URLs, in-browser Babel)
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: frontendOrigin() }));
// JSON bodies are small (login, check-in, booking); story photos come as multipart instead
app.use(express.json({ limit: "100kb" }));
app.use(passport.initialize());

// pinged by Render's health check and an uptime monitor: a trivial query proves the
// database is reachable (and counts as activity, which keeps a free Supabase project
// from pausing). 503 when it isn't, or doesn't answer within 5 seconds
const HEALTH_DB_TIMEOUT_MS = 5000;
app.get("/health", async (req, res) => {
  let timer;
  try {
    await Promise.race([
      pool.query("SELECT 1"),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), HEALTH_DB_TIMEOUT_MS); }),
    ]);
    res.json({ ok: true, db: "ok" });
  } catch (err) {
    console.error("health check: database unreachable:", err.message);
    res.status(503).json({ ok: false, db: "unreachable" });
  } finally {
    clearTimeout(timer);
  }
});

// terms of use, privacy policy and data-deletion instructions (the last two are also
// linked from the Google/Facebook app settings)
const LEGAL_DIR = path.join(__dirname, "legal");
app.get("/terms", (req, res) => res.sendFile(path.join(LEGAL_DIR, "terms.html")));
app.get("/privacy", (req, res) => res.sendFile(path.join(LEGAL_DIR, "privacy.html")));
app.get("/data-deletion", (req, res) => res.sendFile(path.join(LEGAL_DIR, "data-deletion.html")));

// story photos stored on local disk (dev, or stories posted before Supabase Storage);
// the frontend is usually served from another origin, so relax helmet's same-origin
// resource policy for these files only
app.use("/uploads", express.static(UPLOAD_ROOT, {
  index: false,
  setHeaders: (res) => res.set("Cross-Origin-Resource-Policy", "cross-origin"),
}));

app.use("/api", apiLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/provinces", provinceRoutes);
app.use("/api/stories", storyRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/me", meRoutes);

if (fs.existsSync(path.join(FRONTEND_DIR, "index.html"))) {
  app.use(express.static(FRONTEND_DIR));
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
