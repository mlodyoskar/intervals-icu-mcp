import type { IntervalsObject } from "./schemas.js";

export const numberOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export const stringOrNull = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

export const roundedNumberOrNull = (value: unknown, digits = 0): number | null => {
  const number = numberOrNull(value);
  if (number === null) return null;
  const factor = 10 ** digits;
  return Math.round(number * factor) / factor;
};

export const rpeOrNull = (value: unknown): number | null => {
  const rpe = roundedNumberOrNull(value, 1);
  return rpe !== null && rpe >= 1 && rpe <= 10 ? rpe : null;
};

export const arrayOfNumbers = (value: unknown): number[] => Array.isArray(value)
  ? value.map(numberOrNull).filter((entry): entry is number => entry !== null) : [];

export const arrayOfStrings = (value: unknown): string[] => Array.isArray(value)
  ? value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0) : [];

export const objectArray = (value: unknown): IntervalsObject[] => {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is IntervalsObject => typeof entry === "object" && entry !== null && !Array.isArray(entry));
  }
  return typeof value === "object" && value !== null ? [value as IntervalsObject] : [];
};
