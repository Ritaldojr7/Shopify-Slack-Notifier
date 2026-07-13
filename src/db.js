import pg from "pg";
import { DATABASE_URL, pgSsl } from "./config.js";

export const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: pgSsl,
  max: 5,
});

/** Create the product_titles table if it does not exist. */
export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_titles (
      product_id text PRIMARY KEY,
      title text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}
