import { DateTime } from "luxon";
import type { TrainingProfile } from "../config/profile.js";
import type { IntervalsClientContract } from "../intervals/client.js";
import { mapActivity, mapAthlete, mapEvent, mapWellness } from "../intervals/mappers.js";

function iso(date: DateTime): string {
  return date.toISODate()!;
}

export async function getTrainingContext(options: {
  client: IntervalsClientContract;
  timezone: string;
  profile: TrainingProfile | null;
  historyDays: number;
  futureDays: number;
  sports?: Array<"run" | "ride" | "strength">;
  now?: DateTime;
}) {
  const now = (options.now ?? DateTime.now()).setZone(options.timezone).startOf("day");
  const historyStart = iso(now.minus({ days: options.historyDays - 1 }));
  const today = iso(now);
  const futureEnd = iso(now.plus({ days: options.futureDays }));
  const [athleteResult, activitiesResult, wellnessResult, eventsResult] = await Promise.allSettled([
    options.client.getAthlete(),
    options.client.listActivities(historyStart, today),
    options.client.listWellness(historyStart, today),
    options.client.listEvents(today, futureEnd),
  ]);
  const missingData: string[] = [];
  const athlete = athleteResult.status === "fulfilled" ? mapAthlete(athleteResult.value) : null;
  if (!athlete) missingData.push("athlete_zones_thresholds_fitness");
  let activities = activitiesResult.status === "fulfilled" ? activitiesResult.value.map(mapActivity) : [];
  if (activitiesResult.status === "rejected") missingData.push("activities");
  if (options.sports?.length) activities = activities.filter((activity) => options.sports!.includes(activity.sport as "run" | "ride" | "strength"));
  const wellness = wellnessResult.status === "fulfilled" ? wellnessResult.value.map(mapWellness) : [];
  if (wellnessResult.status === "rejected") missingData.push("wellness");
  const calendar = eventsResult.status === "fulfilled" ? eventsResult.value.map(mapEvent) : [];
  if (eventsResult.status === "rejected") missingData.push("calendar");
  if (!options.profile) missingData.push("training_profile");

  const weekly = new Map<string, { durationSeconds: number; distanceMeters: number; trainingLoad: number; activityCount: number }>();
  for (const activity of activities) {
    const date = DateTime.fromISO(activity.date, { zone: options.timezone });
    if (!date.isValid) continue;
    const week = date.startOf("week").toISODate()!;
    const value = weekly.get(week) ?? { durationSeconds: 0, distanceMeters: 0, trainingLoad: 0, activityCount: 0 };
    value.durationSeconds += activity.durationSeconds ?? 0;
    value.distanceMeters += activity.distanceMeters ?? 0;
    value.trainingLoad += activity.trainingLoad ?? 0;
    value.activityCount += 1;
    weekly.set(week, value);
  }

  const wellnessAverage = (key: "sleepSeconds" | "hrv" | "restingHeartRate" | "fatigue") => {
    const values = wellness.map((entry) => entry[key]).filter((value): value is number => value !== null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  };

  return {
    timezone: options.timezone,
    period: { historyStart, today, futureEnd },
    trainingProfile: options.profile,
    zonesAndThresholds: athlete ? { zones: athlete.zones, thresholds: athlete.thresholds } : null,
    fitnessFatigueForm: athlete ? { fitness: athlete.fitness, fatigue: athlete.fatigue, form: athlete.form } : null,
    weeklyVolume: [...weekly.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([weekStart, value]) => ({ weekStart, ...value })),
    recentActivities: activities.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20),
    wellnessTrends: {
      daysAvailable: wellness.length,
      averages: {
        sleepSeconds: wellnessAverage("sleepSeconds"),
        hrv: wellnessAverage("hrv"),
        restingHeartRate: wellnessAverage("restingHeartRate"),
        fatigue: wellnessAverage("fatigue"),
      },
      latest: wellness.sort((a, b) => b.date.localeCompare(a.date))[0] ?? null,
    },
    futureCalendar: calendar,
    missingData,
  };
}
