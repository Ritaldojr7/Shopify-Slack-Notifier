import { WebClient } from "@slack/web-api";
import { SLACK_BOT_TOKEN, SLACK_CHANNEL_ID, SHOP } from "./config.js";

const slack = new WebClient(SLACK_BOT_TOKEN);

const MIN_INTERVAL_MS = 1100;
let lastCallAt = 0;
let chain = Promise.resolve();

/** Serialize Slack calls with ~1 msg/sec rate limiting. */
function rateLimited(fn) {
  chain = chain.then(async () => {
    const now = Date.now();
    const wait = Math.max(0, MIN_INTERVAL_MS - (now - lastCallAt));
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastCallAt = Date.now();
    return fn();
  });
  return chain;
}

function productAdminUrl(productId) {
  return `https://${SHOP}.myshopify.com/admin/products/${productId}`;
}

function istTime(iso) {
  return new Date(iso || Date.now()).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true
  }) + " IST";
}

/** Post a "New Product Created" notification. */
export async function postProductCreated(product) {
  const { id, title, handle } = product;
  const adminUrl = productAdminUrl(id);

  await rateLimited(() =>
    slack.chat.postMessage({
      channel: SLACK_CHANNEL_ID,
      text: `New Product Created: ${title}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: [
              `*New Product Created*`,
              `*Title:* ${title}`,
              `*Slug:* ${handle}`,
              `Time: ${istTime(product.created_at)}`,
              `<${adminUrl}|View Product>`,
            ].join("\n"),
          },
        },
      ],
    })
  );

  console.log(`Product created: ${id} — "${title}"`);
}

/** Post a "Product Title Updated" notification. */
export async function postTitleChanged(product, oldTitle, newTitle) {
  const { id, handle } = product;
  const adminUrl = productAdminUrl(id);

  await rateLimited(() =>
    slack.chat.postMessage({
      channel: SLACK_CHANNEL_ID,
      text: `Product Title Updated: ${oldTitle} -> ${newTitle}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: [
              `*Product Title Updated*`,
              `*Title:* ${oldTitle} → ${newTitle}`,
              `*Slug:* ${handle}`,
              `Time: ${istTime(product.updated_at)}`,
              `<${adminUrl}|View Product>`,
            ].join("\n"),
          },
        },
      ],
    })
  );

  console.log(
    `Product title updated: ${id} — "${oldTitle}" -> "${newTitle}"`
  );
}
