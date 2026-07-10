import { z } from "zod";
import { dateRange, IsoDateSchema } from "../coaching/dates.js";
import type { IntervalsGateway } from "../intervals/client.js";
import { mapEvent } from "../intervals/mappers.js";
import { CalendarEventSchema } from "./model.js";

export const GetCalendarInputSchema = z.object({ startDate: IsoDateSchema, endDate: IsoDateSchema }).strict();
export const GetCalendarOutputSchema = z.object({ events: z.array(CalendarEventSchema) }).strict();
export type GetCalendarInput = z.infer<typeof GetCalendarInputSchema>;
export type GetCalendarOutput = z.infer<typeof GetCalendarOutputSchema>;

export async function getCalendar(
  input: GetCalendarInput,
  dependencies: { client: IntervalsGateway; timezone: string },
): Promise<GetCalendarOutput> {
  dateRange(input.startDate, input.endDate, dependencies.timezone, 366);
  return { events: (await dependencies.client.listEvents(input.startDate, input.endDate)).map(mapEvent) };
}
