import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { z } from "zod";

export const TrainingProfileSchema = z.object({
  goals: z.array(z.string()).default([]),
  experience: z.string().nullable().default(null),
  availability: z.record(z.string(), z.union([z.string(), z.array(z.string())])).default({}),
  preferences: z.array(z.string()).default([]),
  injuryContext: z.string().nullable().default(null),
  profileVersion: z.number().int().positive().optional(),
  lastUpdated: z.string().optional(),
  primarySports: z.array(z.string()).optional(),
  targetEvents: z.array(z.record(z.string(), z.unknown())).optional(),
  performanceContext: z.record(z.string(), z.unknown()).optional(),
  trainingBackground: z.record(z.string(), z.unknown()).optional(),
  currentContext: z.record(z.string(), z.unknown()).optional(),
  injuryHistory: z.array(z.record(z.string(), z.unknown())).optional(),
  coachingGuardrails: z.array(z.string()).optional(),
  openQuestions: z.array(z.string()).optional(),
  dataNotes: z.array(z.string()).optional(),
}).passthrough();

export type TrainingProfile = z.infer<typeof TrainingProfileSchema>;

export async function loadTrainingProfile(pathOrYaml?: string): Promise<TrainingProfile | null> {
  if (!pathOrYaml) return null;

  try {
    const inline = TrainingProfileSchema.safeParse(parse(pathOrYaml));
    if (inline.success) return inline.data;
  } catch {
    // A value that is not valid inline YAML can still be a valid file path.
  }

  let source: string;
  try {
    source = await readFile(pathOrYaml, "utf8");
  } catch (error) {
    throw new Error("Training profile is neither valid inline YAML nor a readable file", { cause: error });
  }
  return TrainingProfileSchema.parse(parse(source));
}
