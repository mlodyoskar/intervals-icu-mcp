import type { DateTime } from "luxon";
import type { IntervalsGateway } from "../intervals/client.js";
import { mapAthlete, mapEvent } from "../intervals/mappers.js";
import type { ValidationResult } from "./contracts.js";
import { TrainingPlanSchema } from "./model.js";
import type { ValidationTokenSigner } from "./token.js";
import { validateTrainingPlan } from "./validator.js";
import { zoneCapabilitiesFromAthlete } from "./capabilities.js";
import type { CalendarEvent } from "../calendar/model.js";

export async function validateTrainingPlanUseCase(
  plan: unknown,
  dependencies: {
    client: IntervalsGateway;
    timezone: string;
    signer?: ValidationTokenSigner;
    now?: DateTime;
  },
): Promise<ValidationResult> {
  const athlete = mapAthlete(await dependencies.client.getAthlete());
  const parsed = TrainingPlanSchema.safeParse(plan);
  let events: CalendarEvent[] = [];
  if (parsed.success && parsed.data.workouts.length) {
    const dates = parsed.data.workouts.map((workout) => workout.date).sort();
    events = (await dependencies.client.listEvents(dates[0]!, dates[dates.length - 1]!)).map(mapEvent);
  }
  return validateTrainingPlan(plan, {
    timezone: dependencies.timezone,
    zoneCapabilities: zoneCapabilitiesFromAthlete(athlete),
    existingEvents: events,
    signer: dependencies.signer,
    now: dependencies.now,
  });
}
