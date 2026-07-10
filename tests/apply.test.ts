import { describe, expect, it } from "vitest";
import { applyTrainingPlan } from "../src/workouts/apply.js";
import { renderWorkout } from "../src/workouts/renderer.js";
import { ValidationTokenSigner } from "../src/workouts/token.js";
import type { TrainingPlan } from "../src/workouts/model.js";
import { MockIntervalsClient } from "./fixtures.js";

const plan: TrainingPlan = {
  planId: "p1", timezone: "Europe/Warsaw", workouts: [{
    clientWorkoutId: "w1", date: "2026-07-11", sport: "run", name: "Easy",
    steps: [{ type: "steady", durationSeconds: 1800, target: { type: "open" } }],
  }],
};

describe("idempotent plan application", () => {
  it("does not create a duplicate when the existing event already matches", async () => {
    const client = new MockIntervalsClient();
    client.events = [{ id: "e1", ...renderWorkout(plan.workouts[0]!) }];
    const signer = new ValidationTokenSigner("s".repeat(32));
    const result = await applyTrainingPlan({ plan, validationToken: signer.sign(plan), client, signer, timezone: "Europe/Warsaw" });
    expect(result.results[0]!.status).toBe("unchanged");
    expect(client.creates).toHaveLength(0);
  });

  it("reports a conflict instead of overwriting a manually changed event", async () => {
    const client = new MockIntervalsClient();
    client.events = [{ id: "e1", ...renderWorkout(plan.workouts[0]!), name: "Manually changed" }];
    const signer = new ValidationTokenSigner("s".repeat(32));
    const result = await applyTrainingPlan({ plan, validationToken: signer.sign(plan), client, signer, timezone: "Europe/Warsaw" });
    expect(result.partial).toBe(true);
    expect(result.results[0]!.status).toBe("conflict");
    expect(client.updates).toHaveLength(0);
  });
});
