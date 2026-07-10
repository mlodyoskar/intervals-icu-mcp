import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getActivityDetails, GetActivityDetailsInputSchema, GetActivityDetailsOutputSchema } from "../activities/details.js";
import { listActivities, ListActivitiesInputSchema, ListActivitiesOutputSchema } from "../activities/list.js";
import { envelope } from "./output-schemas.js";
import { executeTool } from "./common.js";
import type { ToolDependencies } from "./dependencies.js";

export function registerActivityTools(server: McpServer, dependencies: ToolDependencies) {
  server.registerTool("list_activities", {
    title: "List activities",
    description: "List summarized completed activities in guaranteed descending start-date order, without FIT files or second-by-second streams.",
    inputSchema: ListActivitiesInputSchema,
    outputSchema: envelope(ListActivitiesOutputSchema),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, (input) => executeTool("list_activities", dependencies.logger, () => listActivities(input, {
    client: dependencies.client,
    timezone: dependencies.config.timezone,
  })));

  server.registerTool("get_activity_details", {
    title: "Get activity details",
    description: "Get a completed activity summary, laps/intervals, zones and best efforts without raw streams.",
    inputSchema: GetActivityDetailsInputSchema,
    outputSchema: envelope(GetActivityDetailsOutputSchema),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, (input) => executeTool("get_activity_details", dependencies.logger, () => getActivityDetails(input, {
    client: dependencies.client,
    timezone: dependencies.config.timezone,
  })));
}
