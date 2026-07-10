import type { DateTime } from "luxon";
import type { AppConfig } from "../config/env.js";
import type { TrainingProfile } from "../config/profile.js";
import type { IntervalsGateway } from "../intervals/client.js";
import type { AppLogger } from "../platform/logger.js";

export interface ToolDependencies {
  config: AppConfig;
  client: IntervalsGateway;
  profile: TrainingProfile | null;
  logger: AppLogger;
  now?: DateTime;
}
