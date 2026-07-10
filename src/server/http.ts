import type { Server } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import type { RequestHandler } from "express";
import { readinessProblems, type AppConfig } from "../config/env.js";
import type { TrainingProfile } from "../config/profile.js";
import type { IntervalsClientContract } from "../intervals/client.js";
import { createMcpServer } from "../tools/register.js";

export interface HttpServerDependencies {
  config: AppConfig;
  client: IntervalsClientContract;
  profile: TrainingProfile | null;
  authMiddleware?: RequestHandler;
}

export function createHttpApp(dependencies: HttpServerDependencies) {
  const app = createMcpExpressApp({ host: "0.0.0.0" });
  if (dependencies.authMiddleware) app.use("/mcp", dependencies.authMiddleware);

  app.get("/healthz", (_req, res) => res.status(200).json({ status: "ok" }));
  app.get("/readyz", (_req, res) => {
    const problems = readinessProblems(dependencies.config);
    res.status(problems.length ? 503 : 200).json({ status: problems.length ? "not_ready" : "ready", problems });
  });
  app.post("/mcp", async (req, res) => {
    const mcpServer = createMcpServer(dependencies);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.once("close", () => {
      void transport.close();
      void mcpServer.close();
    });
    try {
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch {
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
      }
    } finally {
      // Resources are released by the response close handler registered above.
    }
  });
  const methodNotAllowed: RequestHandler = (_req, res) => {
    res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed" }, id: null });
  };
  app.get("/mcp", methodNotAllowed);
  app.delete("/mcp", methodNotAllowed);
  app.put("/mcp", methodNotAllowed);
  app.patch("/mcp", methodNotAllowed);
  return app;
}

export function listen(app: ReturnType<typeof createHttpApp>, config: AppConfig): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(config.port, "0.0.0.0", () => resolve(server));
    server.once("error", reject);
  });
}
