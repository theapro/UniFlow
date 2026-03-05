import crypto from "crypto";

export function generateTemporaryPassword(length = 12) {
  // URL-safe-ish temporary password (letters + numbers)
  const bytes = crypto.randomBytes(Math.ceil(length));
  return bytes
    .toString("base64")
    .replaceAll("+", "A")
    .replaceAll("/", "B")
    .replaceAll("=", "C")
    .slice(0, length);
}
