import { z } from "zod";
import { TrainingPlanSchema } from "./model.js";

const NullableString = z.string().nullable();

const ValidationIssueSchema = z.object({
  code: z.string(),
  message: z.string(),
  path: z.string().optional(),
  workoutId: z.string().optional(),
}).strict();

const PlanSummarySchema = z.object({
  workoutCount: z.number().int(),
  totalDurationSeconds: z.number(),
  totalDistanceMeters: z.number(),
  byWeek: z.array(z.object({
    weekStart: z.string(),
    workouts: z.number().int(),
    durationSeconds: z.number(),
    distanceMeters: z.number(),
  }).strict()),
}).strict();

export const ValidationResultSchema = z.object({
  valid: z.boolean(),
  normalizedPlan: TrainingPlanSchema.nullable(),
  errors: z.array(ValidationIssueSchema),
  warnings: z.array(ValidationIssueSchema),
  summary: PlanSummarySchema,
  humanReadablePreview: z.string(),
  validationToken: z.string().optional(),
}).strict();

export const ApplyResultSchema = z.object({
  partial: z.boolean(),
  results: z.array(z.object({
    clientWorkoutId: z.string(),
    status: z.enum(["created", "updated", "unchanged", "conflict", "failed"]),
    eventId: NullableString,
    eventHash: NullableString,
    message: z.string(),
  }).strict()),
}).strict();

export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;
export type PlanSummary = z.infer<typeof PlanSummarySchema>;
export type ValidationResult = z.infer<typeof ValidationResultSchema>;
export type ApplyResult = z.infer<typeof ApplyResultSchema>;
