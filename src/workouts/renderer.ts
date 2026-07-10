import type { Target, Workout, WorkoutStep } from "./model.js";

function formatDuration(seconds?: number, meters?: number): string {
  if (seconds !== undefined) {
    if (seconds % 3600 === 0) return `${seconds / 3600}h`;
    if (seconds % 60 === 0) return `${seconds / 60}m`;
    return `${seconds}s`;
  }
  if (meters !== undefined && meters % 1000 === 0) return `${meters / 1000}km`;
  return `${meters}m`;
}

function renderTarget(target: Target): string {
  switch (target.type) {
    case "open": return "";
    case "heart_rate_zone": return ` HR Z${target.zone}`;
    case "pace_zone": return ` Pace Z${target.zone}`;
    case "power_zone": return ` Power Z${target.zone}`;
    case "heart_rate_range": return ` HR ${target.min}-${target.max}`;
    case "pace_range": return ` Pace ${target.min}-${target.max}`;
    case "power_range": return ` ${target.min}-${target.max}w`;
    case "cadence": return ` ${target.min}-${target.max}rpm`;
  }
}

function renderStep(step: WorkoutStep, indent = ""): string[] {
  if (step.type === "repeat") {
    return [`${indent}- ${step.repetitions}x`, ...step.steps.flatMap((nested) => renderStep(nested, `${indent}  `))];
  }
  const label = step.type === "steady" ? "" : ` ${step.type}`;
  const notes = step.notes ? ` ${step.notes.replace(/\s+/g, " ").trim()}` : "";
  return [`${indent}- ${formatDuration(step.durationSeconds, step.distanceMeters)}${label}${renderTarget(step.target)}${notes}`];
}

export interface RenderedEvent {
  start_date_local: string;
  name: string;
  type: "Run" | "Ride" | "Workout";
  category: "WORKOUT";
  description: string;
  moving_time?: number;
  distance?: number;
}

export function renderWorkout(workout: Workout): RenderedEvent {
  const header = `# clientWorkoutId=${workout.clientWorkoutId}`;
  const structure = workout.steps?.flatMap((step) => renderStep(step)).join("\n") ?? "";
  const description = [header, workout.intent, structure, workout.athleteNotes].filter(Boolean).join("\n\n");
  const movingTime = workout.steps ? totalDuration(workout.steps) : undefined;
  const distance = workout.steps ? totalDistance(workout.steps) : undefined;
  return {
    start_date_local: workout.date,
    name: workout.name,
    type: workout.sport === "run" ? "Run" : workout.sport === "ride" ? "Ride" : "Workout",
    category: "WORKOUT",
    description,
    ...(movingTime ? { moving_time: movingTime } : {}),
    ...(distance ? { distance } : {}),
  };
}

export function totalDuration(steps: WorkoutStep[]): number {
  return steps.reduce((sum, step) => sum + (step.type === "repeat"
    ? step.repetitions * totalDuration(step.steps)
    : (step.durationSeconds ?? 0)), 0);
}

export function totalDistance(steps: WorkoutStep[]): number {
  return steps.reduce((sum, step) => sum + (step.type === "repeat"
    ? step.repetitions * totalDistance(step.steps)
    : (step.distanceMeters ?? 0)), 0);
}
