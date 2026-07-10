import pino, { type Logger } from "pino";
import { APP_NAME } from "./metadata.js";

export type AppLogger = Logger;

export function createLogger(level: string): AppLogger {
  return pino({
    level,
    base: { service: APP_NAME },
    redact: {
      paths: [
        "apiKey",
        "validationSecret",
        "req.headers",
        "req.body",
        "request.headers",
        "request.body",
        "*.apiKey",
        "*.validationSecret",
      ],
      remove: true,
    },
  });
}
