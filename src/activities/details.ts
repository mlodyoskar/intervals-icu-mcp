import { z } from "zod";
import type { IntervalsGateway } from "../intervals/client.js";
import { mapActivityDetails } from "../intervals/mappers.js";
import { ActivityDetailsSchema, type ActivityDetails } from "./model.js";

export const GetActivityDetailsInputSchema = z.object({
  activityId: z.string().min(1).max(100),
  includeIntervals: z.boolean().default(true),
}).strict();

export { ActivityDetailsSchema as GetActivityDetailsOutputSchema };
export type GetActivityDetailsInput = z.infer<typeof GetActivityDetailsInputSchema>;

export async function getActivityDetails(
  input: GetActivityDetailsInput,
  dependencies: { client: IntervalsGateway; timezone: string },
): Promise<ActivityDetails> {
  return mapActivityDetails(
    await dependencies.client.getActivity(input.activityId, input.includeIntervals),
    input.includeIntervals,
    dependencies.timezone,
  );
}
