const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { writeLimiter } = require("../middleware/rateLimit");
const { storyImage } = require("../middleware/storyUpload");
const storyController = require("../controllers/story.controller");

const router = express.Router();

router.get("/", asyncHandler(storyController.list));
router.get("/reported", requireAuth, requireAdmin, asyncHandler(storyController.listReported));
// auth runs before multer so anonymous requests never write to disk
router.post("/", writeLimiter, requireAuth, storyImage, asyncHandler(storyController.create));
router.delete("/:id", requireAuth, asyncHandler(storyController.remove));
router.post("/:id/report", writeLimiter, requireAuth, asyncHandler(storyController.report));
router.post("/:id/restore", requireAuth, requireAdmin, asyncHandler(storyController.restore));

module.exports = router;
