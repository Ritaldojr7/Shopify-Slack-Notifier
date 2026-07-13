import crypto from "crypto";

/**
 * Verify a Shopify webhook HMAC signature.
 * Computes base64 HMAC-SHA256 over the raw body and compares timing-safely.
 */
export function verifyHmac(rawBody, header, secret) {
  if (!header) return false;

  const computed = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("base64");

  const computedBuf = Buffer.from(computed, "utf-8");
  const headerBuf = Buffer.from(header, "utf-8");

  if (computedBuf.length !== headerBuf.length) return false;

  return crypto.timingSafeEqual(computedBuf, headerBuf);
}
