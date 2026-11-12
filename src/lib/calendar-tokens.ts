import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key() {
  const value = Buffer.from(process.env.GOOGLE_CALENDAR_TOKEN_KEY || "", "base64");
  if (value.length !== 32) throw new Error("Calendar token encryption is not configured.");
  return value;
}
export function encryptCalendarToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString("base64url")).join(".");
}
export function decryptCalendarToken(token: string) {
  const [iv, tag, encrypted] = token.split(".").map(part => Buffer.from(part, "base64url"));
  if (!iv || !tag || !encrypted || iv.length !== 12 || tag.length !== 16) throw new Error("Invalid calendar token.");
  const cipher = createDecipheriv("aes-256-gcm", key(), iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(encrypted), cipher.final()]).toString("utf8");
}
