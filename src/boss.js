import PgBoss from "pg-boss";
import { DATABASE_URL, pgSsl } from "./config.js";
import { migrate } from "./db.js";

export const QUEUE_NAME = "product-events";

export const boss = new PgBoss({
  connectionString: DATABASE_URL,
  ssl: pgSsl,
});

let initialized = false;
let migrated = false;

/** Start pg-boss, create the queue, and run DB migrations once. */
export async function initBoss() {
  if (initialized) return boss;

  boss.on("error", (err) => {
    console.error("pg-boss error:", err);
  });

  await boss.start();
  await boss.createQueue(QUEUE_NAME);

  if (!migrated) {
    await migrate();
    migrated = true;
  }

  initialized = true;
  return boss;
}
