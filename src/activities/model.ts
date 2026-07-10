import { z } from "zod";

export const ACTIVITY_SPORTS = ["run", "ride", "strength", "swim", "walk", "hike", "climbing", "other"] as const;
export const ActivitySportSchema = z.enum(ACTIVITY_SPORTS);
export type NormalizedSport = z.infer<typeof ActivitySportSchema>;

const NullableNumber = z.number().nullable();
const NullableString = z.string().nullable();
const OffsetDateTime = z.string().regex(
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/,
  "Expected an ISO 8601 timestamp with a UTC offset",
);

export const ActivitySchema = z.object({
  id: z.string(),
  date: OffsetDateTime,
  name: z.string(),
  sport: ActivitySportSchema,
  activityType: z.string().describe("Normalized detailed source type, for example bouldering"),
  durationSeconds: NullableNumber,
  distanceMeters: NullableNumber,
  averageSpeedMps: NullableNumber.describe("Rounded to 0.01 m/s; null when speed does not apply"),
  averagePaceSecondsPerKm: NullableNumber.describe("Rounded to whole seconds per km; run activities only"),
  heartRate: z.object({ average: NullableNumber, maximum: NullableNumber }).strict(),
  elevationGainMeters: NullableNumber,
  trainingLoad: NullableNumber,
  rpe: NullableNumber.describe("Rate of perceived exertion on the 1-10 scale"),
  sessionRpeLoad: NullableNumber.describe("Session load calculated by Intervals.icu from RPE and duration; not an RPE score"),
  note: NullableString,
  planVsActual: z.object({
    plannedEventId: NullableString,
    status: z.enum(["matched", "not_planned", "planned_but_unmatched"]),
  }).strict(),
}).strict();

const RawMetricObjectSchema = z.record(z.string(), z.unknown());
const ZoneDistributionSchema = z.union([
  RawMetricObjectSchema,
  z.array(z.union([z.number(), z.null()])),
]).nullable();

export const ActivityDetailsSchema = ActivitySchema.extend({
  intervals: z.array(RawMetricObjectSchema),
  laps: z.array(RawMetricObjectSchema),
  zoneDistribution: ZoneDistributionSchema,
  bestEfforts: z.array(RawMetricObjectSchema),
  notes: NullableString,
  completeness: z.object({
    hasHeartRate: z.boolean(),
    hasPower: z.boolean(),
    hasIntervals: z.boolean(),
    missing: z.array(z.string()),
  }).strict(),
}).strict();

export type Activity = z.infer<typeof ActivitySchema>;
export type ActivityDetails = z.infer<typeof ActivityDetailsSchema>;
