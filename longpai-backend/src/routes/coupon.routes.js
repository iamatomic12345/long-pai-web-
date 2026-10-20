const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const couponController = require("../controllers/coupon.controller");

const router = express.Router();

router.get("/", requireAuth, asyncHandler(couponController.list));
router.post("/redeem", requireAuth, asyncHandler(couponController.redeem));

module.exports = router;
