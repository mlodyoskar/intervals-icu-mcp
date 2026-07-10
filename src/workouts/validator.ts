import type { DateTime } from "luxon";
import { parseUserDate, today } from "../coaching/dates.js";
import type { CalendarEvent } from "../calendar/model.js";
import type { PlanSummary, ValidationIssue, ValidationResult } from "./contracts.js";
import type { SportZoneCapabilities, ZoneCapabilities } from "./capabilities.js";
import { TrainingPlanSchema, type TrainingPlan, type WorkoutStep } from "./model.js";
import { totalDistance, totalDuration } from "./renderer.js";
import type { ValidationTokenSigner } from "./token.js";

export interface ValidationContext {
  timezone: string;
  zoneCapabilities?: ZoneCapabilities;
  existingEvents?: CalendarEvent[];
  signer?: ValidationTokenSigner;
  now?: DateTime;
}

function emptySummary(): PlanSummary {
  return { workoutCount: 0, totalDurationSeconds: 0, totalDistanceMeters: 0, byWeek: [] };
}

function requiredZoneTypes(steps: WorkoutStep[]): (keyof SportZoneCapabilities)[] {
  return steps.flatMap((step) => {
    if (step.type === "repeat") return requiredZoneTypes(step.steps);
    if (step.target.type === "heart_rate_zone") return ["heartRate" as const];
    if (step.target.type === "pace_zone") return ["pace" as const];
    if (step.target.type === "power_zone") return ["power" as const];
    return [];
  });
}

function isHard(steps?: WorkoutStep[]): boolean {
  if (!steps) return false;
  return steps.some((step) => {
    if (step.type === "repeat") return isHard(step.steps);
    return (step.target.type === "heart_rate_zone" || step.target.type === "pace_zone" || step.target.type === "power_zone")
      && step.target.zone >= 4;
  });
}

function summarize(plan: TrainingPlan, timezone: string): PlanSummary {
  const weeks = new Map<string, { workouts: number; durationSeconds: number; distanceMeters: number }>();
  let totalDurationSeconds = 0;
  let totalDistanceMeters = 0;
  for (const workout of plan.workouts) {
    const duration = workout.steps ? totalDuration(workout.steps) : 0;
    const distance = workout.steps ? totalDistance(workout.steps) : 0;
    totalDurationSeconds += duration;
    totalDistanceMeters += distance;
    const weekStart = parseUserDate(workout.date, timezone).startOf("week").toISODate()!;
    const week = weeks.get(weekStart) ?? { workouts: 0, durationSeconds: 0, distanceMeters: 0 };
    week.workouts += 1;
    week.durationSeconds += duration;
    week.distanceMeters += distance;
    weeks.set(weekStart, week);
  }
  return {
    workoutCount: plan.workouts.length,
    totalDurationSeconds,
    totalDistanceMeters,
    byWeek: [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([weekStart, values]) => ({ weekStart, ...values })),
  };
}

function preview(plan: TrainingPlan): string {
  if (plan.workouts.length === 0) return "Plan contains no workouts.";
  return plan.workouts.map((workout) => `${workout.date} · ${workout.sport} · ${workout.name}`).join("\n");
}

export function validateTrainingPlan(input: unknown, context: ValidationContext): ValidationResult {
  const parsed = TrainingPlanSchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      normalizedPlan: null,
      errors: parsed.error.issues.map((issue) => ({ code: "schema", message: issue.message, path: issue.path.join(".") })),
      warnings: [],
      summary: emptySummary(),
      humanReadablePreview: "Plan failed schema validation.",
    };
  }

  const normalizedPlan: TrainingPlan = {
    ...parsed.data,
    workouts: [...parsed.data.workouts].sort((a, b) => a.date.localeCompare(b.date) || a.clientWorkoutId.localeCompare(b.clientWorkoutId)),
  };
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  if (normalizedPlan.timezone !== context.timezone) {
    errors.push({ code: "timezone_mismatch", message: `Plan timezone must be ${context.timezone}`, path: "timezone" });
  }
  const base = today(context.timezone, context.now);
  const seenIds = new Set<string>();
  const seenDatesAndNames = new Set<string>();

  for (const workout of normalizedPlan.workouts) {
    const date = parseUserDate(workout.date, context.timezone);
    const days = Math.floor(date.diff(base, "days").days);
    if (days < 0 || days > 28) {
      errors.push({ code: "date_out_of_range", message: "Workout must be between today and 28 days in the future", workoutId: workout.clientWorkoutId });
    }
    if (seenIds.has(workout.clientWorkoutId)) {
      errors.push({ code: "duplicate_id", message: "clientWorkoutId must be unique", workoutId: workout.clientWorkoutId });
    }
    seenIds.add(workout.clientWorkoutId);
    const dateName = `${workout.date}\0${workout.name.toLowerCase()}`;
    if (seenDatesAndNames.has(dateName)) {
      errors.push({ code: "duplicate_workout", message: "Duplicate workout date and name", workoutId: workout.clientWorkoutId });
    }
    seenDatesAndNames.add(dateName);
    const unavailableZones = workout.steps
      ? [...new Set(requiredZoneTypes(workout.steps))].filter((type) => context.zoneCapabilities?.[workout.sport]?.[type] !== true)
      : [];
    if (unavailableZones.length > 0) {
      errors.push({
        code: "missing_zones",
        message: `Workout uses unavailable ${unavailableZones.join(", ")} zones for ${workout.sport}`,
        workoutId: workout.clientWorkoutId,
      });
    }
    const collisions = context.existingEvents?.filter((event) => event.date.slice(0, 10) === workout.date && event.clientWorkoutId !== workout.clientWorkoutId) ?? [];
    if (collisions.length > 0) {
      warnings.push({ code: "calendar_collision", message: `${collisions.length} existing calendar event(s) on this date`, workoutId: workout.clientWorkoutId });
    }
  }

  for (let index = 1; index < normalizedPlan.workouts.length; index += 1) {
    const previous = normalizedPlan.workouts[index - 1]!;
    const current = normalizedPlan.workouts[index]!;
    if (current.date === previous.date && current.sport !== "recovery" && previous.sport !== "recovery") {
      warnings.push({ code: "multiple_hard_same_day", message: "Multiple non-recovery workouts on the same day", workoutId: current.clientWorkoutId });
    }
    const daysApart = parseUserDate(current.date, context.timezone).diff(parseUserDate(previous.date, context.timezone), "days").days;
    if (daysApart <= 1 && isHard(previous.steps) && isHard(current.steps)) {
      warnings.push({ code: "hard_days_adjacent", message: "Hard workouts are planned on adjacent days", workoutId: current.clientWorkoutId });
    }
  }

  const summary = summarize(normalizedPlan, context.timezone);
  for (let index = 1; index < summary.byWeek.length; index += 1) {
    const prior = summary.byWeek[index - 1]!.durationSeconds;
    const current = summary.byWeek[index]!.durationSeconds;
    if (prior > 0 && current > prior * 1.25) {
      warnings.push({ code: "weekly_volume_jump", message: "Planned weekly duration increases by more than 25%" });
    }
  }
  const valid = errors.length === 0;
  return {
    valid,
    normalizedPlan,
    errors,
    warnings,
    summary,
    humanReadablePreview: preview(normalizedPlan),
    ...(valid && context.signer ? { validationToken: context.signer.sign(normalizedPlan) } : {}),
  };
}
