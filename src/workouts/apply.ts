import type { IntervalsClientContract } from "../intervals/client.js";
import { mapEvent } from "../intervals/mappers.js";
import { mapAthlete } from "../intervals/mappers.js";
import { AppError } from "../platform/errors.js";
import { stableHash } from "./hash.js";
import type { TrainingPlan } from "./model.js";
import { renderWorkout } from "./renderer.js";
import type { ValidationTokenSigner } from "./token.js";
import { validateTrainingPlan } from "./validator.js";
import { zoneCapabilitiesFromAthlete } from "./capabilities.js";
import type { ApplyResult } from "./contracts.js";
import type { EventResponse } from "../intervals/schemas.js";

interface ApplyResultItem {
  clientWorkoutId: string;
  status: "created" | "updated" | "unchanged" | "conflict" | "failed";
  eventId: string | null;
  eventHash: string | null;
  message: string;
}

function currentWriteShape(raw: EventResponse) {
  return {
    start_date_local: String(raw.start_date_local ?? raw.start_date ?? "").slice(0, 10),
    name: String(raw.name ?? ""),
    type: String(raw.type ?? ""),
    category: String(raw.category ?? "WORKOUT"),
    description: String(raw.description ?? ""),
    ...(typeof raw.moving_time === "number" ? { moving_time: raw.moving_time } : {}),
    ...(typeof raw.distance === "number" ? { distance: raw.distance } : {}),
  };
}

export async function applyTrainingPlan(options: {
  plan: TrainingPlan;
  validationToken: string;
  client: IntervalsClientContract;
  signer: ValidationTokenSigner;
  timezone: string;
}): Promise<ApplyResult> {
  const token = options.signer.verify(options.validationToken, options.plan);
  if (!token.valid) {
    throw new AppError(token.reason === "Validation token expired" ? "TOKEN_EXPIRED" : "TOKEN_INVALID", token.reason ?? "Invalid validation token");
  }

  const dates = options.plan.workouts.map((workout) => workout.date).sort();
  const [existingRaw, athleteRaw] = await Promise.all([
    dates.length ? options.client.listEvents(dates[0]!, dates[dates.length - 1]!) : Promise.resolve([]),
    options.client.getAthlete(),
  ]);
  const existing = existingRaw.map((raw) => ({ raw, mapped: mapEvent(raw) }));
  const athlete = mapAthlete(athleteRaw);
  const validation = validateTrainingPlan(options.plan, {
    timezone: options.timezone,
    zoneCapabilities: zoneCapabilitiesFromAthlete(athlete),
    existingEvents: existing.map(({ mapped }) => mapped),
  });
  if (!validation.valid) throw new AppError("PLAN_CHANGED", "Plan no longer passes validation");

  const results: ApplyResultItem[] = [];
  for (const workout of options.plan.workouts) {
    const desired = renderWorkout(workout);
    const match = existing.find(({ mapped }) => mapped.clientWorkoutId === workout.clientWorkoutId);
    try {
      if (!match) {
        const created = mapEvent(await options.client.createEvent(desired));
        results.push({ clientWorkoutId: workout.clientWorkoutId, status: "created", eventId: created.id, eventHash: created.eventHash, message: "Created" });
        continue;
      }
      if (stableHash(currentWriteShape(match.raw)) === stableHash(desired)) {
        results.push({ clientWorkoutId: workout.clientWorkoutId, status: "unchanged", eventId: match.mapped.id, eventHash: match.mapped.eventHash, message: "Already up to date" });
        continue;
      }
      if (!workout.expectedEventHash || workout.expectedEventHash !== match.mapped.eventHash) {
        results.push({ clientWorkoutId: workout.clientWorkoutId, status: "conflict", eventId: match.mapped.id, eventHash: match.mapped.eventHash, message: "Existing event changed; expectedEventHash does not match" });
        continue;
      }
      const updated = mapEvent(await options.client.updateEvent(match.mapped.id, desired));
      results.push({ clientWorkoutId: workout.clientWorkoutId, status: "updated", eventId: updated.id, eventHash: updated.eventHash, message: "Updated" });
    } catch {
      results.push({ clientWorkoutId: workout.clientWorkoutId, status: "failed", eventId: match?.mapped.id ?? null, eventHash: match?.mapped.eventHash ?? null, message: "Intervals.icu write failed" });
    }
  }
  return { partial: results.some((result) => result.status === "failed" || result.status === "conflict"), results };
}
