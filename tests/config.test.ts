import { describe, expect, it } from "vitest";
import { loadConfig, readinessProblems } from "../src/config/env.js";

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
    expect(config.trainingProfilePath).toBeUndefined();
    expect(config.validationSecret).toBeUndefined();
    expect(readinessProblems(config)).toHaveLength(2);
  });

  it("requires a strong secret only when a non-empty secret is supplied", () => {
    expect(() => loadConfig({ WRITE_ENABLED: "false", VALIDATION_HMAC_SECRET: "short" })).toThrow();
    expect(() => loadConfig({ WRITE_ENABLED: "false", VALIDATION_HMAC_SECRET: "" })).not.toThrow();
  });
});
