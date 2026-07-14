# shopify-slack-notifier

Posts Slack messages when Shopify products are created or when a product's title changes.

Because Shopify has no dedicated "product title updated" webhook, this app listens to `products/update` (which fires on any product edit) and compares the incoming title against a stored baseline in Supabase PostgreSQL. A Slack notification is sent only when the title actually changes.

The architecture splits ingestion (fast webhook ACK + enqueue) from processing (title diff + Slack) using [pg-boss](https://github.com/timgit/pg-boss) as a job queue backed by the same Supabase database — zero extra infrastructure cost.

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier)
- A Shopify store with admin access
- A Slack workspace where you can create apps

## Setup

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Open **Project Settings → Database**.
3. Under **Connection string**, select **Session pooler** (port `5432`).
4. Copy the connection string and set it as `DATABASE_URL` in your `.env`.

The `product_titles` table and pg-boss queue tables are created automatically on first run.

### 2. Create a Slack app

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and create a new app.
2. Under **OAuth & Permissions**, add the `chat:write` bot scope.
3. Install the app to your workspace and copy the **Bot User OAuth Token** (`xoxb-...`).
4. Create a Slack channel (or pick an existing one) and invite the bot.
5. Copy the channel ID (right-click the channel → **View channel details** → scroll to the bottom).

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase Session pooler connection string (port 5432) |
| `SHOPIFY_WEBHOOK_SECRET` | Webhook signing secret from Shopify |
| `SLACK_BOT_TOKEN` | Bot token with `chat:write` scope |
| `SLACK_CHANNEL_ID` | Channel ID to post notifications to |
| `SHOP` | Store subdomain (e.g. `my-store` for `my-store.myshopify.com`) |
| `PORT` | Server port (default `3000`) |

### 5. Start the app

```bash
npm start
```

This runs both the ingestion server and the worker in one process (suitable for free single-service hosting).

You can also run them separately:

```bash
npm run start:web      # ingestion server only
npm run start:worker   # worker only
```

### 6. Expose the server with ngrok

In a separate terminal:

```bash
ngrok http 3000
```

Copy the HTTPS forwarding URL (e.g. `https://abc123.ngrok.io`).

### 7. Register Shopify webhooks

1. In Shopify admin, go to **Settings → Notifications → Webhooks**.
2. Click **Create webhook** and add both of the following:

| Event | Format | URL |
|---|---|---|
| Product creation | JSON | `https://<ngrok-url>/webhooks/products/create` |
| Product update | JSON | `https://<ngrok-url>/webhooks/products/update` |

Use the latest stable API version for both webhooks.

3. After creating the webhooks, copy the **Webhook signing secret** shown on the page and paste it into `.env` as `SHOPIFY_WEBHOOK_SECRET`.
4. Restart the server.

## Testing

1. **Create a product** — add a new product in Shopify admin. You should see a "New Product Created" message in Slack.
2. **Edit a product title** — change the title of an existing product. You should see a "Product Title Updated" message showing the old and new titles.
3. **Edit something else** — change the description or price without touching the title. No Slack message should appear.

## Architecture

```
Shopify webhook
      │
      ▼
┌─────────────┐   verify HMAC    ┌──────────────┐
│  Ingestion  │ ───────────────► │  pg-boss     │
│  (Express)  │   enqueue event  │  queue       │
│  return 200 │                  │  (Postgres)  │
└─────────────┘                  └──────┬───────┘
                                      │
                                      ▼
                               ┌──────────────┐
                               │   Worker     │
                               │  title diff  │
                               │  Slack post  │
                               └──────────────┘
```

- **Ingestion** verifies the HMAC signature, enqueues the raw event (deduplicated by `X-Shopify-Webhook-Id`), and returns `200` immediately.
- **Worker** consumes the queue, does a single SQL `SELECT` for the last-known title, and only posts to Slack on a real title change (or on product create).

## Health check

```
GET /health
```

Returns `ok` when the server is running.

## CI/CD

Deployments are handled by GitHub Actions only — Render auto-deploy is disabled.

### Pipeline

| Trigger | CI | Deploy |
|---|---|---|
| Any pull request | Syntax check + `npm ci` | — |
| Push to `feature/**`, `fix/**`, or `chore/**` | Syntax check + `npm ci` | — |
| Push to `main` | Syntax check + `npm ci` | Render deploy hook |

Workflow file: `.github/workflows/ci-cd.yml`

Uses a single job so checks and deploy share one runner on `main` (saves Actions minutes). Render builds with `npm ci` to match CI.

### One-time setup

1. **Disable Render auto-deploy** (if not already off via `render.yaml`):
   - Render Dashboard → your service → **Settings** → **Build & Deploy** → set **Auto-Deploy** to **Off**

2. **Create a Render deploy hook**:
   - Render Dashboard → your service → **Settings** → **Deploy Hook** → copy the URL

3. **Add the GitHub secret**:
   - GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
   - Name: `RENDER_DEPLOY_HOOK_URL`
   - Value: your deploy hook URL

4. **(Optional) Protect `main`**:
   - GitHub repo → **Settings** → **Branches** → require the **CI** check to pass before merging

### Deploy flow

1. Open a PR → CI runs automatically
2. Merge to `main` → CI runs, then the workflow POSTs to the Render hook with `ref=<commit-sha>`
3. Render builds and deploys that exact commit

Local check before pushing:

```bash
npm ci
npm run check
```
