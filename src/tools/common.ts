import type { AppLogger } from "../platform/logger.js";
import { safeAppError } from "../platform/errors.js";

function result(data: unknown) {
  return { structuredContent: { data }, content: [] };
}

export async function executeTool(
  name: string,
  logger: AppLogger,
  operation: () => Promise<unknown>,
) {
  const startedAt = performance.now();
  try {
    const data = await operation();
    logger.info({ tool: name, outcome: "ok", durationMs: Math.round(performance.now() - startedAt) }, "tool completed");
    return result(data);
  } catch (error) {
    const safe = safeAppError(error);
    logger.warn({
      tool: name,
      outcome: "error",
      errorCode: safe.code,
      durationMs: Math.round(performance.now() - startedAt),
    }, "tool failed");
    return { isError: true, content: [{ type: "text" as const, text: safe.safeMessage }] };
  }
}
