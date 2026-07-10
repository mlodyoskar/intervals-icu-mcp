import { z } from "zod";

export const IntervalsObjectSchema = z.record(z.string(), z.unknown());
export const IntervalsListSchema = z.array(IntervalsObjectSchema);

export type IntervalsObject = z.infer<typeof IntervalsObjectSchema>;

const IdSchema = z.union([z.string(), z.number()]);
const OptionalNumber = z.number().nullable().optional();
const OptionalString = z.string().nullable().optional();

export const AthleteResponseSchema: z.ZodType<IntervalsObject> = z.object({
  id: IdSchema.optional(),
  icu_ctl: OptionalNumber,
  icu_atl: OptionalNumber,
  icu_ts_b: OptionalNumber,
  ftp: OptionalNumber,
  lthr: OptionalNumber,
  weight: OptionalNumber,
  sportSettings: z.unknown().optional(),
  sport_settings: z.unknown().optional(),
  zones: z.unknown().optional(),
}).passthrough();

export const ActivityResponseSchema: z.ZodType<IntervalsObject> = z.object({
  id: IdSchema.optional(),
  start_date_local: OptionalString,
  start_date: OptionalString,
  name: OptionalString,
  type: OptionalString,
  sport: OptionalString,
  moving_time: OptionalNumber,
  elapsed_time: OptionalNumber,
  distance: OptionalNumber,
  average_speed: OptionalNumber,
  average_heartrate: OptionalNumber,
  max_heartrate: OptionalNumber,
  total_elevation_gain: OptionalNumber,
  icu_training_load: OptionalNumber,
  rpe: OptionalNumber,
  intervals: z.array(z.unknown()).optional(),
  laps: z.array(z.unknown()).optional(),
  best_efforts: z.array(z.unknown()).optional(),
}).passthrough();

export const WellnessResponseSchema: z.ZodType<IntervalsObject> = z.object({
  id: OptionalString,
  date: OptionalString,
  sleepSecs: OptionalNumber,
  hrv: OptionalNumber,
  restingHR: OptionalNumber,
  weight: OptionalNumber,
  fatigue: OptionalNumber,
  stress: OptionalNumber,
  soreness: OptionalNumber,
  rpe: OptionalNumber,
}).passthrough();

export const EventResponseSchema: z.ZodType<IntervalsObject> = z.object({
  id: IdSchema.optional(),
  start_date_local: OptionalString,
  start_date: OptionalString,
  name: OptionalString,
  type: OptionalString,
  sport: OptionalString,
  category: OptionalString,
  description: OptionalString,
  moving_time: OptionalNumber,
  distance: OptionalNumber,
  icu_training_load: OptionalNumber,
}).passthrough();

export const ActivityListResponseSchema = z.array(ActivityResponseSchema);
export const WellnessListResponseSchema = z.array(WellnessResponseSchema);
export const EventListResponseSchema = z.array(EventResponseSchema);
export const EventWriteResponseSchema = EventResponseSchema;
