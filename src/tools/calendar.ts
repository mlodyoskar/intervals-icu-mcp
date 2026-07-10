import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getCalendar, GetCalendarInputSchema, GetCalendarOutputSchema } from "../calendar/get.js";
import { executeTool } from "./common.js";
import type { ToolDependencies } from "./dependencies.js";
import { envelope } from "./output-schemas.js";

export function registerCalendarTool(server: McpServer, dependencies: ToolDependencies) {
  server.registerTool("get_training_calendar", {
    title: "Get training calendar",
    description: "Get planned workouts, races, rest days and notes with a stable event version hash.",
    inputSchema: GetCalendarInputSchema,
    outputSchema: envelope(GetCalendarOutputSchema),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, (input) => executeTool("get_training_calendar", dependencies.logger, () => getCalendar(input, {
    client: dependencies.client,
    timezone: dependencies.config.timezone,
  })));
}
