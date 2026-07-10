import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { z } from "zod";

export const TrainingProfileSchema = z.object({
  goals: z.array(z.string()).default([]),
  experience: z.string().nullable().default(null),
  availability: z.record(z.string(), z.union([z.string(), z.array(z.string())])).default({}),
  preferences: z.array(z.string()).default([]),
  injuryContext: z.string().nullable().default(null),
}).strict();

export type TrainingProfile = z.infer<typeof TrainingProfileSchema>;

export async function loadTrainingProfile(pathOrYaml?: string): Promise<TrainingProfile | null> {
  if (!pathOrYaml) return null;
  let source = pathOrYaml;
  try {
    source = await readFile(pathOrYaml, "utf8");
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code !== "ENOENT" || !pathOrYaml.includes("\n")) throw error;
  }
  return TrainingProfileSchema.parse(parse(source));
}
