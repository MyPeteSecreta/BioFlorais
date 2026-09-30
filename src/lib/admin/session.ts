/**
 * Verificação da sessão do admin para rotas de API.
 *
 * Mesmo cookie/assinatura do login já existente (/api/admin/login e
 * layout do grupo (protected)): HMAC-SHA256 de "mypeteme-admin" com
 * ADMIN_SESSION_SECRET, no cookie "mypeteme_admin_session".
 */

import { createHmac, timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";

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

export function isAdminRequest(request: NextRequest) {
  return isAdminSessionValue(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
}
