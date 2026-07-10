import { createHash, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

const BEARER_AUTHORIZATION = /^Bearer ([^\s]+)$/i;
const WWW_AUTHENTICATE = 'Bearer realm="intervals-icu-mcp"';

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function createBearerAuthMiddleware(expectedToken: string): RequestHandler {
  const expectedDigest = digest(expectedToken);

  return (req, res, next) => {
    const match = BEARER_AUTHORIZATION.exec(req.headers.authorization ?? "");
    const candidateDigest = digest(match?.[1] ?? "");

    if (!match || !timingSafeEqual(candidateDigest, expectedDigest)) {
      res.setHeader("WWW-Authenticate", WWW_AUTHENTICATE);
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    next();
  };
}
