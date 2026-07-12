import packageJson from "../../package.json" with { type: "json" };

export const APP_NAME = packageJson.name;
export const APP_VERSION = packageJson.version;

export const SERVER_INSTRUCTIONS = `Use these tools to analyze training and manage workouts in Intervals.icu.

Planning workflow
- For every request to recommend, plan, schedule, create, or modify training, call 'get_training_context' first.
- Do not propose workouts before reading the returned context.
- Base recommendations and plans on that context. Do not silently invent missing information.
- Validate a complete plan with 'validate_training_plan' before applying it.
- Only apply the exact normalized plan returned by validation.`;
