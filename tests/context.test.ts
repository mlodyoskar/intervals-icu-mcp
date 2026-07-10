import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { getTrainingContext } from "../src/coaching/context.js";
import { MockIntervalsClient } from "./fixtures.js";

describe("normalized training context", () => {
  it("normalizes sport settings, falls back to wellness CTL/ATL and reports coverage", async () => {
    const client = new MockIntervalsClient();
    client.athlete = {
      id: "i-test",
      weight: null,
      sportSettings: [
        {
          types: ["Ride", "VirtualRide"],
          ftp: 250,
          indoor_ftp: 240,
          lthr: 182,
          max_hr: 200,
          power_zones: [55, 75, 90],
          power_zone_names: ["Recovery", "Endurance", "Tempo"],
          hr_zones: [145, 165, 182],
          hr_zone_names: ["Easy", "Tempo", "Threshold"],
          display: { showSkylineChart: true },
          custom_field_ids: [1, 2, 3],
        },
        {
          types: ["Run", "TrailRun"],
          lthr: 182,
          max_hr: 200,
          threshold_pace: 4,
          pace_units: "MINS_KM",
          pace_zones: [80, 90, 100],
          pace_zone_names: ["Easy", "Steady", "Threshold"],
        },
      ],
    };
    client.activities = Array.from({ length: 21 }, (_, index) => ({
      id: `a${index}`,
      type: "Run",
      start_date_local: index === 0 ? "2026-07-04T08:00:00" : `2026-07-08T${String(index).padStart(2, "0")}:00:00`,
      moving_time: 1800,
      distance: 5000,
    }));
    client.wellness = [
      { id: "2026-07-09", sleepSecs: 27000 },
      {
        id: "2026-07-10", sleepSecs: 28800, restingHR: 50, ctl: 10.187239, atl: 11.968849,
        spO2: 97.2, steps: 8000, menstrualPhase: null, kcalConsumed: null, updated: "technical-value",
      },
    ];

    const context = await getTrainingContext({
      client,
      timezone: "Europe/Warsaw",
      profile: { goals: [], experience: null, availability: {}, preferences: [], injuryContext: null },
      historyDays: 7,
      futureDays: 14,
      now: DateTime.fromISO("2026-07-10T12:00:00+02:00"),
    });

    expect(context.zonesAndThresholds.weightKg).toBeNull();
    const ride = context.zonesAndThresholds.sports.find((entry) => entry.sport === "ride");
    expect(ride?.thresholds).toMatchObject({ ftpWatts: 250, indoorFtpWatts: 240, lthrBpm: 182, maxHeartRateBpm: 200 });
    expect(ride?.zones.power).toMatchObject({
      unit: "percent_ftp", boundaries: expect.arrayContaining([{ zone: 1, name: "Recovery", upperBound: 55 }]),
    });
    const run = context.zonesAndThresholds.sports.find((entry) => entry.sport === "run");
    expect(run?.thresholds).toMatchObject({ lthrBpm: 182, maxHeartRateBpm: 200, thresholdPaceSecondsPerKm: 250 });
    expect(context.zonesAndThresholds).not.toHaveProperty("raw");
    expect(JSON.stringify(context.zonesAndThresholds)).not.toContain("showSkylineChart");
    expect(context.fitnessFatigueForm).toEqual({ fitness: 10.19, fatigue: 11.97, form: -1.78, source: "wellness" });
    expect(context.wellnessTrends.coverage).toEqual({
      windowDays: 7,
      recordsAvailable: 2,
      sleepDays: 2,
      restingHeartRateDays: 1,
      hrvDays: 0,
      fatigueDays: 0,
      spo2Days: 1,
      stepsDays: 1,
    });
    expect(context.wellnessTrends.latest).toMatchObject({ spo2Percent: 97.2, steps: 8000, ctl: 10.19, atl: 11.97 });
    expect(context.wellnessTrends.latest).not.toHaveProperty("custom");
    expect(context.weeklyVolume[0]).toMatchObject({
      weekStart: "2026-06-29", isPartial: true, coveredFrom: "2026-07-04", coveredTo: "2026-07-05",
    });
    expect(context.recentActivities).toMatchObject({ sort: "date_desc", limit: 20, totalInWindow: 21, truncated: true });
    expect(context.recentActivities.items).toHaveLength(20);
    expect(context.missingData).toEqual(expect.arrayContaining([
      { field: "zonesAndThresholds.weightKg", reason: "not_recorded" },
      { field: "trainingProfile.injuryContext", reason: "not_configured" },
      { field: "wellness.hrv", reason: "not_recorded" },
      { field: "wellness.fatigue", reason: "not_recorded" },
    ]));
  });

  it("includes raw sport settings only when explicitly requested", async () => {
    const client = new MockIntervalsClient();
    client.athlete = { sportSettings: [{ types: ["Ride"], ftp: 250, display: { color: "red" } }] };
    const context = await getTrainingContext({
      client,
      timezone: "Europe/Warsaw",
      profile: null,
      historyDays: 1,
      futureDays: 1,
      includeRawZones: true,
      now: DateTime.fromISO("2026-07-10T12:00:00+02:00"),
    });
    expect(context.zonesAndThresholds).toHaveProperty("raw", client.athlete.sportSettings);
  });
});
