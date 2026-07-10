import { z } from "zod";
import { IsoDateSchema, dateRange } from "../coaching/dates.js";
import type { IntervalsGateway } from "../intervals/client.js";
import { mapActivity } from "../intervals/mappers.js";
import { AppError } from "../platform/errors.js";
import { stableHash } from "../platform/hash.js";
import { ACTIVITY_SPORTS, ActivitySchema, type Activity } from "./model.js";

const MAX_ACTIVITY_RANGE_DAYS = 366;

export const ListActivitiesInputSchema = z.object({
  startDate: IsoDateSchema,
  endDate: IsoDateSchema,
  sport: z.enum(ACTIVITY_SPORTS).optional(),
  activityType: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/).optional()
    .describe("Exact normalized activity type, for example bouldering"),
  limit: z.number().int().min(1).max(200).default(50),
  cursor: z.string().max(500).optional(),
}).strict();

export const ListActivitiesOutputSchema = z.object({
  activities: z.array(ActivitySchema),
  sort: z.literal("date_desc"),
  nextCursor: z.string().nullable(),
}).strict();

export type ListActivitiesInput = z.infer<typeof ListActivitiesInputSchema>;
export type ListActivitiesOutput = z.infer<typeof ListActivitiesOutputSchema>;

const CursorSchema = z.object({
  version: z.literal(1),
  queryHash: z.string().regex(/^[a-f0-9]{64}$/),
  afterDate: z.string(),
  afterId: z.string(),
}).strict();

function queryHash(input: Omit<ListActivitiesInput, "cursor" | "limit">): string {
  return stableHash(input);
}

function decodeCursor(cursor: string | undefined, expectedQueryHash: string) {
  if (!cursor) return null;
  try {
    const parsed = CursorSchema.parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
    if (parsed.queryHash !== expectedQueryHash) throw new Error("query mismatch");
    return parsed;
  } catch (error) {
    throw new AppError("INVALID_CURSOR", "Invalid cursor", { cause: error });
  }
}

function encodeCursor(activity: Activity, hash: string): string {
  return Buffer.from(JSON.stringify({
    version: 1,
    queryHash: hash,
    afterDate: activity.date,
    afterId: activity.id,
  })).toString("base64url");
}

function compareActivities(a: Activity, b: Activity): number {
  return b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
}

function isAfterCursor(activity: Activity, cursor: z.infer<typeof CursorSchema>): boolean {
  return activity.date < cursor.afterDate
    || (activity.date === cursor.afterDate && activity.id < cursor.afterId);
}

export async function listActivities(
  input: ListActivitiesInput,
  dependencies: { client: IntervalsGateway; timezone: string },
): Promise<ListActivitiesOutput> {
  dateRange(input.startDate, input.endDate, dependencies.timezone, MAX_ACTIVITY_RANGE_DAYS);
  const hash = queryHash({
    startDate: input.startDate,
    endDate: input.endDate,
    sport: input.sport,
    activityType: input.activityType,
  });
  const cursor = decodeCursor(input.cursor, hash);
  let activities = (await dependencies.client.listActivities(input.startDate, input.endDate))
    .map((activity) => mapActivity(activity, dependencies.timezone))
    .sort(compareActivities);
  if (input.sport) activities = activities.filter((activity) => activity.sport === input.sport);
  if (input.activityType) activities = activities.filter((activity) => activity.activityType === input.activityType);

  const startIndex = cursor ? activities.findIndex((activity) => isAfterCursor(activity, cursor)) : 0;
  const page = startIndex < 0 ? [] : activities.slice(startIndex, startIndex + input.limit);
  const hasMore = startIndex >= 0 && startIndex + page.length < activities.length;
  const last = page.at(-1);
  return {
    activities: page,
    sort: "date_desc",
    nextCursor: hasMore && last ? encodeCursor(last, hash) : null,
  };
}
