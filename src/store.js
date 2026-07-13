import { pool } from "./db.js";

/** Return the stored title for a product, or null if none exists. */
export async function getTitle(productId) {
  const { rows } = await pool.query(
    "SELECT title FROM product_titles WHERE product_id = $1",
    [String(productId)]
  );
  return rows[0]?.title ?? null;
}

/** Insert or update the stored title for a product. */
export async function setTitle(productId, title) {
  await pool.query(
    `INSERT INTO product_titles (product_id, title)
     VALUES ($1, $2)
     ON CONFLICT (product_id)
     DO UPDATE SET title = EXCLUDED.title, updated_at = now()`,
    [String(productId), title]
  );
}
