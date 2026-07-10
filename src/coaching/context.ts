import type { DateTime } from "luxon";
import type { NormalizedSport } from "../activities/model.js";
import type { TrainingProfile } from "../config/profile.js";
import type { IntervalsGateway } from "../intervals/client.js";
import { mapActivity, mapAthlete, mapEvent, mapWellness } from "../intervals/mappers.js";
import { buildTrainingContext, contextPeriod } from "./aggregations.js";
import type { TrainingContext } from "./model.js";

export async function getTrainingContext(options: {
  client: IntervalsGateway;
  timezone: string;
  profile: TrainingProfile | null;
  historyDays: number;
  futureDays: number;
  sports?: NormalizedSport[];
  includeRawZones?: boolean;
  now?: DateTime;
}): Promise<TrainingContext> {
  const period = contextPeriod(options.timezone, options.historyDays, options.futureDays, options.now);
  const [athleteResult, activitiesResult, wellnessResult, eventsResult] = await Promise.allSettled([
    options.client.getAthlete(),
    options.client.listActivities(period.historyStart, period.today),
    options.client.listWellness(period.historyStart, period.today),
    options.client.listEvents(period.today, period.futureEnd),
  ]);

  return buildTrainingContext({
    ...options,
    athlete: athleteResult.status === "fulfilled" ? mapAthlete(athleteResult.value) : null,
    activities: activitiesResult.status === "fulfilled"
      ? activitiesResult.value.map((activity) => mapActivity(activity, options.timezone)) : [],
    wellness: wellnessResult.status === "fulfilled" ? wellnessResult.value.map(mapWellness) : [],
    calendar: eventsResult.status === "fulfilled" ? eventsResult.value.map(mapEvent) : [],
    availability: {
      athlete: athleteResult.status === "fulfilled",
      activities: activitiesResult.status === "fulfilled",
      wellness: wellnessResult.status === "fulfilled",
      calendar: eventsResult.status === "fulfilled",
    },
  });
}
