const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const { passport } = require("./config/passport");
const authRoutes = require("./routes/auth.routes");
const provinceRoutes = require("./routes/province.routes");
const storyRoutes = require("./routes/story.routes");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || "").split(",").map((o) => o.trim()).filter(Boolean);

app.use(helmet());
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : true }));
app.use(express.json({ limit: "5mb" }));
app.use(passport.initialize());

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/provinces", provinceRoutes);
app.use("/api/stories", storyRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
