#!/usr/bin/env node
import { config as loadDotEnv } from "dotenv";
import { resolve } from "node:path";
import { loadConfig } from "./config/env.js";
import { loadTrainingProfile } from "./config/profile.js";
import { IntervalsClient } from "./intervals/client.js";
import { createHttpApp, listen } from "./server/http.js";

loadDotEnv({ path: resolve(process.cwd(), ".env"), quiet: true });

const appConfig = loadConfig();
const profile = await loadTrainingProfile(appConfig.trainingProfilePath);
const client = new IntervalsClient({
  baseUrl: appConfig.intervalsBaseUrl,
  apiKey: appConfig.apiKey,
  athleteId: appConfig.athleteId,
  timeoutMs: appConfig.requestTimeoutMs,
});
const httpServer = await listen(createHttpApp({ config: appConfig, client, profile }), appConfig);
console.log(`intervals-icu-mcp listening on 0.0.0.0:${appConfig.port}`);

async function shutdown() {
  await new Promise<void>((resolve, reject) => httpServer.close((error) => error ? reject(error) : resolve()));
}
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
