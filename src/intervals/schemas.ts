import { z } from "zod";

export type IntervalsObject = Record<string, unknown>;

const IdSchema = z.union([z.string(), z.number()]);
const OptionalNumber = z.number().nullable().optional();
const OptionalString = z.string().nullable().optional();

export const AthleteResponseSchema = z.object({
  id: IdSchema.optional(),
  icu_ctl: OptionalNumber,
  icu_atl: OptionalNumber,
  icu_ts_b: OptionalNumber,
  ftp: OptionalNumber,
  lthr: OptionalNumber,
  max_hr: OptionalNumber,
  threshold_pace: OptionalNumber,
  weight: OptionalNumber,
  sportSettings: z.unknown().optional(),
  sport_settings: z.unknown().optional(),
  zones: z.unknown().optional(),
}).passthrough();

export const ActivityResponseSchema = z.object({
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
  icu_rpe: OptionalNumber,
  perceived_exertion: OptionalNumber,
  rpe: OptionalNumber,
  session_rpe: OptionalNumber,
  compliance: OptionalNumber,
  intervals: z.array(z.unknown()).optional(),
  laps: z.array(z.unknown()).optional(),
  best_efforts: z.array(z.unknown()).optional(),
}).passthrough();

const WellnessResponseSchema = z.object({
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
  ctl: OptionalNumber,
  atl: OptionalNumber,
  spo2: OptionalNumber,
  steps: OptionalNumber,
}).passthrough();

const EventResponseSchema = z.object({
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

export type AthleteResponse = z.infer<typeof AthleteResponseSchema>;
export type ActivityResponse = z.infer<typeof ActivityResponseSchema>;
export type WellnessResponse = z.infer<typeof WellnessResponseSchema>;
export type EventResponse = z.infer<typeof EventResponseSchema>;
