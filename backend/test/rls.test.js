const test = require("node:test");
const assert = require("node:assert/strict");
const { useTestDb } = require("./helpers/testDb");

test("migration 010 turns on RLS for every public table; the owner still reads and writes", async () => {
  const { pool } = await useTestDb();
  const { rows } = await pool.query(
    "SELECT relname, relrowsecurity FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' ORDER BY relname"
  );
  assert.deepEqual(rows.map((r) => r.relname), [
    "bookings", "coupons", "favorites", "provinces", "stories", "story_reports", "tours", "user_visited_provinces", "users",
  ]);
  assert.deepEqual(rows.filter((r) => !r.relrowsecurity).map((r) => r.relname), []);

  // the backend's role owns the tables, so RLS without policies doesn't block it
  await pool.query("INSERT INTO users (name, email) VALUES ('a', 'a@example.com')");
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM users")).rows[0].n, 1);
});

test("a role that isn't the owner (like Supabase's anon) sees no rows", async () => {
  const { db } = await useTestDb();
  await db.exec(`
    INSERT INTO users (name, email) VALUES ('a', 'a@example.com');
    CREATE ROLE anon_test NOLOGIN;
    GRANT USAGE ON SCHEMA public TO anon_test;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon_test;
    SET ROLE anon_test;
  `);
  const { rows } = await db.query("SELECT count(*)::int AS n FROM users");
  assert.equal(rows[0].n, 0);
  await db.exec("RESET ROLE");
});
