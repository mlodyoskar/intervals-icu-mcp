import { describe, expect, it } from "vitest";
import { loadConfig, readinessProblems } from "../src/config/env.js";
import { loadTrainingProfile } from "../src/config/profile.js";

describe("environment configuration", () => {
  it("treats empty optional .env values as unset", () => {
    const config = loadConfig({
      INTERVALS_ICU_API_KEY: "",
      INTERVALS_ICU_ATHLETE_ID: "",
      TRAINING_PROFILE_YAML: "",
      VALIDATION_HMAC_SECRET: "",
      WRITE_ENABLED: "false",
    });
    expect(config.apiKey).toBeUndefined();
    expect(config.athleteId).toBeUndefined();
    expect(config.trainingProfileSource).toBeUndefined();
    expect(config.validationSecret).toBeUndefined();
    expect(readinessProblems(config)).toHaveLength(2);
  });

  it("requires a strong secret only when a non-empty secret is supplied", () => {
    expect(() => loadConfig({ WRITE_ENABLED: "false", VALIDATION_HMAC_SECRET: "short" })).toThrow();
    expect(() => loadConfig({ WRITE_ENABLED: "false", VALIDATION_HMAC_SECRET: "" })).not.toThrow();
  });

  it("validates timezones and accepts single-line inline training profile YAML", async () => {
    expect(() => loadConfig({ USER_TIMEZONE: "Mars/Olympus_Mons" })).toThrow();
    await expect(loadTrainingProfile("{ goals: [finish a 10k], preferences: [morning] }")).resolves.toMatchObject({
      goals: ["finish a 10k"],
      preferences: ["morning"],
    });
  });
});

describe("training profile configuration", () => {
  it("preserves structured coaching context and future custom keys", async () => {
    const profile = await loadTrainingProfile(`
goals:
  - Stay consistent
targetEvents:
  - name: Example race
    date: 2027-01-01
customCoachContext:
  preferredCue: Relax the shoulders
`);

    expect(profile).toMatchObject({
      goals: ["Stay consistent"],
      targetEvents: [{ name: "Example race", date: "2027-01-01" }],
      customCoachContext: { preferredCue: "Relax the shoulders" },
    });
  });
});
