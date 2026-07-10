import { describe, expect, it } from "vitest";
import { loadConfig, readinessProblems } from "../src/config/env.js";
import { loadTrainingProfile } from "../src/config/profile.js";

describe("environment configuration", () => {
  const authEnv = { MCP_AUTH_TOKEN: "test-auth-token-with-at-least-32-characters" };

  it("treats empty optional .env values as unset", () => {
    const config = loadConfig({
      ...authEnv,
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
    expect(() => loadConfig({ ...authEnv, WRITE_ENABLED: "false", VALIDATION_HMAC_SECRET: "short" })).toThrow();
    expect(() => loadConfig({ ...authEnv, WRITE_ENABLED: "false", VALIDATION_HMAC_SECRET: "" })).not.toThrow();
  });

  it("requires a strong MCP authentication token", () => {
    expect(() => loadConfig({})).toThrow();
    expect(() => loadConfig({ MCP_AUTH_TOKEN: "" })).toThrow();
    expect(() => loadConfig({ MCP_AUTH_TOKEN: "short" })).toThrow();
    expect(loadConfig({ MCP_AUTH_TOKEN: "x".repeat(32) }).mcpAuthToken).toBe("x".repeat(32));
  });

  it("validates timezones and accepts single-line inline training profile YAML", async () => {
    expect(() => loadConfig({ ...authEnv, USER_TIMEZONE: "Mars/Olympus_Mons" })).toThrow();
    await expect(loadTrainingProfile("{ goals: [finish a 10k], preferences: [morning] }")).resolves.toMatchObject({
      goals: ["finish a 10k"],
      preferences: ["morning"],
    });
  });

  it("prefers inline training profile YAML over a local file path", () => {
    const config = loadConfig({
      ...authEnv,
      TRAINING_PROFILE_PATH: "./config/training-profile.yaml",
      TRAINING_PROFILE_YAML: "goals: [Deploy on Railway]",
    });

    expect(config.trainingProfileSource).toBe("goals: [Deploy on Railway]");
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
