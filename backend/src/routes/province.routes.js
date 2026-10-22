const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const { writeLimiter } = require("../middleware/rateLimit");
const provinceController = require("../controllers/province.controller");

const router = express.Router();

router.get("/", asyncHandler(provinceController.list));
router.get("/visited", requireAuth, asyncHandler(provinceController.listVisited));
router.post("/:id/visited", writeLimiter, requireAuth, asyncHandler(provinceController.markVisited));

module.exports = router;
