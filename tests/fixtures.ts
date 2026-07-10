import type { AppConfig } from "../src/config/env.js";
import type { IntervalsClientContract } from "../src/intervals/client.js";
import type { IntervalsObject } from "../src/intervals/schemas.js";
import type { RenderedEvent } from "../src/workouts/renderer.js";

export const testConfig: AppConfig = {
  port: 0,
  apiKey: "test-key",
  athleteId: "i-test",
  timezone: "Europe/Warsaw",
  writeEnabled: false,
  intervalsBaseUrl: "https://example.test/api/v1",
  requestTimeoutMs: 1000,
  logLevel: "silent",
};

export class MockIntervalsClient implements IntervalsClientContract {
  athlete: IntervalsObject = { id: "i-test", ftp: 250, zones: { power: [100, 200, 300] } };
  activities: IntervalsObject[] = [];
  wellness: IntervalsObject[] = [];
  events: IntervalsObject[] = [];
  activity: IntervalsObject = { id: "a1", type: "Run", start_date_local: "2026-07-09T07:00:00" };
  creates: RenderedEvent[] = [];
  updates: { id: string; event: RenderedEvent }[] = [];

  async getAthlete() { return this.athlete; }
  async listActivities() { return this.activities; }
  async getActivity() { return this.activity; }
  async listWellness() { return this.wellness; }
  async listEvents() { return this.events; }
  async createEvent(event: RenderedEvent) {
    this.creates.push(event);
    return { id: `e${this.creates.length}`, ...event };
  }
  async updateEvent(id: string, event: RenderedEvent) {
    this.updates.push({ id, event });
    return { id, ...event };
  }
}
