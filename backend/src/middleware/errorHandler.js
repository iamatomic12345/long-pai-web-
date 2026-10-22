function notFound(req, res) {
  res.status(404).json({ error: "Not found" });
}

// body-parser's own messages are English and technical; say it plainly instead
const CLIENT_ERRORS = {
  "entity.parse.failed": "ข้อมูลที่ส่งมาไม่ถูกต้อง",
  "entity.too.large": "ข้อมูลที่ส่งมามีขนาดใหญ่เกินไป",
};

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) {
    // the details (stack, SQL error, …) stay in the server log; the client gets a generic message
    console.error(err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในระบบ ลองใหม่อีกครั้ง" });
  }
  res.status(status).json({ error: CLIENT_ERRORS[err.type] || (err.expose && err.message) || "คำขอไม่ถูกต้อง" });
}

module.exports = { notFound, errorHandler };
