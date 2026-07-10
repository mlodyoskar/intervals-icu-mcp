import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { applyTrainingPlan } from "../workouts/apply.js";
import { ApplyResultSchema, ValidationResultSchema } from "../workouts/contracts.js";
import { TrainingPlanSchema } from "../workouts/model.js";
import { ValidationTokenSigner } from "../workouts/token.js";
import { validateTrainingPlanUseCase } from "../workouts/validate-use-case.js";
import { AppError } from "../platform/errors.js";
import { executeTool } from "./common.js";
import type { ToolDependencies } from "./dependencies.js";
import { envelope } from "./output-schemas.js";

export function registerTrainingPlanTools(server: McpServer, dependencies: ToolDependencies) {
  const signer = dependencies.config.validationSecret
    ? new ValidationTokenSigner(dependencies.config.validationSecret)
    : undefined;

  server.registerTool("validate_training_plan", {
    title: "Validate training plan",
    description: "Validate and normalize a neutral training plan without writing it. Returns a short-lived HMAC token when configured and valid.",
    inputSchema: z.object({ plan: z.unknown() }).strict(),
    outputSchema: envelope(ValidationResultSchema),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, ({ plan }) => executeTool("validate_training_plan", dependencies.logger, () => validateTrainingPlanUseCase(plan, {
    client: dependencies.client,
    timezone: dependencies.config.timezone,
    signer,
    now: dependencies.now,
  })));

  if (!dependencies.config.writeEnabled) return;
  server.registerTool("apply_training_plan", {
    title: "Apply training plan",
    description: "Create or conflict-safe update a previously validated plan. Never deletes events.",
    inputSchema: z.object({
      plan: TrainingPlanSchema,
      validationToken: z.string().min(1).max(2000),
      mode: z.literal("create_or_update"),
    }).strict(),
    outputSchema: envelope(ApplyResultSchema),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, ({ plan, validationToken }) => executeTool("apply_training_plan", dependencies.logger, async () => {
    if (!signer) throw new AppError("INVALID_CONFIGURATION", "Writes require a validation secret");
    return applyTrainingPlan({
      plan,
      validationToken,
      client: dependencies.client,
      signer,
      timezone: dependencies.config.timezone,
    });
  }));
}
