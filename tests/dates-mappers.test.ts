import { describe, expect, it } from "vitest";
import { parseUserDate } from "../src/coaching/dates.js";
import { mapEvent, mapWellness } from "../src/intervals/mappers.js";

describe("dates and Intervals mappings", () => {
  it("interprets a date at local midnight in Europe/Warsaw", () => {
    expect(parseUserDate("2026-03-29", "Europe/Warsaw").toISO()).toBe("2026-03-29T00:00:00.000+01:00");
  });

  it("maps missing wellness values to null, not zero", () => {
    const mapped = mapWellness({ id: "2026-07-10", fatigue: 0 });
    expect(mapped.hrv).toBeNull();
    expect(mapped.sleepSeconds).toBeNull();
    expect(mapped.fatigue).toBe(0);
  });

  it("produces stable event hashes independent of source key order", () => {
    const a = mapEvent({ id: "e1", name: "Easy", type: "Run", start_date_local: "2026-07-11" });
    const b = mapEvent({ start_date_local: "2026-07-11", type: "Run", name: "Easy", id: "e1" });
    expect(a.eventHash).toBe(b.eventHash);
  });
});
