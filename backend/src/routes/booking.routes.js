const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const bookingController = require("../controllers/booking.controller");

const router = express.Router();

router.get("/", requireAuth, asyncHandler(bookingController.list));
router.post("/", requireAuth, asyncHandler(bookingController.create));

module.exports = router;
