const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const { writeLimiter } = require("../middleware/rateLimit");
const { storyImage } = require("../middleware/storyUpload");
const storyController = require("../controllers/story.controller");

const router = express.Router();

router.get("/", asyncHandler(storyController.list));
// auth runs before multer so anonymous requests never write to disk
router.post("/", writeLimiter, requireAuth, storyImage, asyncHandler(storyController.create));
router.delete("/:id", requireAuth, asyncHandler(storyController.remove));

module.exports = router;
