const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const favoriteController = require("../controllers/favorite.controller");

const router = express.Router();

router.get("/", requireAuth, asyncHandler(favoriteController.list));
router.post("/:tourId", requireAuth, asyncHandler(favoriteController.add));
router.delete("/:tourId", requireAuth, asyncHandler(favoriteController.remove));

module.exports = router;
