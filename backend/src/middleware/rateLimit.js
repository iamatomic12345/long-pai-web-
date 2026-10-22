const { rateLimit } = require("express-rate-limit");

// counted per client IP — app.js trusts Render's proxy, so req.ip is the real client.
// When a limit is hit the answer is a 429 with a plain Thai message in `error`,
// which the frontend already shows for any failed request
function limiter({ windowMinutes, limit, message, respond = sendJson, ...rest }) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res) => {
      const resetTime = req.rateLimit?.resetTime;
      const minutes = resetTime ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 60000)) : windowMinutes;
      respond(res, `${message} กรุณารอประมาณ ${minutes} นาทีแล้วลองใหม่`);
    },
    ...rest,
  });
}

const sendJson = (res, text) => res.status(429).json({ error: text });

// the Google/Facebook buttons navigate the whole page to /api/auth/<provider>, so a JSON
// body would show up raw; send the browser back to the app, which toasts #oauth_error
const redirectToApp = (res, text) =>
  res.redirect(`${process.env.FRONTEND_URL || "/"}#oauth_error=${encodeURIComponent(text)}`);

// login and register: strict, against password guessing.
// Successful logins don't count, so only failed attempts use up the 10
const authLimiter = limiter({
  windowMinutes: 15,
  limit: 10,
  skipSuccessfulRequests: true,
  message: "พยายามเข้าสู่ระบบหลายครั้งเกินไป",
});

// starting a Google/Facebook sign-in: every start redirects (counts as "successful"),
// so this one counts all requests, with more headroom than password logins
const oauthLimiter = limiter({
  windowMinutes: 15,
  limit: 20,
  message: "พยายามเข้าสู่ระบบหลายครั้งเกินไป",
  respond: redirectToApp,
});

// check-ins, story posts and reports, bookings: things that write data or award points
const writeLimiter = limiter({
  windowMinutes: 15,
  limit: 30,
  message: "ทำรายการถี่เกินไป",
});

// every other API call (mostly reads): loose, only stops runaway scripts
const apiLimiter = limiter({
  windowMinutes: 15,
  limit: 1000,
  message: "มีการเรียกใช้งานถี่เกินไป",
});

module.exports = { authLimiter, oauthLimiter, writeLimiter, apiLimiter };
