import { pathToFileURL } from "url";
import { boss, initBoss, QUEUE_NAME } from "./boss.js";
import { getTitle, setTitle } from "./store.js";
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

  const { id, title } = product;

  if (topic === "create") {
    await setTitle(id, title);
    await postProductCreated(product);
    return;
  }

  if (topic === "update") {
    const storedTitle = await getTitle(id);

    // No baseline yet — record silently and skip notification.
    if (storedTitle === null) {
      await setTitle(id, title);
      console.log(`Baseline title stored for product ${id}: "${title}"`);
      return;
    }

    // Title unchanged — no-op.
    if (storedTitle === title) {
      return;
    }

    await postTitleChanged(product, storedTitle, title);
    await setTitle(id, title);
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
