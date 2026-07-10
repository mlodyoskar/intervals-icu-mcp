import { describe, expect, it } from "vitest";
import { TrainingPlanSchema } from "../src/workouts/model.js";
import { renderWorkout } from "../src/workouts/renderer.js";

describe("neutral workout model and renderer", () => {
  it("rejects non-positive steps and more than 20 repeats", () => {
    const base = {
      planId: "p1", timezone: "Europe/Warsaw", workouts: [{
        clientWorkoutId: "w1", date: "2026-07-11", sport: "run", name: "Intervals",
        steps: [{ type: "repeat", repetitions: 21, steps: [{ type: "interval", durationSeconds: 0, target: { type: "open" } }] }],
      }],
    };
    expect(TrainingPlanSchema.safeParse(base).success).toBe(false);
  });

  it("renders deterministic Intervals workout syntax and totals", () => {
    const workout = TrainingPlanSchema.parse({
      planId: "p1", timezone: "Europe/Warsaw", workouts: [{
        clientWorkoutId: "w1", date: "2026-07-11", sport: "run", name: "4x5 min",
        steps: [
          { type: "warmup", durationSeconds: 600, target: { type: "heart_rate_zone", zone: 1 } },
          { type: "repeat", repetitions: 4, steps: [
            { type: "interval", durationSeconds: 300, target: { type: "heart_rate_zone", zone: 4 } },
            { type: "recovery", durationSeconds: 180, target: { type: "open" } },
          ] },
        ],
      }],
    }).workouts[0];
    const rendered = renderWorkout(workout);
    expect(rendered.moving_time).toBe(2520);
    expect(rendered.description).toContain("# clientWorkoutId=w1");
    expect(rendered.description).toContain("- 4x\n  - 5m interval HR Z4");
  });
});
