import { DateTime } from "luxon";
import type { Activity, NormalizedSport } from "../activities/model.js";
import type { CalendarEvent } from "../calendar/model.js";
import type { TrainingProfile } from "../config/profile.js";
import type { Wellness } from "../wellness/model.js";
import type { AthleteSummary, TrainingContext } from "./model.js";

const RECENT_ACTIVITIES_LIMIT = 20;

function iso(date: DateTime): string {
  return date.toISODate()!;
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function contextPeriod(timezone: string, historyDays: number, futureDays: number, now?: DateTime) {
  const todayDate = (now ?? DateTime.now()).setZone(timezone).startOf("day");
  return {
    now: todayDate,
    historyStart: iso(todayDate.minus({ days: historyDays - 1 })),
    today: iso(todayDate),
    futureEnd: iso(todayDate.plus({ days: futureDays })),
  };
}

function calculateWeeklyVolume(
  activities: Activity[],
  timezone: string,
  historyStart: string,
  today: string,
): TrainingContext["weeklyVolume"] {
  const weekly = new Map<string, { durationSeconds: number; distanceMeters: number; trainingLoad: number; activityCount: number }>();
  for (const activity of activities) {
    const date = DateTime.fromISO(activity.date, { setZone: true }).setZone(timezone);
    if (!date.isValid) continue;
    const week = date.startOf("week").toISODate();
    const value = weekly.get(week) ?? { durationSeconds: 0, distanceMeters: 0, trainingLoad: 0, activityCount: 0 };
    value.durationSeconds += activity.durationSeconds ?? 0;
    value.distanceMeters += activity.distanceMeters ?? 0;
    value.trainingLoad += activity.trainingLoad ?? 0;
    value.activityCount += 1;
    weekly.set(week, value);
  }

  return [...weekly.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([weekStart, value]) => {
    const start = DateTime.fromISO(weekStart, { zone: timezone });
    const end = start.endOf("week");
    const coveredFrom = historyStart > iso(start) ? historyStart : iso(start);
    const coveredTo = today < iso(end) ? today : iso(end);
    return {
      weekStart,
      isPartial: coveredFrom !== iso(start) || coveredTo !== iso(end),
      coveredFrom,
      coveredTo,
      ...value,
      distanceMeters: round(value.distanceMeters),
      trainingLoad: round(value.trainingLoad),
    };
  });
}

function calculateWellnessTrends(wellness: Wellness[], historyDays: number): TrainingContext["wellnessTrends"] {
  const wellnessDescending = [...wellness].sort((a, b) => b.date.localeCompare(a.date));
  const average = (key: "sleepSeconds" | "hrv" | "restingHeartRate" | "fatigue") => {
    const values = wellness.map((entry) => entry[key]).filter((value): value is number => value !== null);
    return values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
  };
  const count = (key: "sleepSeconds" | "hrv" | "restingHeartRate" | "fatigue" | "spo2Percent" | "steps") =>
    wellness.filter((entry) => entry[key] !== null).length;
  const latestWellness = wellnessDescending[0];
  return {
    coverage: {
      windowDays: historyDays,
      recordsAvailable: wellness.length,
      sleepDays: count("sleepSeconds"),
      restingHeartRateDays: count("restingHeartRate"),
      hrvDays: count("hrv"),
      fatigueDays: count("fatigue"),
      spo2Days: count("spo2Percent"),
      stepsDays: count("steps"),
    },
    averages: {
      sleepSeconds: average("sleepSeconds"),
      hrv: average("hrv"),
      restingHeartRate: average("restingHeartRate"),
      fatigue: average("fatigue"),
    },
    latest: latestWellness ? {
      date: latestWellness.date,
      sleepSeconds: latestWellness.sleepSeconds,
      hrv: latestWellness.hrv,
      restingHeartRate: latestWellness.restingHeartRate,
      weightKg: latestWellness.weightKg,
      fatigue: latestWellness.fatigue,
      stress: latestWellness.stress,
      soreness: latestWellness.soreness,
      rpe: latestWellness.rpe,
      spo2Percent: latestWellness.spo2Percent,
      steps: latestWellness.steps,
      ctl: latestWellness.ctl,
      atl: latestWellness.atl,
    } : null,
  };
}

function calculateFitnessState(athlete: AthleteSummary | null, wellness: Wellness[]): TrainingContext["fitnessFatigueForm"] {
  const wellnessFitness = [...wellness].sort((a, b) => b.date.localeCompare(a.date))
    .find((entry) => entry.ctl !== null || entry.atl !== null);
  const fitness = athlete?.fitness ?? wellnessFitness?.ctl ?? null;
  const fatigue = athlete?.fatigue ?? wellnessFitness?.atl ?? null;
  const form = athlete?.form ?? (fitness !== null && fatigue !== null ? round(fitness - fatigue) : null);
  const sources = [
    athlete?.fitness !== null && athlete?.fitness !== undefined ? "athlete" : wellnessFitness?.ctl !== null && wellnessFitness?.ctl !== undefined ? "wellness" : null,
    athlete?.fatigue !== null && athlete?.fatigue !== undefined ? "athlete" : wellnessFitness?.atl !== null && wellnessFitness?.atl !== undefined ? "wellness" : null,
    athlete?.form !== null && athlete?.form !== undefined ? "athlete" : form !== null ? "derived" : null,
  ].filter((source): source is "athlete" | "wellness" | "derived" => source !== null);
  const source = sources.length === 0 ? null
    : sources.every((entry) => entry === "athlete") ? "athlete"
      : sources.every((entry) => entry === "wellness" || entry === "derived") ? "wellness" : "mixed";
  return { fitness, fatigue, form, source };
}

export function buildTrainingContext(options: {
  timezone: string;
  profile: TrainingProfile | null;
  historyDays: number;
  futureDays: number;
  sports?: NormalizedSport[];
  includeRawZones?: boolean;
  now?: DateTime;
  athlete: AthleteSummary | null;
  activities: Activity[];
  wellness: Wellness[];
  calendar: CalendarEvent[];
  availability: { athlete: boolean; activities: boolean; wellness: boolean; calendar: boolean };
}): TrainingContext {
  const period = contextPeriod(options.timezone, options.historyDays, options.futureDays, options.now);
  const missingData: TrainingContext["missingData"] = [];
  const missing = (field: string, reason: TrainingContext["missingData"][number]["reason"]) => {
    if (!missingData.some((entry) => entry.field === field)) missingData.push({ field, reason });
  };

  if (!options.availability.athlete) missing("zonesAndThresholds", "upstream_unavailable");
  if (!options.availability.activities) missing("recentActivities", "upstream_unavailable");
  if (!options.availability.wellness) missing("wellnessTrends", "upstream_unavailable");
  if (!options.availability.calendar) missing("futureCalendar", "upstream_unavailable");
  if (!options.profile) missing("trainingProfile", "not_configured");
  else if (options.profile.injuryContext === null) missing("trainingProfile.injuryContext", "not_configured");

  const filteredActivities = options.sports?.length
    ? options.activities.filter((activity) => options.sports!.includes(activity.sport))
    : options.activities;
  const wellnessDescending = [...options.wellness].sort((a, b) => b.date.localeCompare(a.date));
  const wellnessWeight = wellnessDescending.find((entry) => entry.weightKg !== null)?.weightKg ?? null;
  const zonesAndThresholds: TrainingContext["zonesAndThresholds"] = {
    sports: options.athlete?.zonesAndThresholds.sports ?? [],
    weightKg: options.athlete?.zonesAndThresholds.weightKg ?? wellnessWeight,
    ...(options.includeRawZones && options.athlete ? { raw: options.athlete.rawSportSettings } : {}),
  };
  if (options.athlete && !options.athlete.zonesAndThresholds.sports.length) missing("zonesAndThresholds.sports", "not_configured");
  for (const sport of options.athlete?.zonesAndThresholds.sports ?? []) {
    if (Object.values(sport.thresholds).every((value) => value === null)) {
      missing(`zonesAndThresholds.sports.${sport.sport}.thresholds`, "not_configured");
    }
    if (Object.values(sport.zones).every((value) => value === null)) {
      missing(`zonesAndThresholds.sports.${sport.sport}.zones`, "not_configured");
    }
  }
  if (zonesAndThresholds.weightKg === null) missing("zonesAndThresholds.weightKg", "not_recorded");

  const fitnessFatigueForm = calculateFitnessState(options.athlete, options.wellness);
  if (fitnessFatigueForm.fitness === null) missing("fitnessFatigueForm.fitness", "not_recorded");
  if (fitnessFatigueForm.fatigue === null) missing("fitnessFatigueForm.fatigue", "not_recorded");
  if (fitnessFatigueForm.form === null) missing("fitnessFatigueForm.form", "not_recorded");

  const wellnessTrends = calculateWellnessTrends(options.wellness, options.historyDays);
  if (options.availability.wellness) {
    if (!wellnessTrends.coverage.sleepDays) missing("wellness.sleep", "not_recorded");
    if (!wellnessTrends.coverage.restingHeartRateDays) missing("wellness.restingHeartRate", "not_recorded");
    if (!wellnessTrends.coverage.hrvDays) missing("wellness.hrv", "not_recorded");
    if (!wellnessTrends.coverage.fatigueDays) missing("wellness.fatigue", "not_recorded");
  }

  const sortedActivities = [...filteredActivities].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  return {
    timezone: options.timezone,
    period: { historyStart: period.historyStart, today: period.today, futureEnd: period.futureEnd },
    trainingProfile: options.profile,
    zonesAndThresholds,
    fitnessFatigueForm,
    weeklyVolume: calculateWeeklyVolume(filteredActivities, options.timezone, period.historyStart, period.today),
    recentActivities: {
      items: sortedActivities.slice(0, RECENT_ACTIVITIES_LIMIT),
      sort: "date_desc",
      limit: RECENT_ACTIVITIES_LIMIT,
      totalInWindow: sortedActivities.length,
      truncated: sortedActivities.length > RECENT_ACTIVITIES_LIMIT,
    },
    wellnessTrends,
    futureCalendar: options.calendar,
    missingData,
  };
}
