import { startWeb } from "./src/server.js";
import { startWorker } from "./src/worker.js";

await startWeb();
await startWorker();
