import type { IntervalsObject } from "./schemas.js";
import { stableHash } from "../workouts/hash.js";

const numberOrNull = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
const stringOrNull = (value: unknown): string | null => typeof value === "string" && value.length > 0 ? value : null;

export type NormalizedSport = "run" | "ride" | "strength" | "other";

export function normalizeSport(value: unknown): NormalizedSport {
  const sport = String(value ?? "").toLowerCase();
  if (sport.includes("run")) return "run";
  if (sport.includes("ride") || sport.includes("bike") || sport.includes("cycle")) return "ride";
  if (sport.includes("strength") || sport.includes("weight")) return "strength";
  return "other";
}

export function mapActivity(raw: IntervalsObject) {
  const speed = numberOrNull(raw.average_speed ?? raw.avg_speed);
  const sport = normalizeSport(raw.type ?? raw.sport);
  const plannedEventId = stringOrNull(raw.paired_event_id ?? raw.event_id);
  return {
    id: String(raw.id ?? ""),
    date: String(raw.start_date_local ?? raw.start_date ?? ""),
    name: String(raw.name ?? "Unnamed activity"),
    sport,
    durationSeconds: numberOrNull(raw.moving_time ?? raw.elapsed_time),
    distanceMeters: numberOrNull(raw.distance),
    averageSpeedMps: speed,
    averagePaceSecondsPerKm: sport === "run" && speed && speed > 0 ? 1000 / speed : null,
    heartRate: {
      average: numberOrNull(raw.average_heartrate ?? raw.avg_hr),
      maximum: numberOrNull(raw.max_heartrate ?? raw.max_hr),
    },
    elevationGainMeters: numberOrNull(raw.total_elevation_gain ?? raw.elevation_gain),
    trainingLoad: numberOrNull(raw.icu_training_load ?? raw.training_load),
    rpe: numberOrNull(raw.rpe ?? raw.session_rpe),
    note: stringOrNull(raw.athlete_comments ?? raw.description)?.slice(0, 500) ?? null,
    planVsActual: {
      plannedEventId,
      status: plannedEventId ? "matched" as const : "unmatched" as const,
    },
  };
}

export function mapActivityDetails(raw: IntervalsObject, includeIntervals: boolean) {
  const summary = mapActivity(raw);
  const intervals = includeIntervals && Array.isArray(raw.intervals) ? raw.intervals : [];
  const laps = includeIntervals && Array.isArray(raw.laps) ? raw.laps : [];
  return {
    ...summary,
    intervals,
    laps,
    zoneDistribution: raw.zone_times ?? raw.hr_zone_times ?? raw.power_zone_times ?? null,
    bestEfforts: Array.isArray(raw.best_efforts) ? raw.best_efforts : [],
    notes: stringOrNull(raw.athlete_comments ?? raw.description),
    completeness: {
      hasHeartRate: summary.heartRate.average !== null,
      hasPower: numberOrNull(raw.average_watts ?? raw.avg_power) !== null,
      hasIntervals: intervals.length > 0 || laps.length > 0,
      missing: [
        summary.heartRate.average === null ? "heartRate" : null,
        numberOrNull(raw.average_watts ?? raw.avg_power) === null ? "power" : null,
      ].filter((value): value is string => value !== null),
    },
  };
}

const wellnessKnownKeys = new Set([
  "id", "date", "sleepSecs", "sleep_seconds", "hrv", "hrvSDNN", "restingHR", "resting_hr",
  "weight", "fatigue", "stress", "soreness", "rpe",
]);

export function mapWellness(raw: IntervalsObject) {
  return {
    date: String(raw.id ?? raw.date ?? ""),
    sleepSeconds: numberOrNull(raw.sleepSecs ?? raw.sleep_seconds),
    hrv: numberOrNull(raw.hrv ?? raw.hrvSDNN),
    restingHeartRate: numberOrNull(raw.restingHR ?? raw.resting_hr),
    weightKg: numberOrNull(raw.weight),
    fatigue: numberOrNull(raw.fatigue),
    stress: numberOrNull(raw.stress),
    soreness: numberOrNull(raw.soreness),
    rpe: numberOrNull(raw.rpe),
    custom: Object.fromEntries(Object.entries(raw).filter(([key]) => !wellnessKnownKeys.has(key))),
  };
}

export function mapEvent(raw: IntervalsObject) {
  const description = stringOrNull(raw.description);
  const clientWorkoutId = description?.match(/^# clientWorkoutId=([^\n]+)/m)?.[1] ?? null;
  const stable = {
    id: String(raw.id ?? ""),
    date: String(raw.start_date_local ?? raw.start_date ?? ""),
    name: String(raw.name ?? "Unnamed event"),
    category: stringOrNull(raw.category ?? raw.type),
    sport: normalizeSport(raw.type ?? raw.sport),
    description,
    durationSeconds: numberOrNull(raw.moving_time),
    distanceMeters: numberOrNull(raw.distance),
    trainingLoad: numberOrNull(raw.icu_training_load ?? raw.training_load),
    clientWorkoutId,
  };
  return {
    ...stable,
    structuredWorkout: description,
    eventHash: stableHash(stable),
  };
}

export function mapAthlete(raw: IntervalsObject) {
  return {
    fitness: numberOrNull(raw.icu_ctl ?? raw.ctl),
    fatigue: numberOrNull(raw.icu_atl ?? raw.atl),
    form: numberOrNull(raw.icu_ts_b ?? raw.form),
    thresholds: {
      ftp: numberOrNull(raw.ftp),
      functionalThresholdHeartRate: numberOrNull(raw.lthr ?? raw.fthr),
      weightKg: numberOrNull(raw.weight),
    },
    zones: raw.sportSettings ?? raw.sport_settings ?? raw.zones ?? null,
  };
}
