const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const { writeLimiter } = require("../middleware/rateLimit");
const bookingController = require("../controllers/booking.controller");

const router = express.Router();

router.get("/", requireAuth, asyncHandler(bookingController.list));
router.post("/", writeLimiter, requireAuth, asyncHandler(bookingController.create));

module.exports = router;
