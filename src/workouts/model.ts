import { z } from "zod";
import { IsoDateSchema } from "../coaching/dates.js";

export const PlanSportSchema = z.enum(["run", "ride", "strength", "recovery"]);

const TargetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("open") }).strict(),
  z.object({ type: z.enum(["heart_rate_zone", "pace_zone", "power_zone"]), zone: z.number().int().min(1).max(7) }).strict(),
  z.object({ type: z.enum(["heart_rate_range", "pace_range", "power_range"]), min: z.number().positive(), max: z.number().positive() }).strict()
    .refine((v) => v.max > v.min, { message: "max must be greater than min" }),
  z.object({ type: z.literal("cadence"), min: z.number().positive(), max: z.number().positive() }).strict()
    .refine((v) => v.max >= v.min, { message: "max must be at least min" }),
]);

const TimedStepSchema = z.object({
  type: z.enum(["warmup", "steady", "interval", "recovery", "cooldown", "open"]),
  durationSeconds: z.number().int().positive().optional(),
  distanceMeters: z.number().positive().optional(),
  target: TargetSchema.default({ type: "open" }),
  notes: z.string().max(500).optional(),
}).strict().refine((step) => step.durationSeconds !== undefined || step.distanceMeters !== undefined, {
  message: "A step needs durationSeconds or distanceMeters",
});

export type WorkoutStep = z.infer<typeof TimedStepSchema> | {
  type: "repeat";
  repetitions: number;
  steps: WorkoutStep[];
};

const WorkoutStepSchema: z.ZodType<WorkoutStep> = z.lazy(() => z.union([
  TimedStepSchema,
  z.object({
    type: z.literal("repeat"),
    repetitions: z.number().int().min(1).max(20),
    steps: z.array(WorkoutStepSchema).min(1).max(20),
  }).strict(),
]));

const WorkoutSchema = z.object({
  clientWorkoutId: z.string().min(1).max(100).regex(/^[A-Za-z0-9._:-]+$/),
  date: IsoDateSchema,
  sport: PlanSportSchema,
  name: z.string().min(1).max(160),
  intent: z.string().max(1000).optional(),
  steps: z.array(WorkoutStepSchema).max(50).optional(),
  athleteNotes: z.string().max(4000).optional(),
  expectedEventHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).strict().superRefine((workout, ctx) => {
  if (workout.sport === "strength" && workout.steps?.length) {
    ctx.addIssue({ code: "custom", path: ["steps"], message: "Strength workouts use athleteNotes in the MVP" });
  }
});

export const TrainingPlanSchema = z.object({
  planId: z.string().min(1).max(100).regex(/^[A-Za-z0-9._:-]+$/),
  timezone: z.string().min(1),
  workouts: z.array(WorkoutSchema).max(14),
}).strict();

export type TrainingPlan = z.infer<typeof TrainingPlanSchema>;
export type Workout = z.infer<typeof WorkoutSchema>;
export type Target = z.infer<typeof TargetSchema>;
