import { z } from "zod";
import { dateRange, IsoDateSchema } from "../coaching/dates.js";
import type { IntervalsGateway } from "../intervals/client.js";
import { mapWellness } from "../intervals/mappers.js";
import { WellnessSchema } from "./model.js";

export const GetWellnessInputSchema = z.object({ startDate: IsoDateSchema, endDate: IsoDateSchema }).strict();
export const GetWellnessOutputSchema = z.object({ wellness: z.array(WellnessSchema) }).strict();
export type GetWellnessInput = z.infer<typeof GetWellnessInputSchema>;
export type GetWellnessOutput = z.infer<typeof GetWellnessOutputSchema>;

export async function getWellness(
  input: GetWellnessInput,
  dependencies: { client: IntervalsGateway; timezone: string },
): Promise<GetWellnessOutput> {
  dateRange(input.startDate, input.endDate, dependencies.timezone, 366);
  return { wellness: (await dependencies.client.listWellness(input.startDate, input.endDate)).map(mapWellness) };
}
