import { z } from "zod";
import { IANAZone } from "luxon";

const optionalNonEmptyString = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().min(1).optional(),
);

const optionalSecret = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().min(32).optional(),
);

const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  INTERVALS_ICU_API_KEY: optionalNonEmptyString,
  INTERVALS_ICU_ATHLETE_ID: optionalNonEmptyString,
  USER_TIMEZONE: z.string().refine((value) => IANAZone.isValidZone(value), "Expected a valid IANA timezone").default("Europe/Warsaw"),
  TRAINING_PROFILE_PATH: optionalNonEmptyString,
  TRAINING_PROFILE_YAML: optionalNonEmptyString,
  WRITE_ENABLED: z.enum(["true", "false"]).default("false"),
  VALIDATION_HMAC_SECRET: optionalSecret,
  INTERVALS_ICU_BASE_URL: z.url().default("https://intervals.icu/api/v1"),
  INTERVALS_ICU_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(10000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
}).passthrough();

export interface AppConfig {
  port: number;
  apiKey?: string;
  athleteId?: string;
  timezone: string;
  trainingProfileSource?: string;
  writeEnabled: boolean;
  validationSecret?: string;
  intervalsBaseUrl: string;
  requestTimeoutMs: number;
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.parse(env);
  return {
    port: parsed.PORT,
    apiKey: parsed.INTERVALS_ICU_API_KEY,
    athleteId: parsed.INTERVALS_ICU_ATHLETE_ID,
    timezone: parsed.USER_TIMEZONE,
    trainingProfileSource: parsed.TRAINING_PROFILE_PATH ?? parsed.TRAINING_PROFILE_YAML,
    writeEnabled: parsed.WRITE_ENABLED === "true",
    validationSecret: parsed.VALIDATION_HMAC_SECRET,
    intervalsBaseUrl: parsed.INTERVALS_ICU_BASE_URL.replace(/\/$/, ""),
    requestTimeoutMs: parsed.INTERVALS_ICU_TIMEOUT_MS,
    logLevel: parsed.LOG_LEVEL,
  };
}

export function readinessProblems(config: AppConfig): string[] {
  const problems: string[] = [];
  if (!config.apiKey) problems.push("INTERVALS_ICU_API_KEY is not configured");
  if (!config.athleteId) problems.push("INTERVALS_ICU_ATHLETE_ID is not configured");
  if (config.writeEnabled && !config.validationSecret) {
    problems.push("VALIDATION_HMAC_SECRET (at least 32 characters) is required when writes are enabled");
  }
  return problems;
}
