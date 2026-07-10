import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { ValidationTokenSigner } from "../src/workouts/token.js";
import { validateTrainingPlan } from "../src/workouts/validator.js";
import { validateTrainingPlanUseCase } from "../src/workouts/validate-use-case.js";
import { MockIntervalsClient } from "./fixtures.js";
import { mapAthlete } from "../src/intervals/mappers.js";
import { zoneCapabilitiesFromAthlete } from "../src/workouts/capabilities.js";

const plan = {
  planId: "plan-1",
  timezone: "Europe/Warsaw",
  workouts: [{ clientWorkoutId: "w1", date: "2026-07-11", sport: "run" as const, name: "Easy", steps: [{ type: "steady" as const, durationSeconds: 1800, target: { type: "open" as const } }] }],
};

describe("plan validation token", () => {
  it("binds the signature to the exact canonical plan and expires", () => {
    let clock = Date.parse("2026-07-10T10:00:00Z");
    const signer = new ValidationTokenSigner("x".repeat(32), () => clock);
    const token = signer.sign(plan, 30);
    expect(signer.verify(token, plan).valid).toBe(true);
    expect(signer.verify(token, { ...plan, planId: "changed" }).valid).toBe(false);
    clock += 31_000;
    expect(signer.verify(token, plan).reason).toBe("Validation token expired");
  });

  it("normalizes, summarizes and rejects missing zones", () => {
    const result = validateTrainingPlan({ ...plan, workouts: [{ ...plan.workouts[0], steps: [{ type: "steady", durationSeconds: 1800, target: { type: "heart_rate_zone", zone: 2 } }] }] }, {
      timezone: "Europe/Warsaw",
      zoneCapabilities: { run: { heartRate: false, pace: false, power: false } },
      now: DateTime.fromISO("2026-07-10T12:00:00", { zone: "Europe/Warsaw" }),
    });
    expect(result.valid).toBe(false);
    expect(result.errors.map((issue) => issue.code)).toContain("missing_zones");
    expect(result.summary.totalDurationSeconds).toBe(1800);
  });

  it("checks zone capabilities for the workout sport and target type", () => {
    const zonedPlan = { ...plan, workouts: [{
      ...plan.workouts[0],
      steps: [{ type: "steady" as const, durationSeconds: 1800, target: { type: "heart_rate_zone" as const, zone: 2 } }],
    }] };
    const baseContext = {
      timezone: "Europe/Warsaw",
      now: DateTime.fromISO("2026-07-10T12:00:00", { zone: "Europe/Warsaw" }),
    };
    expect(validateTrainingPlan(zonedPlan, {
      ...baseContext,
      zoneCapabilities: { ride: { heartRate: true, pace: false, power: true } },
    }).errors.map((issue) => issue.code)).toContain("missing_zones");
    expect(validateTrainingPlan(zonedPlan, {
      ...baseContext,
      zoneCapabilities: { run: { heartRate: true, pace: false, power: false } },
    }).valid).toBe(true);
  });

  it("merges capabilities from settings that normalize to the same sport", () => {
    const athlete = mapAthlete({
      sportSettings: [
        { types: ["Ride"], power_zones: [55, 75, 90] },
        { types: ["VirtualRide"], hr_zones: [140, 160, 180] },
      ],
    });

    expect(zoneCapabilitiesFromAthlete(athlete).ride).toEqual({
      heartRate: true,
      pace: false,
      power: true,
    });
  });

  it("loads athlete capabilities and calendar context through the validation use case", async () => {
    const client = new MockIntervalsClient();
    client.athlete = {
      sportSettings: [{ types: ["Run"], hr_zones: [140, 160, 180], hr_zone_names: ["Easy", "Tempo", "Hard"] }],
    };
    client.events = [{ id: "e1", start_date_local: "2026-07-11", type: "Run", name: "Existing" }];
    const signer = new ValidationTokenSigner("z".repeat(32));
    const result = await validateTrainingPlanUseCase({
      ...plan,
      workouts: [{
        ...plan.workouts[0]!,
        steps: [{ type: "steady", durationSeconds: 1800, target: { type: "heart_rate_zone", zone: 2 } }],
      }],
    }, {
      client,
      timezone: "Europe/Warsaw",
      signer,
      now: DateTime.fromISO("2026-07-10T12:00:00", { zone: "Europe/Warsaw" }),
    });
    expect(result.valid).toBe(true);
    expect(result.validationToken).toEqual(expect.any(String));
    expect(result.warnings.map((issue) => issue.code)).toContain("calendar_collision");
  });
});
