import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { ValidationTokenSigner } from "../src/workouts/token.js";
import { validateTrainingPlan } from "../src/workouts/validator.js";

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
      zonesAvailable: false,
      now: DateTime.fromISO("2026-07-10T12:00:00", { zone: "Europe/Warsaw" }),
    });
    expect(result.valid).toBe(false);
    expect(result.errors.map((issue) => issue.code)).toContain("missing_zones");
    expect(result.summary.totalDurationSeconds).toBe(1800);
  });
});
