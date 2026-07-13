import { pool } from "./db.js";

/**
 * Return the stored title row for a product, or null if none exists.
 * @returns {{ title: string, sourceUpdatedAt: Date | null } | null}
 */
export async function getTitle(productId) {
  const { rows } = await pool.query(
    "SELECT title, source_updated_at FROM product_titles WHERE product_id = $1",
    [String(productId)]
  );

  if (!rows[0]) return null;

  return {
    title: rows[0].title,
    sourceUpdatedAt: rows[0].source_updated_at,
  };
}

/** Insert or update the stored title and source_updated_at for a product. */
export async function setTitle(productId, title, sourceUpdatedAt = null) {
  await pool.query(
    `INSERT INTO product_titles (product_id, title, source_updated_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (product_id)
     DO UPDATE SET title = EXCLUDED.title,
                   source_updated_at = EXCLUDED.source_updated_at,
                   updated_at = now()`,
    [String(productId), title, sourceUpdatedAt]
  );
}

/** Record a title change in the audit log. */
export async function logTitleChange(productId, oldTitle, newTitle) {
  await pool.query(
    `INSERT INTO title_changes (product_id, old_title, new_title)
     VALUES ($1, $2, $3)`,
    [String(productId), oldTitle, newTitle]
  );
}
