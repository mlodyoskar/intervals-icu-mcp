import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerActivityTools } from "./activities.js";
import { registerCalendarTool } from "./calendar.js";
import type { ToolDependencies } from "./dependencies.js";
import { registerTrainingContextTool } from "./training-context.js";
import { registerTrainingPlanTools } from "./training-plans.js";
import { registerWellnessTool } from "./wellness.js";
import { APP_NAME, APP_VERSION, SERVER_INSTRUCTIONS } from "../platform/metadata.js";

export function createMcpServer(dependencies: ToolDependencies): McpServer {
  const server = new McpServer(
    { name: APP_NAME, version: APP_VERSION },
    { instructions: SERVER_INSTRUCTIONS },
  );
  registerTrainingContextTool(server, dependencies);
  registerActivityTools(server, dependencies);
  registerWellnessTool(server, dependencies);
  registerCalendarTool(server, dependencies);
  registerTrainingPlanTools(server, dependencies);
  return server;
}
