import { pathToFileURL } from "url";
import { boss, initBoss, QUEUE_NAME } from "./boss.js";
import { getTitle, setTitle, logTitleChange } from "./store.js";
import { postProductCreated, postTitleChanged } from "./slack.js";

/** Process a single queued product event. */
async function processJob(job) {
  const { topic, body } = job.data;

  let product;
  try {
    product = JSON.parse(body);
  } catch (err) {
    console.error("Failed to parse job body:", err.message);
    return;
  }

  console.log(JSON.stringify(product, null, 2));

  const { id, title, updated_at: updatedAt } = product;

  if (topic === "create") {
    await setTitle(id, title, updatedAt);
    await postProductCreated(product);
    return;
  }

  if (topic === "update") {
    const stored = await getTitle(id);

    // No baseline yet — record silently and skip notification.
    if (stored === null) {
      await setTitle(id, title, updatedAt);
      console.log(`Baseline title stored for product ${id}: "${title}"`);
      return;
    }

    // Stale or out-of-order delivery — skip entirely.
    if (stored.sourceUpdatedAt && updatedAt) {
      if (new Date(stored.sourceUpdatedAt) >= new Date(updatedAt)) {
        console.log(
          `Skipping stale/out-of-order update for product ${id}`
        );
        return;
      }
    }

    // Title unchanged — no-op.
    if (stored.title === title) {
      return;
    }

    const oldTitle = stored.title;
    const newTitle = title;

    try {
      await logTitleChange(id, oldTitle, newTitle);
    } catch (err) {
      console.error(
        `Failed to log title change for product ${id}:`,
        err
      );
    }

    await postTitleChanged(product, oldTitle, newTitle);
    await setTitle(id, newTitle, updatedAt);
  }
}

/** Start the pg-boss worker that processes queued product events. */
export async function startWorker() {
  await initBoss();

  await boss.work(QUEUE_NAME, async (jobs) => {
    const jobList = Array.isArray(jobs) ? jobs : [jobs];
    for (const job of jobList) {
      try {
        await processJob(job);
      } catch (err) {
        console.error(`Job ${job.id} failed:`, err);
        throw err;
      }
    }
  });

  console.log(`Worker listening on queue "${QUEUE_NAME}"`);
}

const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  startWorker().catch((err) => {
    console.error("Failed to start worker:", err);
    process.exit(1);
  });
}
