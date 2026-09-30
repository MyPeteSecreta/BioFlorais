/**
 * BIO FLORAIS B2B — sessão do responsável/RCA (área logada).
 *
 * Mesmo formato do login B2B anterior da Bio (cookie
 * bioflorais_b2b_session, HMAC com ADMIN_SESSION_SECRET), para não
 * exigir variável de ambiente nova.
 */

import crypto from "node:crypto";

export const B2B_SESSION_COOKIE = "bioflorais_b2b_session";

export const B2B_SESSION_MAX_AGE = 60 * 60 * 12;

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET não configurada.");
  }

  return secret;
}

function sign(payload: string): string {
  return crypto
    .createHmac("sha256", getSecret())
    .update(`b2b-session:${payload}`)
    .digest("base64url");
}

function timingSafeMatch(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

export function createB2BResponsibleSession(responsibleId: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      responsibleId,
      expiresAt: Date.now() + B2B_SESSION_MAX_AGE * 1000,
    }),
    "utf8"
  ).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

export function readB2BResponsibleSession(
  value: string | undefined
): { responsibleId: string; expiresAt: number } | null {
  if (!value) {
    return null;
  }

  const [payload, receivedSignature] = value.split(".");

  if (!payload || !receivedSignature) {
    return null;
  }

  if (!timingSafeMatch(receivedSignature, sign(payload))) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as { responsibleId?: unknown; expiresAt?: unknown };

    if (
      typeof parsed.responsibleId !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt <= Date.now()
    ) {
      return null;
    }

    return {
      responsibleId: parsed.responsibleId,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}
