import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { stableHash } from "./hash.js";
import type { TrainingPlan } from "./model.js";

const TokenPayloadSchema = z.object({
  version: z.literal(1),
  planHash: z.string().regex(/^[a-f0-9]{64}$/),
  expiresAt: z.number().int().positive(),
}).strict();

export class ValidationTokenSigner {
  constructor(private readonly secret: string, private readonly now: () => number = Date.now) {
    if (secret.length < 32) throw new Error("Validation HMAC secret must have at least 32 characters");
  }

  sign(plan: TrainingPlan, ttlSeconds = 300): string {
    const payload = Buffer.from(JSON.stringify({
      version: 1,
      planHash: stableHash(plan),
      expiresAt: Math.floor(this.now() / 1000) + ttlSeconds,
    })).toString("base64url");
    const signature = createHmac("sha256", this.secret).update(payload).digest("base64url");
    return `${payload}.${signature}`;
  }

  verify(token: string, plan: TrainingPlan): { valid: boolean; reason?: string } {
    const [payloadPart, signaturePart, extra] = token.split(".");
    if (!payloadPart || !signaturePart || extra) return { valid: false, reason: "Malformed validation token" };
    const expected = createHmac("sha256", this.secret).update(payloadPart).digest();
    let actual: Buffer;
    try {
      actual = Buffer.from(signaturePart, "base64url");
    } catch {
      return { valid: false, reason: "Malformed validation token" };
    }
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      return { valid: false, reason: "Invalid validation token signature" };
    }
    try {
      const payload = TokenPayloadSchema.parse(JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8")));
      if (payload.expiresAt < Math.floor(this.now() / 1000)) return { valid: false, reason: "Validation token expired" };
      if (payload.planHash !== stableHash(plan)) return { valid: false, reason: "Validation token does not match this exact plan" };
      return { valid: true };
    } catch {
      return { valid: false, reason: "Malformed validation token" };
    }
  }
}
