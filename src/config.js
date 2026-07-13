import dotenv from "dotenv";

dotenv.config();

const REQUIRED_ENV = [
  "DATABASE_URL",
  "SHOPIFY_WEBHOOK_SECRET",
  "SLACK_BOT_TOKEN",
  "SLACK_CHANNEL_ID",
];

const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(
    `Missing required environment variables: ${missing.join(", ")}\n` +
      "Copy .env.example to .env and fill in the values."
  );
  process.exit(1);
}

export const DATABASE_URL = process.env.DATABASE_URL;
export const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET;
export const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
export const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID;
export const SHOP = process.env.SHOP;
export const PORT = process.env.PORT || "3000";

export const pgSsl = DATABASE_URL.includes("sslmode=disable")
  ? false
  : { rejectUnauthorized: false };
