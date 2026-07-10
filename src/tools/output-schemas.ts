import { z } from "zod";

export function envelope<T extends z.ZodType>(schema: T) {
  return z.object({ data: schema }).strict();
}
