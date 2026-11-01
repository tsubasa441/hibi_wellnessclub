import { createHash, randomBytes } from "node:crypto";

export const EMAIL_CHANGE_TTL_MINUTES = 30;

export function generateEmailChangeToken(): string {
  return randomBytes(32).toString("base64url");
}

// DB にはハッシュだけを置く（DB を読めてもリンクを作れないように）
export function hashEmailChangeToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
