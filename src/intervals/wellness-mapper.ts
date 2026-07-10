import type { Wellness } from "../wellness/model.js";
import type { WellnessResponse } from "./schemas.js";
import { numberOrNull, roundedNumberOrNull, rpeOrNull } from "./mapper-utils.js";

const wellnessKnownKeys = new Set([
  "id", "date", "sleepSecs", "sleep_seconds", "hrv", "hrvSDNN", "restingHR", "resting_hr",
  "weight", "fatigue", "stress", "soreness", "rpe", "ctl", "icu_ctl", "atl", "icu_atl",
  "spo2", "spO2", "spO2Avg", "steps",
]);

export function mapWellness(raw: WellnessResponse): Wellness {
  return {
    date: String(raw.id ?? raw.date ?? ""),
    sleepSeconds: numberOrNull(raw.sleepSecs ?? raw.sleep_seconds),
    hrv: numberOrNull(raw.hrv ?? raw.hrvSDNN),
    restingHeartRate: numberOrNull(raw.restingHR ?? raw.resting_hr),
    weightKg: numberOrNull(raw.weight),
    fatigue: numberOrNull(raw.fatigue),
    stress: numberOrNull(raw.stress),
    soreness: numberOrNull(raw.soreness),
    rpe: rpeOrNull(raw.rpe),
    spo2Percent: roundedNumberOrNull(raw.spo2 ?? raw.spO2 ?? raw.spO2Avg, 1),
    steps: roundedNumberOrNull(raw.steps),
    ctl: roundedNumberOrNull(raw.ctl ?? raw.icu_ctl, 2),
    atl: roundedNumberOrNull(raw.atl ?? raw.icu_atl, 2),
    custom: Object.fromEntries(Object.entries(raw).filter(([key]) => !wellnessKnownKeys.has(key))),
  };
}
