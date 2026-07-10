import type { z } from "zod";
import {
  ActivityListResponseSchema, ActivityResponseSchema, AthleteResponseSchema, EventListResponseSchema,
  EventWriteResponseSchema, WellnessListResponseSchema, type ActivityResponse, type AthleteResponse,
  type EventResponse, type WellnessResponse,
} from "./schemas.js";
import type { RenderedEvent } from "../workouts/renderer.js";
import { AppError } from "../platform/errors.js";

export class IntervalsApiError extends AppError {
  constructor(
    public readonly status: number,
    public readonly kind: "unauthorized" | "forbidden" | "not_found" | "rate_limited" | "upstream" | "invalid_response" | "network",
    message: string,
    public readonly retryable: boolean,
  ) {
    super("UPSTREAM_UNAVAILABLE", "Intervals.icu is temporarily unavailable");
    this.message = message;
    this.name = "IntervalsApiError";
  }
}

export interface IntervalsGateway {
  getAthlete(): Promise<AthleteResponse>;
  listActivities(startDate: string, endDate: string): Promise<ActivityResponse[]>;
  getActivity(activityId: string, includeIntervals?: boolean): Promise<ActivityResponse>;
  listWellness(startDate: string, endDate: string): Promise<WellnessResponse[]>;
  listEvents(startDate: string, endDate: string): Promise<EventResponse[]>;
  createEvent(event: RenderedEvent): Promise<EventResponse>;
  updateEvent(eventId: string, event: RenderedEvent): Promise<EventResponse>;
}

export type IntervalsClientContract = IntervalsGateway;

export interface IntervalsClientOptions {
  baseUrl: string;
  apiKey?: string;
  athleteId?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

function kindForStatus(status: number): IntervalsApiError["kind"] {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  return "upstream";
}

export class IntervalsClient implements IntervalsGateway {
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly timeoutMs: number;

  constructor(private readonly options: IntervalsClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.timeoutMs = options.timeoutMs ?? 10000;
  }

  private credentials(): { apiKey: string; athleteId: string } {
    if (!this.options.apiKey || !this.options.athleteId) {
      throw new IntervalsApiError(503, "upstream", "Intervals.icu credentials are not configured", false);
    }
    return { apiKey: this.options.apiKey, athleteId: this.options.athleteId };
  }

  private athletePath(suffix: string): string {
    return `/athlete/${encodeURIComponent(this.credentials().athleteId)}${suffix}`;
  }

  private async request<T>(method: "GET" | "POST" | "PUT", path: string, schema: z.ZodType<T>, body?: unknown): Promise<T> {
    const { apiKey } = this.credentials();
    const safeRead = method === "GET";
    const attempts = safeRead ? 3 : 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(`${this.options.baseUrl}${path}`, {
          method,
          signal: controller.signal,
          headers: {
            Authorization: `Basic ${Buffer.from(`API_KEY:${apiKey}`).toString("base64")}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (!response.ok) {
          const retryable = safeRead && (response.status === 429 || response.status >= 500);
          if (retryable && attempt + 1 < attempts) {
            const retryAfter = Number(response.headers.get("retry-after"));
            await this.sleep(Number.isFinite(retryAfter) ? Math.min(retryAfter * 1000, 5000) : 250 * (2 ** attempt));
            continue;
          }
          throw new IntervalsApiError(response.status, kindForStatus(response.status),
            `Intervals.icu request failed with HTTP ${response.status}`, retryable);
        }
        if (response.status === 204) return schema.parse({});
        const json: unknown = await response.json();
        const parsed = schema.safeParse(json);
        if (!parsed.success) {
          throw new IntervalsApiError(502, "invalid_response", "Intervals.icu returned an invalid response", false);
        }
        return parsed.data;
      } catch (error) {
        if (error instanceof IntervalsApiError) throw error;
        if (safeRead && attempt + 1 < attempts) {
          await this.sleep(250 * (2 ** attempt));
          continue;
        }
        throw new IntervalsApiError(502, "network", "Intervals.icu request failed or timed out", safeRead);
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new IntervalsApiError(502, "network", "Intervals.icu request failed", safeRead);
  }

  getAthlete() {
    return this.request("GET", this.athletePath(""), AthleteResponseSchema);
  }

  listActivities(startDate: string, endDate: string) {
    const query = new URLSearchParams({ oldest: startDate, newest: endDate });
    return this.request("GET", this.athletePath(`/activities?${query}`), ActivityListResponseSchema);
  }

  getActivity(activityId: string, includeIntervals = true) {
    const query = new URLSearchParams({ intervals: String(includeIntervals) });
    return this.request("GET", `/activity/${encodeURIComponent(activityId)}?${query}`, ActivityResponseSchema);
  }

  listWellness(startDate: string, endDate: string) {
    const query = new URLSearchParams({ oldest: startDate, newest: endDate });
    return this.request("GET", this.athletePath(`/wellness?${query}`), WellnessListResponseSchema);
  }

  listEvents(startDate: string, endDate: string) {
    const query = new URLSearchParams({ oldest: startDate, newest: endDate });
    return this.request("GET", this.athletePath(`/events?${query}`), EventListResponseSchema);
  }

  createEvent(event: RenderedEvent) {
    return this.request("POST", this.athletePath("/events"), EventWriteResponseSchema, event);
  }

  updateEvent(eventId: string, event: RenderedEvent) {
    return this.request("PUT", this.athletePath(`/events/${encodeURIComponent(eventId)}`), EventWriteResponseSchema, event);
  }
}
