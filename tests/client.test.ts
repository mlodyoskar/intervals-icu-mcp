import { describe, expect, it, vi } from "vitest";
import { IntervalsApiError, IntervalsClient } from "../src/intervals/client.js";

function makeClient(fetchImpl: typeof fetch) {
  return new IntervalsClient({ baseUrl: "https://example.test/api/v1", apiKey: "secret", athleteId: "i1", fetchImpl, sleep: async () => {} });
}

describe("Intervals client", () => {
  it("retries safe reads after 5xx and validates the response", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("failure", { status: 503 }))
      .mockResolvedValueOnce(Response.json([{ id: "a1" }]));
    await expect(makeClient(fetchMock as typeof fetch).listActivities("2026-07-01", "2026-07-10")).resolves.toEqual([{ id: "a1" }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never retries writes and does not expose the upstream response body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("secret health payload", { status: 500 }));
    const promise = makeClient(fetchMock as typeof fetch).createEvent({
      start_date_local: "2026-07-11", name: "Easy", type: "Run", category: "WORKOUT", description: "private",
    });
    await expect(promise).rejects.toMatchObject<Partial<IntervalsApiError>>({ status: 500, kind: "upstream" });
    await expect(promise).rejects.not.toThrow("secret health payload");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("classifies authentication and rate limit errors", async () => {
    const auth = makeClient(vi.fn().mockResolvedValue(new Response(null, { status: 401 })) as typeof fetch);
    await expect(auth.getAthlete()).rejects.toMatchObject({ kind: "unauthorized", retryable: false });
    const rate = makeClient(vi.fn().mockResolvedValue(new Response(null, { status: 429 })) as typeof fetch);
    await expect(rate.getAthlete()).rejects.toMatchObject({ kind: "rate_limited", retryable: true });
  });
});
