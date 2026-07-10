import { describe, expect, it } from "vitest";
import { listActivities } from "../src/activities/list.js";
import { AppError } from "../src/platform/errors.js";
import { MockIntervalsClient } from "./fixtures.js";

const dependencies = (client: MockIntervalsClient) => ({ client, timezone: "Europe/Warsaw" });

describe("activity listing", () => {
  it("uses a stable query-bound cursor when newer activities arrive", async () => {
    const client = new MockIntervalsClient();
    client.activities = [
      { id: "a3", type: "Run", start_date_local: "2026-07-03T08:00:00" },
      { id: "a2", type: "Run", start_date_local: "2026-07-02T08:00:00" },
      { id: "a1", type: "Run", start_date_local: "2026-07-01T08:00:00" },
    ];
    const input = { startDate: "2026-07-01", endDate: "2026-07-10", limit: 1 };
    const first = await listActivities(input, dependencies(client));
    expect(first.activities.map((activity) => activity.id)).toEqual(["a3"]);
    expect(first.nextCursor).not.toBeNull();

    client.activities.push({ id: "a4", type: "Run", start_date_local: "2026-07-04T08:00:00" });
    const second = await listActivities({ ...input, cursor: first.nextCursor! }, dependencies(client));
    expect(second.activities.map((activity) => activity.id)).toEqual(["a2"]);
  });

  it("rejects cursors reused for a different query and oversized ranges", async () => {
    const client = new MockIntervalsClient();
    client.activities = [
      { id: "a2", type: "Run", start_date_local: "2026-07-02T08:00:00" },
      { id: "a1", type: "Run", start_date_local: "2026-07-01T08:00:00" },
    ];
    const page = await listActivities({ startDate: "2026-07-01", endDate: "2026-07-10", limit: 1 }, dependencies(client));
    await expect(listActivities({
      startDate: "2026-07-01",
      endDate: "2026-07-09",
      limit: 1,
      cursor: page.nextCursor!,
    }, dependencies(client))).rejects.toMatchObject({ code: "INVALID_CURSOR" } satisfies Partial<AppError>);
    await expect(listActivities({
      startDate: "2025-01-01",
      endDate: "2026-07-10",
      limit: 1,
    }, dependencies(client))).rejects.toMatchObject({ code: "INVALID_DATE_RANGE" } satisfies Partial<AppError>);
  });
});
