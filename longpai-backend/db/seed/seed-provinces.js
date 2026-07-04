require("dotenv").config();
const { pool } = require("../../src/config/db");
const provinces = require("./provinces-data");

async function seed() {
  for (const p of provinces) {
    await pool.query(
      `INSERT INTO provinces (name, region, spot, grid_col, grid_row)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (name) DO UPDATE
       SET region = EXCLUDED.region, spot = EXCLUDED.spot,
           grid_col = EXCLUDED.grid_col, grid_row = EXCLUDED.grid_row`,
      [p.name, p.region, p.spot, p.col, p.row]
    );
  }

  console.log(`Seeded ${provinces.length} provinces.`);
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
