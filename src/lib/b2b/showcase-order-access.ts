/**
 * BIO FLORAIS B2B — quem pode pagar um pedido de MOSTRUÁRIO: o próprio vendedor, pela sessão dele.
 * (Sem a oferta/token: o pedido de mostruário não tem oferta.) Vendedor de demonstração nunca paga.
 * Qualquer outro pedido sem oferta continua recusado como "não é B2B".
 */

import { DEMO_PURCHASE_DISABLED_MESSAGE, loadDemoState } from "@/lib/b2b/demo";
import type { SqlRunner } from "@/lib/b2b/ownership";
import { readB2BResponsibleSession } from "@/lib/b2b/responsible-session";
import { SHOWCASE_ORIGIN } from "@/lib/b2b/showcase";

export type ShowcaseAccessResult = { ok: true } | { ok: false; status: number; error: string };

export async function verifyShowcaseOrderAccess(
  run: SqlRunner,
  orderId: string,
  sessionCookie: string | undefined
): Promise<ShowcaseAccessResult> {
  const notB2B: ShowcaseAccessResult = { ok: false, status: 403, error: "Este pedido não é um pedido B2B." };

  let row: Record<string, unknown> | undefined;

  try {
    [row] = await run(
      `SELECT b2b_responsible_id, to_jsonb(orders) ->> 'origin' AS origin FROM orders WHERE id = $1::uuid LIMIT 1`,
      [orderId]
    );
  } catch {
    return notB2B;
  }

  if (!row || row.origin !== SHOWCASE_ORIGIN || !row.b2b_responsible_id) return notB2B;

  const session = readB2BResponsibleSession(sessionCookie);

  if (!session) {
    return { ok: false, status: 401, error: "Sua sessão expirou. Entre de novo para pagar o mostruário." };
  }

  if (session.responsibleId !== String(row.b2b_responsible_id)) {
    return { ok: false, status: 403, error: "Este pedido de mostruário não é seu." };
  }

  const demo = await loadDemoState(run, session.responsibleId);

  if (demo.isDemo) {
    return { ok: false, status: 403, error: DEMO_PURCHASE_DISABLED_MESSAGE };
  }

  return { ok: true };
}
