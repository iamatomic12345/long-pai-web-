require("dotenv").config();
const { pool } = require("../../src/config/db");
const tours = require("./tours-data");

async function seed() {
  for (const t of tours) {
    await pool.query(
      `INSERT INTO tours (id, name, province, region, price)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name, province = EXCLUDED.province,
           region = EXCLUDED.region, price = EXCLUDED.price`,
      [t.id, t.name, t.province, t.region, t.price]
    );
  }

  console.log(`Seeded ${tours.length} tours.`);
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
