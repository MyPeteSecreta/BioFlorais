/**
 * Image Tag do ChatGPT Ads no servidor: guarda o oppref no pedido e entrega UMA vez a URL da tag do pedido PAGO.
 * Colunas (SQL 44b): orders.oppref, orders.ads_event_id (UUID aleatório; nunca o número do pedido) e
 * orders.ads_tag_sent_at (marca "tag enviada": não repete ao recarregar nem em outro aparelho). A marca só é gravada
 * quando o navegador confirma que a imagem CARREGOU (onLoad): se uma extensão/navegador bloquear a imagem (onError),
 * nada é marcado e a tag pode ser oferecida de novo (o mesmo event_id deduplica do lado da plataforma). Sem as colunas
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
 * Oferece a tag do pedido PAGO: garante o event_id (UUID aleatório, salvo no pedido) e devolve a URL SEM marcar como
 * enviada (quem marca é confirmAdsTagSent, depois do onLoad). Enquanto não confirmada, devolve a MESMA URL (mesmo
 * event_id: sem duplicar conversão). null = nada a renderizar (não pago, boleto, arquivado, já enviada ou colunas ausentes).
 */
export async function claimAdsTag(run: SqlRunner, orderId: string, cookieOppref?: string | null): Promise<string | null> {
  if (!isUuid(orderId)) return null;

  try {
    const notArchived = await andNotArchived(run, "orders", "orders");
    const rows = await run(
      `UPDATE orders
          SET ads_event_id = COALESCE(ads_event_id, gen_random_uuid())
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

/**
 * O navegador confirmou que a imagem carregou (onLoad): marca "tag enviada" (atômico, uma vez). Só marca se o
 * event_id já foi entregue e o pedido continua pago. true = marcou agora.
 */
export async function confirmAdsTagSent(run: SqlRunner, orderId: string): Promise<boolean> {
  if (!isUuid(orderId)) return false;

  try {
    const rows = await run(
      `UPDATE orders SET ads_tag_sent_at = now()
        WHERE id = $1::uuid AND ads_tag_sent_at IS NULL AND ads_event_id IS NOT NULL
          AND status IN ('paid', 'approved') AND payment_method IS DISTINCT FROM 'boleto'
      RETURNING id`,
      [orderId]
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}
