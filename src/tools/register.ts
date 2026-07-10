import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DateTime } from "luxon";
import type { AppConfig } from "../config/env.js";
import type { TrainingProfile } from "../config/profile.js";
import { dateRange, IsoDateSchema } from "../coaching/dates.js";
import { getTrainingContext } from "../coaching/context.js";
import type { IntervalsClientContract } from "../intervals/client.js";
import { mapActivity, mapActivityDetails, mapAthlete, mapEvent, mapWellness } from "../intervals/mappers.js";
import { applyTrainingPlan } from "../workouts/apply.js";
import { TrainingPlanSchema, SportSchema } from "../workouts/model.js";
import { ValidationTokenSigner } from "../workouts/token.js";
import { validateTrainingPlan } from "../workouts/validator.js";
import {
  ActivityOutputSchema, ApplyOutputSchema, EventOutputSchema, TrainingContextOutputSchema,
  ValidationOutputSchema, WellnessOutputSchema, envelope,
} from "./output-schemas.js";

function result(data: unknown) {
  return {
    structuredContent: { data },
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function safeError(error: unknown) {
  const message = error instanceof Error && [
    "endDate must not be before startDate",
    "Plan no longer passes validation",
    "Malformed validation token",
    "Invalid validation token signature",
    "Validation token expired",
    "Validation token does not match this exact plan",
  ].includes(error.message) ? error.message : "The operation failed; no sensitive upstream details were exposed";
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

function decodeCursor(cursor?: string): number {
  if (!cursor) return 0;
  try {
    const parsed = z.object({ offset: z.number().int().min(0).max(10000) }).strict()
      .parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
    return parsed.offset;
  } catch {
    throw new Error("Invalid cursor");
  }
}

export interface ToolDependencies {
  config: AppConfig;
  client: IntervalsClientContract;
  profile: TrainingProfile | null;
  now?: DateTime;
}

export function createMcpServer(dependencies: ToolDependencies): McpServer {
  const server = new McpServer({ name: "intervals-icu-mcp", version: "2.0.0" });
  const signer = dependencies.config.validationSecret
    ? new ValidationTokenSigner(dependencies.config.validationSecret)
    : undefined;

  server.registerTool("get_training_context", {
    title: "Get training context",
    description: "Aggregate the athlete profile, zones, recent volume, fitness, wellness trends and upcoming calendar before planning training.",
    inputSchema: z.object({
      historyDays: z.number().int().min(1).max(84).default(42),
      futureDays: z.number().int().min(1).max(28).default(14),
      sports: z.array(SportSchema).min(1).max(3).optional(),
    }).strict(),
    outputSchema: envelope(TrainingContextOutputSchema),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (input) => {
    try {
      return result(await getTrainingContext({ ...input, client: dependencies.client, timezone: dependencies.config.timezone, profile: dependencies.profile, now: dependencies.now }));
    } catch (error) { return safeError(error); }
  });

  server.registerTool("list_activities", {
    title: "List activities",
    description: "List summarized completed activities without FIT files or second-by-second streams.",
    inputSchema: z.object({
      startDate: IsoDateSchema,
      endDate: IsoDateSchema,
      sport: SportSchema.optional(),
      limit: z.number().int().min(1).max(200).default(50),
      cursor: z.string().max(500).optional(),
    }).strict(),
    outputSchema: envelope(z.object({ activities: z.array(ActivityOutputSchema), nextCursor: z.string().nullable() }).strict()),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ startDate, endDate, sport, limit, cursor }) => {
    try {
      dateRange(startDate, endDate, dependencies.config.timezone);
      const offset = decodeCursor(cursor);
      let activities = (await dependencies.client.listActivities(startDate, endDate)).map(mapActivity);
      if (sport) activities = activities.filter((activity) => activity.sport === sport);
      const page = activities.slice(offset, offset + limit);
      const nextOffset = offset + page.length;
      return result({ activities: page, nextCursor: nextOffset < activities.length
        ? Buffer.from(JSON.stringify({ offset: nextOffset })).toString("base64url") : null });
    } catch (error) { return safeError(error); }
  });

  server.registerTool("get_activity_details", {
    title: "Get activity details",
    description: "Get a completed activity summary, laps/intervals, zones and best efforts without raw streams.",
    inputSchema: z.object({ activityId: z.string().min(1).max(100), includeIntervals: z.boolean().default(true) }).strict(),
    outputSchema: envelope(ActivityOutputSchema.extend({
      intervals: z.array(z.unknown()),
      laps: z.array(z.unknown()),
      zoneDistribution: z.unknown().nullable(),
      bestEfforts: z.array(z.unknown()),
      notes: z.string().nullable(),
      completeness: z.object({ hasHeartRate: z.boolean(), hasPower: z.boolean(), hasIntervals: z.boolean(), missing: z.array(z.string()) }).strict(),
    })),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ activityId, includeIntervals }) => {
    try { return result(mapActivityDetails(await dependencies.client.getActivity(activityId, includeIntervals), includeIntervals)); }
    catch (error) { return safeError(error); }
  });

  server.registerTool("get_wellness", {
    title: "Get wellness",
    description: "Get daily sleep, HRV, resting heart rate and recovery fields; missing values are null, never zero.",
    inputSchema: z.object({ startDate: IsoDateSchema, endDate: IsoDateSchema }).strict(),
    outputSchema: envelope(z.object({ wellness: z.array(WellnessOutputSchema) }).strict()),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ startDate, endDate }) => {
    try {
      dateRange(startDate, endDate, dependencies.config.timezone);
      return result({ wellness: (await dependencies.client.listWellness(startDate, endDate)).map(mapWellness) });
    } catch (error) { return safeError(error); }
  });

  server.registerTool("get_training_calendar", {
    title: "Get training calendar",
    description: "Get planned workouts, races, rest days and notes with a stable event version hash.",
    inputSchema: z.object({ startDate: IsoDateSchema, endDate: IsoDateSchema }).strict(),
    outputSchema: envelope(z.object({ events: z.array(EventOutputSchema) }).strict()),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ startDate, endDate }) => {
    try {
      dateRange(startDate, endDate, dependencies.config.timezone);
      return result({ events: (await dependencies.client.listEvents(startDate, endDate)).map(mapEvent) });
    } catch (error) { return safeError(error); }
  });

  server.registerTool("validate_training_plan", {
    title: "Validate training plan",
    description: "Validate and normalize a neutral training plan without writing it. Returns a short-lived HMAC token when configured and valid.",
    inputSchema: z.object({ plan: z.unknown() }).strict(),
    outputSchema: envelope(ValidationOutputSchema),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ plan }) => {
    try {
      const athlete = mapAthlete(await dependencies.client.getAthlete());
      const parsed = TrainingPlanSchema.safeParse(plan);
      let events: ReturnType<typeof mapEvent>[] = [];
      if (parsed.success && parsed.data.workouts.length) {
        const dates = parsed.data.workouts.map((workout) => workout.date).sort();
        events = (await dependencies.client.listEvents(dates[0], dates[dates.length - 1])).map(mapEvent);
      }
      return result(validateTrainingPlan(plan, {
        timezone: dependencies.config.timezone,
        zonesAvailable: athlete.zones !== null,
        existingEvents: events,
        signer,
        now: dependencies.now,
      }));
    } catch (error) { return safeError(error); }
  });

  if (dependencies.config.writeEnabled) {
    server.registerTool("apply_training_plan", {
      title: "Apply training plan",
      description: "Create or conflict-safe update a previously validated plan. Never deletes events.",
      inputSchema: z.object({
        plan: TrainingPlanSchema,
        validationToken: z.string().min(1).max(2000),
        mode: z.literal("create_or_update"),
      }).strict(),
      outputSchema: envelope(ApplyOutputSchema),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async ({ plan, validationToken }) => {
      try {
        if (!signer) throw new Error("Writes require a validation secret");
        return result(await applyTrainingPlan({ plan, validationToken, client: dependencies.client, signer, timezone: dependencies.config.timezone }));
      } catch (error) { return safeError(error); }
    });
  }
  return server;
}
