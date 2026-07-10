import type { CalendarEvent } from "../calendar/model.js";
import { stableHash } from "../platform/hash.js";
import { numberOrNull, stringOrNull } from "./mapper-utils.js";
import type { EventResponse } from "./schemas.js";
import { normalizeSport } from "./sport.js";

export function mapEvent(raw: EventResponse): CalendarEvent {
  const description = stringOrNull(raw.description);
  const clientWorkoutId = description?.match(/^# clientWorkoutId=([^\n]+)/m)?.[1] ?? null;
  const stable = {
    id: String(raw.id ?? ""),
    date: String(raw.start_date_local ?? raw.start_date ?? ""),
    name: String(raw.name ?? "Unnamed event"),
    category: stringOrNull(raw.category ?? raw.type),
    sport: normalizeSport(raw.type ?? raw.sport),
    description,
    durationSeconds: numberOrNull(raw.moving_time),
    distanceMeters: numberOrNull(raw.distance),
    trainingLoad: numberOrNull(raw.icu_training_load ?? raw.training_load),
    clientWorkoutId,
  };
  return { ...stable, structuredWorkout: description, eventHash: stableHash(stable) };
}
