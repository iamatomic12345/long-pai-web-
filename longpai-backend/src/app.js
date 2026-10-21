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

const app = express();

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

app.use(helmet());
app.use(cors({ origin: frontendOrigin() }));
app.use(express.json({ limit: "5mb" }));
app.use(passport.initialize());

app.get("/health", (req, res) => res.json({ ok: true }));

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

app.use(notFound);
app.use(errorHandler);

module.exports = app;
