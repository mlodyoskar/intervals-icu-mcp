import { DateTime } from "luxon";
import type { Activity, ActivityDetails } from "../activities/model.js";
import type { ActivityResponse } from "./schemas.js";
import { numberOrNull, objectArray, roundedNumberOrNull, rpeOrNull, stringOrNull } from "./mapper-utils.js";
import { normalizeActivityType, normalizeSport } from "./sport.js";

function activityDate(raw: ActivityResponse, timezone: string): string {
  const local = stringOrNull(raw.start_date_local);
  const absolute = stringOrNull(raw.start_date);
  const value = local ?? absolute ?? "";
  if (!value) return value;
  const parsed = local
    ? DateTime.fromISO(local, { zone: timezone })
    : DateTime.fromISO(value, { setZone: true }).setZone(timezone);
  if (!parsed.isValid) return value;
  return parsed.toISO({ suppressMilliseconds: true }) ?? value;
}

export function mapActivity(raw: ActivityResponse, timezone: string): Activity {
  const speed = numberOrNull(raw.average_speed ?? raw.avg_speed);
  const sourceType = raw.type ?? raw.sport;
  const sport = normalizeSport(sourceType);
  const speedApplies = ["run", "ride", "swim", "walk", "hike"].includes(sport);
  const averageSpeedMps = speedApplies && speed !== null && speed > 0 ? roundedNumberOrNull(speed, 2) : null;
  const plannedEventId = stringOrNull(raw.paired_event_id ?? raw.event_id);
  const compliance = numberOrNull(raw.compliance);
  return {
    id: String(raw.id ?? ""),
    date: activityDate(raw, timezone),
    name: String(raw.name ?? "Unnamed activity"),
    sport,
    activityType: normalizeActivityType(sourceType),
    durationSeconds: roundedNumberOrNull(raw.moving_time ?? raw.elapsed_time),
    distanceMeters: roundedNumberOrNull(raw.distance),
    averageSpeedMps,
    averagePaceSecondsPerKm: sport === "run" && speed && speed > 0 ? roundedNumberOrNull(1000 / speed) : null,
    heartRate: {
      average: roundedNumberOrNull(raw.average_heartrate ?? raw.avg_hr),
      maximum: roundedNumberOrNull(raw.max_heartrate ?? raw.max_hr),
    },
    elevationGainMeters: roundedNumberOrNull(raw.total_elevation_gain ?? raw.elevation_gain, 1),
    trainingLoad: roundedNumberOrNull(raw.icu_training_load ?? raw.training_load, 1),
    rpe: rpeOrNull(raw.icu_rpe ?? raw.perceived_exertion ?? raw.rpe),
    sessionRpeLoad: roundedNumberOrNull(raw.session_rpe, 1),
    note: stringOrNull(raw.athlete_comments ?? raw.description)?.slice(0, 500) ?? null,
    planVsActual: {
      plannedEventId,
      status: plannedEventId ? "matched"
        : compliance === null ? "not_planned" : "planned_but_unmatched",
    },
  };
}

function zoneDistribution(value: unknown): ActivityDetails["zoneDistribution"] {
  if (Array.isArray(value)) {
    const entries: unknown[] = value;
    if (entries.every((entry): entry is number | null => entry === null || typeof entry === "number")) {
      return entries;
    }
  }
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function mapActivityDetails(raw: ActivityResponse, includeIntervals: boolean, timezone: string): ActivityDetails {
  const summary = mapActivity(raw, timezone);
  const intervals = includeIntervals ? objectArray(raw.intervals) : [];
  const laps = includeIntervals ? objectArray(raw.laps) : [];
  const hasPower = numberOrNull(raw.average_watts ?? raw.avg_power) !== null;
  return {
    ...summary,
    intervals,
    laps,
    zoneDistribution: zoneDistribution(raw.zone_times ?? raw.hr_zone_times ?? raw.power_zone_times),
    bestEfforts: objectArray(raw.best_efforts),
    notes: stringOrNull(raw.athlete_comments ?? raw.description),
    completeness: {
      hasHeartRate: summary.heartRate.average !== null,
      hasPower,
      hasIntervals: intervals.length > 0 || laps.length > 0,
      missing: [summary.heartRate.average === null ? "heartRate" : null, !hasPower ? "power" : null]
        .filter((value): value is string => value !== null),
    },
  };
}
