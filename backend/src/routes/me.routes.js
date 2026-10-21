const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const userController = require("../controllers/user.controller");

const router = express.Router();

router.get("/", requireAuth, asyncHandler(userController.me));

module.exports = router;
