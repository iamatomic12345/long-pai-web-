/*
 * Promote an existing user to admin (can delete anyone's story).
 * Terminal-only on purpose — there is no API for changing roles.
 *
 * Usage: node scripts/make-admin.js someone@example.com
 */
require("dotenv").config();
const { pool } = require("../src/config/db");

async function main() {
  const email = (process.argv[2] || "").trim().toLowerCase();
  if (!email) {
    console.error("Usage: node scripts/make-admin.js <email>");
    process.exitCode = 1;
    return;
  }

  const result = await pool.query(
    "UPDATE users SET role = 'admin' WHERE email = $1 RETURNING id, name, email, role",
    [email]
  );
  if (!result.rows.length) {
    console.error(`No user with email ${email}`);
    process.exitCode = 1;
    return;
  }

  const user = result.rows[0];
  console.log(`${user.name} <${user.email}> (id ${user.id}) is now ${user.role}.`);
}

main()
  .catch((err) => {
    console.error("make-admin failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
