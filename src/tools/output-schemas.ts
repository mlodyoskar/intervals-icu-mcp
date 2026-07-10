import { z } from "zod";
import { TrainingProfileSchema } from "../config/profile.js";
import { TrainingPlanSchema } from "../workouts/model.js";

const NullableNumber = z.number().nullable();
const NullableString = z.string().nullable();

export const ActivityOutputSchema = z.object({
  id: z.string(),
  date: z.string(),
  name: z.string(),
  sport: z.enum(["run", "ride", "strength", "other"]),
  durationSeconds: NullableNumber,
  distanceMeters: NullableNumber,
  averageSpeedMps: NullableNumber,
  averagePaceSecondsPerKm: NullableNumber,
  heartRate: z.object({ average: NullableNumber, maximum: NullableNumber }).strict(),
  elevationGainMeters: NullableNumber,
  trainingLoad: NullableNumber,
  rpe: NullableNumber,
  note: NullableString,
  planVsActual: z.object({ plannedEventId: NullableString, status: z.enum(["matched", "unmatched"]) }).strict(),
}).strict();

export const WellnessOutputSchema = z.object({
  date: z.string(),
  sleepSeconds: NullableNumber,
  hrv: NullableNumber,
  restingHeartRate: NullableNumber,
  weightKg: NullableNumber,
  fatigue: NullableNumber,
  stress: NullableNumber,
  soreness: NullableNumber,
  rpe: NullableNumber,
  custom: z.record(z.string(), z.unknown()),
}).strict();

export const EventOutputSchema = z.object({
  id: z.string(),
  date: z.string(),
  name: z.string(),
  category: NullableString,
  sport: z.enum(["run", "ride", "strength", "other"]),
  description: NullableString,
  durationSeconds: NullableNumber,
  distanceMeters: NullableNumber,
  trainingLoad: NullableNumber,
  clientWorkoutId: NullableString,
  structuredWorkout: NullableString,
  eventHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

export const TrainingContextOutputSchema = z.object({
  timezone: z.string(),
  period: z.object({ historyStart: z.string(), today: z.string(), futureEnd: z.string() }).strict(),
  trainingProfile: TrainingProfileSchema.nullable(),
  zonesAndThresholds: z.object({
    zones: z.unknown().nullable(),
    thresholds: z.object({ ftp: NullableNumber, functionalThresholdHeartRate: NullableNumber, weightKg: NullableNumber }).strict(),
  }).strict().nullable(),
  fitnessFatigueForm: z.object({ fitness: NullableNumber, fatigue: NullableNumber, form: NullableNumber }).strict().nullable(),
  weeklyVolume: z.array(z.object({
    weekStart: z.string(), durationSeconds: z.number(), distanceMeters: z.number(), trainingLoad: z.number(), activityCount: z.number().int(),
  }).strict()),
  recentActivities: z.array(ActivityOutputSchema),
  wellnessTrends: z.object({
    daysAvailable: z.number().int(),
    averages: z.object({ sleepSeconds: NullableNumber, hrv: NullableNumber, restingHeartRate: NullableNumber, fatigue: NullableNumber }).strict(),
    latest: WellnessOutputSchema.nullable(),
  }).strict(),
  futureCalendar: z.array(EventOutputSchema),
  missingData: z.array(z.string()),
}).strict();

const ValidationIssueSchema = z.object({
  code: z.string(), message: z.string(), path: z.string().optional(), workoutId: z.string().optional(),
}).strict();
const PlanSummarySchema = z.object({
  workoutCount: z.number().int(),
  totalDurationSeconds: z.number(),
  totalDistanceMeters: z.number(),
  byWeek: z.array(z.object({
    weekStart: z.string(), workouts: z.number().int(), durationSeconds: z.number(), distanceMeters: z.number(),
  }).strict()),
}).strict();

export const ValidationOutputSchema = z.object({
  valid: z.boolean(),
  normalizedPlan: TrainingPlanSchema.nullable(),
  errors: z.array(ValidationIssueSchema),
  warnings: z.array(ValidationIssueSchema),
  summary: PlanSummarySchema,
  humanReadablePreview: z.string(),
  validationToken: z.string().optional(),
}).strict();

export const ApplyOutputSchema = z.object({
  partial: z.boolean(),
  results: z.array(z.object({
    clientWorkoutId: z.string(),
    status: z.enum(["created", "updated", "unchanged", "conflict", "failed"]),
    eventId: NullableString,
    eventHash: NullableString,
    message: z.string(),
  }).strict()),
}).strict();

export function envelope<T extends z.ZodType>(schema: T) {
  return z.object({ data: schema }).strict();
}
