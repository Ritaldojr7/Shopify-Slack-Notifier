import express from "express";
import { pathToFileURL } from "url";
import { PORT, SHOPIFY_WEBHOOK_SECRET } from "./config.js";
import { boss, initBoss, QUEUE_NAME } from "./boss.js";
import { verifyHmac } from "./hmac.js";

const app = express();

/**
 * Ingest a Shopify webhook: verify HMAC, enqueue raw event, respond fast.
 * Processing and Slack notifications happen in the worker.
 */
async function ingestWebhook(req, res, topic) {
  const hmac = req.get("X-Shopify-Hmac-Sha256");

  if (!verifyHmac(req.body, hmac, SHOPIFY_WEBHOOK_SECRET)) {
    return res.status(401).send("Unauthorized");
  }

  const webhookId = req.get("X-Shopify-Webhook-Id");

  try {
    await boss.send(
      QUEUE_NAME,
      { topic, body: req.body.toString("utf-8") },
      {
        singletonKey: webhookId,
        retryLimit: 5,
        retryBackoff: true,
      }
    );
  } catch (err) {
    console.error("Failed to enqueue webhook:", err);
    return res.status(500).send("Enqueue failed");
  }

  // Respond immediately — Shopify times out at 5 seconds.
  return res.status(200).send("OK");
}

app.post(
  "/webhooks/products/create",
  express.raw({ type: "application/json" }),
  (req, res) => ingestWebhook(req, res, "create")
);

app.post(
  "/webhooks/products/update",
  express.raw({ type: "application/json" }),
  (req, res) => ingestWebhook(req, res, "update")
);

app.get("/health", (_req, res) => {
  res.send("ok");
});

/** Initialize pg-boss and start the ingestion server. */
export async function startWeb() {
  await initBoss();

  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
    console.log(`  POST /webhooks/products/create`);
    console.log(`  POST /webhooks/products/update`);
    console.log(`  GET  /health`);
  });
}

const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  startWeb().catch((err) => {
    console.error("Failed to start web server:", err);
    process.exit(1);
  });
}
