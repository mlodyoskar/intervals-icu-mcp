import { z } from "zod";

const NullableNumber = z.number().nullable();

export const WellnessSchema = z.object({
  date: z.string(),
  sleepSeconds: NullableNumber,
  hrv: NullableNumber,
  restingHeartRate: NullableNumber,
  weightKg: NullableNumber,
  fatigue: NullableNumber,
  stress: NullableNumber,
  soreness: NullableNumber,
  rpe: NullableNumber,
  spo2Percent: NullableNumber,
  steps: NullableNumber,
  ctl: NullableNumber,
  atl: NullableNumber,
  custom: z.record(z.string(), z.unknown()),
}).strict();

export type Wellness = z.infer<typeof WellnessSchema>;
