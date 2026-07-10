import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterEach, describe, expect, it } from "vitest";
import { createHttpApp } from "../src/server/http.js";
import { MockIntervalsClient, testAuthToken, testConfig } from "./fixtures.js";

describe("Streamable HTTP MCP contract", () => {
  const closers: (() => Promise<void>)[] = [];
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
    const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${testAuthToken}` } },
    });
    await client.connect(transport);
    closers.push(async () => { await client.close().catch(() => undefined); });
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toContain("get_training_context");
    expect(tools.tools.map((tool) => tool.name)).not.toContain("apply_training_plan");
    const listActivities = tools.tools.find((tool) => tool.name === "list_activities");
    expect(listActivities?.inputSchema).toMatchObject({
      properties: {
        sport: { enum: ["run", "ride", "strength", "swim", "walk", "hike", "climbing", "other"] },
        activityType: { type: "string" },
      },
    });
    expect(listActivities?.outputSchema).toMatchObject({
      properties: {
        data: {
          properties: {
            activities: {
              items: {
                properties: {
                  sport: { enum: ["run", "ride", "strength", "swim", "walk", "hike", "climbing", "other"] },
                  activityType: { type: "string" },
                  sessionRpeLoad: { anyOf: [{ type: "number" }, { type: "null" }] },
                  planVsActual: {
                    properties: {
                      status: { enum: ["matched", "not_planned", "planned_but_unmatched"] },
                    },
                  },
                },
              },
            },
            sort: { const: "date_desc" },
          },
        },
      },
    });
    const trainingContext = tools.tools.find((tool) => tool.name === "get_training_context");
    expect(trainingContext?.inputSchema).toMatchObject({
      properties: { includeRawZones: { type: "boolean", default: false } },
    });
    expect(trainingContext?.outputSchema).toMatchObject({
      properties: {
        data: {
          properties: {
            zonesAndThresholds: {},
            fitnessFatigueForm: { properties: { source: {} } },
            weeklyVolume: { items: { properties: { isPartial: { type: "boolean" } } } },
            recentActivities: { properties: { sort: { const: "date_desc" }, truncated: { type: "boolean" } } },
            wellnessTrends: { properties: { coverage: { properties: { recordsAvailable: { type: "integer" } } } } },
            missingData: { items: { properties: { field: { type: "string" }, reason: {} } } },
          },
        },
      },
    });
    const response = await client.callTool({ name: "get_wellness", arguments: { startDate: "2026-07-10", endDate: "2026-07-10" } });
    expect(response.isError).not.toBe(true);
    expect(response.structuredContent).toEqual({ data: { wellness: [expect.objectContaining({ hrv: 62, sleepSeconds: null })] } });
    expect(response.content).toEqual([]);
    const contextResponse = await client.callTool({
      name: "get_training_context", arguments: { historyDays: 7, futureDays: 7 },
    });
    expect(contextResponse.isError).not.toBe(true);
    expect(contextResponse.structuredContent).toMatchObject({
      data: {
        zonesAndThresholds: { sports: expect.any(Array) },
        fitnessFatigueForm: { fitness: null, fatigue: null, form: null },
        recentActivities: { sort: "date_desc", limit: 20, truncated: false },
        wellnessTrends: { coverage: { windowDays: 7, recordsAvailable: 1, hrvDays: 1 } },
        missingData: expect.any(Array),
      },
    });
  });

  it("sorts activities descending and can filter bouldering as climbing", async () => {
    const mock = new MockIntervalsClient();
    mock.activities = [
      { id: "older", type: "Bouldering", start_date_local: "2026-07-08T18:00:00" },
      { id: "newer", type: "Bouldering", start_date_local: "2026-07-09T18:00:00" },
      { id: "climb", type: "RockClimbing", start_date_local: "2026-07-09T19:00:00" },
      { id: "run", type: "Run", start_date_local: "2026-07-10T18:00:00" },
    ];
    const app = createHttpApp({ config: testConfig, client: mock, profile: null });
    const httpServer = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
      const server = app.listen(0, "127.0.0.1", () => resolve(server));
    });
    closers.push(() => new Promise<void>((resolve, reject) => httpServer.close((error) => error ? reject(error) : resolve())));
    const port = (httpServer.address() as AddressInfo).port;
    const client = new Client({ name: "contract-test", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${testAuthToken}` } },
    });
    await client.connect(transport);
    closers.push(async () => { await client.close().catch(() => undefined); });

    const response = await client.callTool({
      name: "list_activities",
      arguments: {
        startDate: "2026-07-01", endDate: "2026-07-10", sport: "climbing", activityType: "bouldering",
      },
    });
    expect(response.structuredContent).toEqual({ data: {
      activities: [
        expect.objectContaining({ id: "newer", sport: "climbing", activityType: "bouldering" }),
        expect.objectContaining({ id: "older", sport: "climbing", activityType: "bouldering" }),
      ],
      sort: "date_desc",
      nextCursor: null,
    } });
  });

  it("protects every MCP method while leaving health probes public", async () => {
    const app = createHttpApp({ config: testConfig, client: new MockIntervalsClient(), profile: null });
    const httpServer = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
      const server = app.listen(0, "127.0.0.1", () => resolve(server));
    });
    closers.push(() => new Promise<void>((resolve, reject) => httpServer.close((error) => error ? reject(error) : resolve())));
    const port = (httpServer.address() as AddressInfo).port;
    const base = `http://127.0.0.1:${port}`;

    await expect(fetch(`${base}/healthz`).then((response) => response.status)).resolves.toBe(200);
    await expect(fetch(`${base}/readyz`).then((response) => response.status)).resolves.toBe(200);

    for (const method of ["GET", "DELETE", "PUT", "PATCH"]) {
      const response = await fetch(`${base}/mcp`, { method });
      expect(response.status).toBe(401);
      expect(response.headers.get("www-authenticate")).toBe('Bearer realm="intervals-icu-mcp"');
    }

    for (const authorization of [undefined, "Basic credentials", "Bearer wrong-token"]) {
      const response = await fetch(`${base}/mcp`, {
        method: "POST",
        headers: authorization ? { Authorization: authorization } : undefined,
      });
      expect(response.status).toBe(401);
      expect(response.headers.get("www-authenticate")).toBe('Bearer realm="intervals-icu-mcp"');
      await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
    }

    const authenticatedUnsupportedMethod = await fetch(`${base}/mcp`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${testAuthToken}` },
    });
    expect(authenticatedUnsupportedMethod.status).toBe(405);
  });
});
