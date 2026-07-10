import { z } from "zod";
import { ActivitySportSchema } from "../activities/model.js";

const NullableNumber = z.number().nullable();
const NullableString = z.string().nullable();

export const CalendarEventSchema = z.object({
  id: z.string(),
  date: z.string(),
  name: z.string(),
  category: NullableString,
  sport: ActivitySportSchema,
  description: NullableString,
  durationSeconds: NullableNumber,
  distanceMeters: NullableNumber,
  trainingLoad: NullableNumber,
  clientWorkoutId: NullableString,
  structuredWorkout: NullableString,
  eventHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

export type CalendarEvent = z.infer<typeof CalendarEventSchema>;
