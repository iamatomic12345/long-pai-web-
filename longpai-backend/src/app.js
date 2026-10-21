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
const { UPLOAD_ROOT } = require("./middleware/storyUpload");

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || "").split(",").map((o) => o.trim()).filter(Boolean);

app.use(helmet());
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : true }));
app.use(express.json({ limit: "5mb" }));
app.use(passport.initialize());

app.get("/health", (req, res) => res.json({ ok: true }));

// uploaded story photos; the frontend is usually served from another origin,
// so relax helmet's same-origin resource policy for these files only
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
