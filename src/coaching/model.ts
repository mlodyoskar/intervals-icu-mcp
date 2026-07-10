import { z } from "zod";
import { ActivitySchema, ActivitySportSchema } from "../activities/model.js";
import { CalendarEventSchema } from "../calendar/model.js";
import { TrainingProfileSchema } from "../config/profile.js";
import { WellnessSchema } from "../wellness/model.js";

const NullableNumber = z.number().nullable();
const NullableString = z.string().nullable();

const ZoneSeriesSchema = z.object({
  unit: z.enum(["percent_ftp", "bpm", "percent_threshold_pace"]),
  boundaries: z.array(z.object({
    zone: z.number().int().positive(),
    name: z.string(),
    upperBound: NullableNumber,
  }).strict()),
}).strict();

const SportProfileSchema = z.object({
  sport: ActivitySportSchema,
  activityTypes: z.array(z.string()),
  thresholds: z.object({
    ftpWatts: NullableNumber,
    indoorFtpWatts: NullableNumber,
    lthrBpm: NullableNumber,
    maxHeartRateBpm: NullableNumber,
    thresholdPaceSecondsPerKm: NullableNumber,
  }).strict(),
  zones: z.object({
    power: ZoneSeriesSchema.nullable(),
    heartRate: ZoneSeriesSchema.nullable(),
    pace: ZoneSeriesSchema.nullable(),
  }).strict(),
  paceDisplayUnit: NullableString,
  source: z.literal("intervals_icu_sport_settings"),
  updatedAt: NullableString,
}).strict();

const TrainingWellnessSchema = WellnessSchema.omit({ custom: true });

export const TrainingContextSchema = z.object({
  timezone: z.string(),
  period: z.object({ historyStart: z.string(), today: z.string(), futureEnd: z.string() }).strict(),
  trainingProfile: TrainingProfileSchema.nullable(),
  zonesAndThresholds: z.object({
    sports: z.array(SportProfileSchema),
    weightKg: NullableNumber,
    raw: z.unknown().optional(),
  }).strict(),
  fitnessFatigueForm: z.object({
    fitness: NullableNumber,
    fatigue: NullableNumber,
    form: NullableNumber.describe("Training stress balance calculated as fitness (CTL) minus fatigue (ATL) when not supplied upstream"),
    source: z.enum(["athlete", "wellness", "mixed"]).nullable(),
  }).strict(),
  weeklyVolume: z.array(z.object({
    weekStart: z.string(),
    isPartial: z.boolean(),
    coveredFrom: z.string(),
    coveredTo: z.string(),
    durationSeconds: z.number(),
    distanceMeters: z.number(),
    trainingLoad: z.number(),
    activityCount: z.number().int(),
  }).strict()),
  recentActivities: z.object({
    items: z.array(ActivitySchema),
    sort: z.literal("date_desc"),
    limit: z.number().int().positive(),
    totalInWindow: z.number().int().nonnegative(),
    truncated: z.boolean(),
  }).strict(),
  wellnessTrends: z.object({
    coverage: z.object({
      windowDays: z.number().int().positive(),
      recordsAvailable: z.number().int().nonnegative(),
      sleepDays: z.number().int().nonnegative(),
      restingHeartRateDays: z.number().int().nonnegative(),
      hrvDays: z.number().int().nonnegative(),
      fatigueDays: z.number().int().nonnegative(),
      spo2Days: z.number().int().nonnegative(),
      stepsDays: z.number().int().nonnegative(),
    }).strict(),
    averages: z.object({ sleepSeconds: NullableNumber, hrv: NullableNumber, restingHeartRate: NullableNumber, fatigue: NullableNumber }).strict(),
    latest: TrainingWellnessSchema.nullable(),
  }).strict(),
  futureCalendar: z.array(CalendarEventSchema),
  missingData: z.array(z.object({
    field: z.string(),
    reason: z.enum(["upstream_unavailable", "not_configured", "not_recorded"]),
  }).strict()),
}).strict();

export interface AthleteSummary {
  fitness: number | null;
  fatigue: number | null;
  form: number | null;
  zonesAndThresholds: {
    sports: z.infer<typeof SportProfileSchema>[];
    weightKg: number | null;
  };
  rawSportSettings: unknown;
}
export type TrainingContext = z.infer<typeof TrainingContextSchema>;
