import type { NormalizedSport } from "../activities/model.js";

function sourceString(value: unknown, fallback: string): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

export function normalizeSport(value: unknown): NormalizedSport {
  const sport = sourceString(value, "").toLowerCase();
  if (sport.includes("run")) return "run";
  if (sport.includes("ride") || sport.includes("bike") || sport.includes("cycle")) return "ride";
  if (sport.includes("strength") || sport.includes("weight")) return "strength";
  if (sport.includes("swim")) return "swim";
  if (sport.includes("walk")) return "walk";
  if (sport.includes("hik")) return "hike";
  if (sport.includes("climb") || sport.includes("boulder")) return "climbing";
  return "other";
}

export function normalizeActivityType(value: unknown): string {
  const normalized = sourceString(value, "other").trim().replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
  if (normalized.includes("boulder")) return "bouldering";
  return normalized || "other";
}
