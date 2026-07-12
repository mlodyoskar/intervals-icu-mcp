import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ACTIVITY_SPORTS } from "../activities/model.js";
import { getTrainingContext } from "../coaching/context.js";
import { TrainingContextSchema } from "../coaching/model.js";
import { executeTool } from "./common.js";
import type { ToolDependencies } from "./dependencies.js";
import { envelope } from "./output-schemas.js";

const GetTrainingContextInputSchema = z.object({
  historyDays: z.number().int().min(1).max(84).default(42),
  futureDays: z.number().int().min(1).max(28).default(14),
  sports: z.array(z.enum(ACTIVITY_SPORTS)).min(1).max(ACTIVITY_SPORTS.length).optional(),
  includeRawZones: z.boolean().default(false)
    .describe("Include the unfiltered Intervals.icu sport settings; false keeps the coaching context compact"),
}).strict();

export function registerTrainingContextTool(server: McpServer, dependencies: ToolDependencies) {
  server.registerTool("get_training_context", {
    title: "Training context (Use First)",
    description: "Mandatory first step for every training recommendation, plan, or calendar change. Call this tool before reasoning about workouts. Returns the compact, normalized context needed to make an informed plan; raw sport settings are opt-in.",
    inputSchema: GetTrainingContextInputSchema,
    outputSchema: envelope(TrainingContextSchema),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, (input) => executeTool("get_training_context", dependencies.logger, () => getTrainingContext({
    ...input,
    client: dependencies.client,
    timezone: dependencies.config.timezone,
    profile: dependencies.profile,
    now: dependencies.now,
  })));
}
