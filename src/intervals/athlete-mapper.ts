import type { AthleteSummary } from "../coaching/model.js";
import { arrayOfNumbers, arrayOfStrings, numberOrNull, objectArray, roundedNumberOrNull, stringOrNull } from "./mapper-utils.js";
import type { AthleteResponse } from "./schemas.js";
import { normalizeSport } from "./sport.js";

export function mapAthlete(raw: AthleteResponse): AthleteSummary {
  const rawSportSettings = raw.sportSettings ?? raw.sport_settings ?? raw.zones ?? null;
  let settings = objectArray(rawSportSettings);
  if (!settings.length && [raw.ftp, raw.lthr, raw.max_hr, raw.threshold_pace].some((value) => numberOrNull(value) !== null)) {
    settings = [raw];
  }

  const sportProfiles = settings.map((setting) => {
    const sourceTypes = arrayOfStrings(setting.types);
    const sourceType = sourceTypes[0] ?? stringOrNull(setting.type ?? setting.sport) ?? "other";
    const thresholdPaceMps = numberOrNull(setting.threshold_pace);
    const zones = (values: unknown, names: unknown, unit: "percent_ftp" | "bpm" | "percent_threshold_pace") => {
      const boundaries = arrayOfNumbers(values);
      if (!boundaries.length) return null;
      const zoneNames = arrayOfStrings(names);
      return {
        unit,
        boundaries: boundaries.map((upperBound, index) => ({
          zone: index + 1,
          name: zoneNames[index] ?? `Zone ${index + 1}`,
          upperBound: unit !== "bpm" && upperBound >= 999 ? null : upperBound,
        })),
      };
    };
    return {
      sport: normalizeSport(sourceType),
      activityTypes: sourceTypes.length ? sourceTypes : [sourceType],
      thresholds: {
        ftpWatts: roundedNumberOrNull(setting.ftp),
        indoorFtpWatts: roundedNumberOrNull(setting.indoor_ftp),
        lthrBpm: roundedNumberOrNull(setting.lthr),
        maxHeartRateBpm: roundedNumberOrNull(setting.max_hr),
        thresholdPaceSecondsPerKm: thresholdPaceMps !== null && thresholdPaceMps > 0
          ? roundedNumberOrNull(1000 / thresholdPaceMps) : null,
      },
      zones: {
        power: zones(setting.power_zones, setting.power_zone_names, "percent_ftp"),
        heartRate: zones(setting.hr_zones, setting.hr_zone_names, "bpm"),
        pace: zones(setting.pace_zones, setting.pace_zone_names, "percent_threshold_pace"),
      },
      paceDisplayUnit: stringOrNull(setting.pace_units),
      source: "intervals_icu_sport_settings" as const,
      updatedAt: stringOrNull(setting.updated ?? setting.updated_at),
    };
  }).filter((profile) => Object.values(profile.thresholds).some((value) => value !== null)
    || Object.values(profile.zones).some((value) => value !== null));

  return {
    fitness: numberOrNull(raw.icu_ctl ?? raw.ctl),
    fatigue: numberOrNull(raw.icu_atl ?? raw.atl),
    form: numberOrNull(raw.icu_ts_b ?? raw.form),
    zonesAndThresholds: {
      sports: sportProfiles,
      weightKg: roundedNumberOrNull(raw.weight, 1),
    },
    rawSportSettings,
  };
}
