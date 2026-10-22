// An in-memory PostgreSQL (PGlite, Postgres compiled to WASM) with every migration
// applied, installed in place of src/config/db so the real SQL runs in tests.
// Call before requiring anything that loads the database module.
const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

async function useTestDb() {
  const db = new PGlite();
  const dir = path.join(__dirname, "../../db/migrations");
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(fs.readFileSync(path.join(dir, file), "utf8"));
  }

  const query = async (sql, params) => {
    const result = await db.query(sql, params);
    return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
  };
  const pool = { query, connect: async () => ({ query, release() {} }), end: async () => {} };

  const dbPath = require.resolve("../../src/config/db");
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { pool } };
  return { db, pool };
}

module.exports = { useTestDb };
