const path = require("path");
const multer = require("multer");

const MAX_BYTES = 5 * 1024 * 1024;

// the only formats accepted, keyed by the MIME type the browser declares
const IMAGE_TYPES = {
  "image/jpeg": { ext: ".jpg", exts: [".jpg", ".jpeg"], magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": { ext: ".png", exts: [".png"], magic: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/webp": { ext: ".webp", exts: [".webp"], magic: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP" },
};

// some clients send a generic type for webp; fall back to the extension then —
// the file's real signature is still checked after upload either way
function resolveType(file) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (IMAGE_TYPES[file.mimetype]) {
    return !ext || IMAGE_TYPES[file.mimetype].exts.includes(ext) ? file.mimetype : null;
  }
  if (file.mimetype === "application/octet-stream") {
    return Object.keys(IMAGE_TYPES).find((t) => IMAGE_TYPES[t].exts.includes(ext)) || null;
  }
  return null;
}

// kept in memory (≤5MB) and handed to storyStorage, which decides where it lives
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    file.imageType = resolveType(file);
    if (!file.imageType) return cb(new UploadError("รองรับเฉพาะไฟล์ jpg, png หรือ webp"));
    cb(null, true);
  },
});

class UploadError extends Error {}

// single "image" field → req.file (buffer, imageType, imageExt); problems become 400s
function storyImage(req, res, next) {
  upload.single("image")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "ไฟล์รูปต้องมีขนาดไม่เกิน 5MB" });
      }
      if (err instanceof multer.MulterError || err instanceof UploadError) {
        return res.status(400).json({ error: err instanceof UploadError ? err.message : "อัปโหลดไฟล์ไม่สำเร็จ" });
      }
      return next(err);
    }
    if (req.file) {
      // the declared MIME type is just a claim; check the bytes actually start like that format
      if (!IMAGE_TYPES[req.file.imageType].magic(req.file.buffer.subarray(0, 12))) {
        return res.status(400).json({ error: "รองรับเฉพาะไฟล์ jpg, png หรือ webp" });
      }
      req.file.imageExt = IMAGE_TYPES[req.file.imageType].ext;
    }
    next();
  });
}

module.exports = { storyImage };
