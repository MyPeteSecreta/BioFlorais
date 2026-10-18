/**
 * Image Tag do ChatGPT Ads no servidor: guarda o oppref no pedido e entrega UMA vez a URL da tag do pedido PAGO.
 * Colunas (SQL 44b): orders.oppref, orders.ads_event_id (UUID aleatório; nunca o número do pedido) e
 * orders.ads_tag_sent_at (marca "tag enviada": não repete ao recarregar nem em outro aparelho). Sem as colunas
 * tudo fica inerte (nada quebra). Só pedido PAGO (Pix confirmado/cartão aprovado); boleto fica para a fase 2.
 */

import { isUuid } from "@/lib/b2b/admin-input";
import { andNotArchived } from "@/lib/b2b/archive";
import type { SqlRunner } from "@/lib/b2b/ownership";
import { buildAdsTagUrl } from "@/lib/ads-tag";

/** Associa o oppref (do cookie bio_oppref) ao pedido na criação. Só preenche se estiver vazio; tolera o SQL 44b ausente. */
export async function attachOppref(run: SqlRunner, orderId: string, oppref: string | null | undefined): Promise<boolean> {
  const value = String(oppref ?? "").trim();
  if (!value || value.length > 512 || !isUuid(orderId)) return false;

  try {
    const rows = await run(`UPDATE orders SET oppref = $2 WHERE id = $1::uuid AND oppref IS NULL RETURNING id`, [orderId, value]);
    return rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * Reivindica a tag do pedido: atômico (UPDATE ... WHERE ads_tag_sent_at IS NULL), então só UMA chamada recebe a URL.
 * null = nada a renderizar (não pago, boleto, arquivado, já enviada ou colunas ausentes).
 */
export async function claimAdsTag(run: SqlRunner, orderId: string, cookieOppref?: string | null): Promise<string | null> {
  if (!isUuid(orderId)) return null;

  try {
    const notArchived = await andNotArchived(run, "orders", "orders");
    const rows = await run(
      `UPDATE orders
          SET ads_event_id = COALESCE(ads_event_id, gen_random_uuid()),
              ads_tag_sent_at = now()
        WHERE id = $1::uuid
          AND ads_tag_sent_at IS NULL
          AND status IN ('paid', 'approved')
          AND payment_method IS DISTINCT FROM 'boleto'
          AND total_cents > 0${notArchived}
      RETURNING ads_event_id::text AS event_id, total_cents, oppref`,
      [orderId]
    );

    const row = rows[0];
    if (!row) return null;

    const stored = row.oppref ? String(row.oppref) : null;

    return buildAdsTagUrl({
      eventId: String(row.event_id),
      amountCents: Number(row.total_cents),
      oppref: stored ?? (cookieOppref ? String(cookieOppref) : null),
    });
  } catch {
    return null;
  }
}
