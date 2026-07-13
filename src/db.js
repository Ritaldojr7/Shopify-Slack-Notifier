import pg from "pg";
import { DATABASE_URL, pgSsl } from "./config.js";

export const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: pgSsl,
  max: 5,
});

/** Create application tables if they do not exist. */
export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_titles (
      product_id text PRIMARY KEY,
      title text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS title_changes (
      id          bigserial PRIMARY KEY,
      product_id  text NOT NULL,
      old_title   text NOT NULL,
      new_title   text NOT NULL,
      changed_at  timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    ALTER TABLE product_titles
    ADD COLUMN IF NOT EXISTS source_updated_at timestamptz
  `);
}
