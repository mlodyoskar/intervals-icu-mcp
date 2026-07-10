import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterEach, describe, expect, it } from "vitest";
import { createHttpApp } from "../src/server/http.js";
import { MockIntervalsClient, testConfig } from "./fixtures.js";

describe("Streamable HTTP MCP contract", () => {
  const closers: Array<() => Promise<void>> = [];
  afterEach(async () => { await Promise.all(closers.splice(0).map((close) => close())); });

  it("serves health/readiness and a complete MCP call over HTTP with writes disabled", async () => {
    const mock = new MockIntervalsClient();
    mock.wellness = [{ id: "2026-07-10", hrv: 62 }];
    const app = createHttpApp({ config: testConfig, client: mock, profile: null });
    const httpServer = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
      const server = app.listen(0, "127.0.0.1", () => resolve(server));
    });
    closers.push(() => new Promise<void>((resolve, reject) => httpServer.close((error) => error ? reject(error) : resolve())));
    const port = (httpServer.address() as AddressInfo).port;
    const base = `http://127.0.0.1:${port}`;
    await expect(fetch(`${base}/healthz`).then((response) => response.json())).resolves.toEqual({ status: "ok" });
    expect((await fetch(`${base}/readyz`)).status).toBe(200);

    const client = new Client({ name: "contract-test", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`));
    await client.connect(transport);
    closers.push(async () => { await client.close().catch(() => undefined); });
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toContain("get_training_context");
    expect(tools.tools.map((tool) => tool.name)).not.toContain("apply_training_plan");
    const response = await client.callTool({ name: "get_wellness", arguments: { startDate: "2026-07-10", endDate: "2026-07-10" } });
    expect(response.isError).not.toBe(true);
    expect(response.structuredContent).toEqual({ data: { wellness: [expect.objectContaining({ hrv: 62, sleepSeconds: null })] } });
  });
});
