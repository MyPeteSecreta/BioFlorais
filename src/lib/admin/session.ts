/**
 * Verificação da sessão do admin para rotas de API.
 *
 * Mesmo cookie/assinatura do login já existente (/api/admin/login e
 * layout do grupo (protected)): HMAC-SHA256 de "mypeteme-admin" com
 * ADMIN_SESSION_SECRET, no cookie "mypeteme_admin_session".
 *
 * Toda rota em /api/admin/* (exceto o próprio login) deve começar com:
 *   if (!isAdminRequest(request)) return 401
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "mypeteme_admin_session";

function expectedSessionToken() {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret) {
    return "";
  }

  return createHmac("sha256", secret).update("mypeteme-admin").digest("hex");
}

export function isAdminSessionValue(value: string | undefined | null) {
  const expected = expectedSessionToken();

  if (!value || !expected) {
    return false;
  }

  const a = Buffer.from(value);
  const b = Buffer.from(expected);

  return a.length === b.length && timingSafeEqual(a, b);
}

/** Lê um cookie do header "cookie" de qualquer Request (Request ou NextRequest). */
export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");

  if (!header) {
    return undefined;
  }

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");

    if (separator < 0) continue;

    if (part.slice(0, separator).trim() === name) {
      const raw = part.slice(separator + 1).trim();

      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }

  return undefined;
}

export function isAdminRequest(request: Request) {
  return isAdminSessionValue(readCookie(request, ADMIN_SESSION_COOKIE));
}
