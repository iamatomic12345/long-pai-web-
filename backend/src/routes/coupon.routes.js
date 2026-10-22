const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const { writeLimiter } = require("../middleware/rateLimit");
const couponController = require("../controllers/coupon.controller");

const router = express.Router();

router.get("/", requireAuth, asyncHandler(couponController.list));
router.post("/redeem", writeLimiter, requireAuth, asyncHandler(couponController.redeem));

module.exports = router;
