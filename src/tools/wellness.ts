import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getWellness, GetWellnessInputSchema, GetWellnessOutputSchema } from "../wellness/get.js";
import { executeTool } from "./common.js";
import type { ToolDependencies } from "./dependencies.js";
import { envelope } from "./output-schemas.js";

export function registerWellnessTool(server: McpServer, dependencies: ToolDependencies) {
  server.registerTool("get_wellness", {
    title: "Get wellness",
    description: "Get daily sleep, HRV, resting heart rate and recovery fields; missing values are null, never zero.",
    inputSchema: GetWellnessInputSchema,
    outputSchema: envelope(GetWellnessOutputSchema),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, (input) => executeTool("get_wellness", dependencies.logger, () => getWellness(input, {
    client: dependencies.client,
    timezone: dependencies.config.timezone,
  })));
}
