const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const storyController = require("../controllers/story.controller");

const router = express.Router();

router.get("/", asyncHandler(storyController.list));
router.post("/", requireAuth, asyncHandler(storyController.create));
router.delete("/:id", requireAuth, asyncHandler(storyController.remove));

module.exports = router;
