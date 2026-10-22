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

// the web page lives in ../frontend; serving it here puts the whole app on one origin
const FRONTEND_DIR = path.join(__dirname, "..", "..", "frontend");

const app = express();

// behind Render's HTTPS proxy: trust X-Forwarded-Proto so the secure OAuth session
// cookie is actually set in production
app.set("trust proxy", 1);

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
app.use(express.json({ limit: "5mb" }));
app.use(passport.initialize());

app.get("/health", (req, res) => res.json({ ok: true }));

// privacy policy and data-deletion instructions (linked from the Google/Facebook app settings)
const LEGAL_DIR = path.join(__dirname, "legal");
app.get("/privacy", (req, res) => res.sendFile(path.join(LEGAL_DIR, "privacy.html")));
app.get("/data-deletion", (req, res) => res.sendFile(path.join(LEGAL_DIR, "data-deletion.html")));

// story photos stored on local disk (dev, or stories posted before Supabase Storage);
// the frontend is usually served from another origin, so relax helmet's same-origin
// resource policy for these files only
app.use("/uploads", express.static(UPLOAD_ROOT, {
  index: false,
  setHeaders: (res) => res.set("Cross-Origin-Resource-Policy", "cross-origin"),
}));

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
