import { describe, expect, it } from "vitest";
import { AppError } from "../src/platform/errors.js";
import { createLogger } from "../src/platform/logger.js";
import { executeTool } from "../src/tools/common.js";

describe("safe tool errors", () => {
  const logger = createLogger("silent");

  it("preserves explicitly safe errors and redacts unknown failures", async () => {
    await expect(executeTool("example", logger, () => Promise.reject(
      new AppError("INVALID_CURSOR", "Invalid cursor"),
    ))).resolves.toMatchObject({ isError: true, content: [{ text: "Invalid cursor" }] });

    await expect(executeTool("example", logger, () => Promise.reject(
      new Error("private upstream response"),
    ))).resolves.toMatchObject({
      isError: true,
      content: [{ text: "The operation failed; no sensitive upstream details were exposed" }],
    });
  });
});
