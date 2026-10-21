const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const oauthSession = require("../middleware/oauthSession");
const authController = require("../controllers/auth.controller");
const { passport, googleEnabled, facebookEnabled } = require("../config/passport");

const router = express.Router();

router.post("/register", asyncHandler(authController.register));
router.post("/login", asyncHandler(authController.login));
router.get("/me", requireAuth, asyncHandler(authController.me));

router.get("/google", oauthSession, (req, res, next) => {
  if (!googleEnabled) return res.status(501).json({ error: "Google login is not configured" });
  passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});

router.get("/google/callback", oauthSession, (req, res, next) => {
  if (!googleEnabled) return res.status(501).json({ error: "Google login is not configured" });
  authController.oauthCallback("google")(req, res, next);
});

router.get("/facebook", oauthSession, (req, res, next) => {
  if (!facebookEnabled) return res.status(501).json({ error: "Facebook login is not configured" });
  passport.authenticate("facebook", { scope: ["email"] })(req, res, next);
});

router.get("/facebook/callback", oauthSession, (req, res, next) => {
  if (!facebookEnabled) return res.status(501).json({ error: "Facebook login is not configured" });
  authController.oauthCallback("facebook")(req, res, next);
});

module.exports = router;
