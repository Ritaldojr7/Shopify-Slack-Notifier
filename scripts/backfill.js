import dotenv from "dotenv";
import { migrate, pool } from "../src/db.js";
import { setTitle } from "../src/store.js";

dotenv.config();

const SHOP = process.env.SHOP;
const SHOPIFY_ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;

const missing = ["SHOP", "SHOPIFY_ADMIN_TOKEN", "DATABASE_URL"].filter(
  (key) => !process.env[key]
);
if (missing.length > 0) {
  console.error(
    `Missing required environment variables: ${missing.join(", ")}\n` +
      "Add them to .env before running npm run backfill."
  );
  process.exit(1);
}

const API_VERSION = "2025-01";
const ENDPOINT = `https://${SHOP}.myshopify.com/admin/api/${API_VERSION}/graphql.json`;

const PRODUCTS_QUERY = `
  query Products($cursor: String) {
    products(first: 250, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        title
      }
    }
  }
`;

/** Extract the numeric product id from a Shopify GID. */
function parseProductId(gid) {
  return gid.split("/").pop();
}

/** Fetch one page of products from the Shopify GraphQL Admin API. */
async function fetchProductPage(cursor) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": SHOPIFY_ADMIN_TOKEN,
    },
    body: JSON.stringify({
      query: PRODUCTS_QUERY,
      variables: { cursor },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Shopify API error ${response.status}: ${body}`);
  }

  const json = await response.json();

  if (json.errors?.length) {
    throw new Error(
      `Shopify GraphQL error: ${json.errors.map((e) => e.message).join(", ")}`
    );
  }

  return json.data.products;
}

async function main() {
  await migrate();

  let cursor = null;
  let hasNextPage = true;
  let count = 0;

  console.log(`Backfilling product_titles from ${SHOP}.myshopify.com ...`);

  while (hasNextPage) {
    const { nodes, pageInfo } = await fetchProductPage(cursor);

    for (const product of nodes) {
      const id = parseProductId(product.id);
      await setTitle(id, product.title);
      count++;
      console.log(`Upserted ${count}: ${id} — "${product.title}"`);
    }

    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }

  console.log(`Done. Upserted ${count} product(s) into product_titles.`);
  await pool.end();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
