import { describe, expect, it } from "vitest";
import { parseUserDate } from "../src/coaching/dates.js";
import { mapActivity, mapEvent, mapWellness } from "../src/intervals/mappers.js";

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

  it("maps activity RPE and session RPE load without confusing their scales", () => {
    const mapped = mapActivity({
      id: "a1",
      type: "Run",
      start_date_local: "2026-07-09T19:21:52",
      average_speed: 2.879,
      distance: 3878.31,
      icu_rpe: 7,
      session_rpe: 164,
    }, "Europe/Warsaw");

    expect(mapped.date).toBe("2026-07-09T19:21:52+02:00");
    expect(mapped.rpe).toBe(7);
    expect(mapped.sessionRpeLoad).toBe(164);
    expect(mapped.averageSpeedMps).toBe(2.88);
    expect(mapped.averagePaceSecondsPerKm).toBe(347);
    expect(mapped.distanceMeters).toBe(3878);
  });

  it("rejects out-of-scale RPE and uses null for inapplicable speed", () => {
    const mapped = mapActivity({
      type: "StrengthTraining",
      start_date_local: "2026-07-09T19:21:52",
      average_speed: 0,
      rpe: 108,
    }, "Europe/Warsaw");

    expect(mapped.rpe).toBeNull();
    expect(mapped.averageSpeedMps).toBeNull();
    expect(mapped.planVsActual.status).toBe("not_planned");
  });

  it("preserves bouldering as a specific climbing activity", () => {
    const mapped = mapActivity({ type: "Bouldering", start_date_local: "2026-07-09T12:00:00" }, "Europe/Warsaw");
    expect(mapped.sport).toBe("climbing");
    expect(mapped.activityType).toBe("bouldering");
  });

  it("produces stable event hashes independent of source key order", () => {
    const a = mapEvent({ id: "e1", name: "Easy", type: "Run", start_date_local: "2026-07-11" });
    const b = mapEvent({ start_date_local: "2026-07-11", type: "Run", name: "Easy", id: "e1" });
    expect(a.eventHash).toBe(b.eventHash);
  });
});
