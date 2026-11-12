/**
 * LEMBRETE DE PEDIDO NÃO PAGO (B2C). Tarefa automática (cron a cada 15 min): pedido B2C em pending/checkout_pending há mais de 2 h e
 * menos de 48 h, com e-mail e ainda sem lembrete, recebe UM e-mail transacional ("Seu pedido está separado"): itens, total e o link para
 * retomar o pagamento (/pagar/<token>: Pix novo se venceu; se o cartão foi recusado, a página sugere Pix). Sem propaganda.
 * Nunca: pedido pago ou cancelado, B2B, orçamento, arquivado, sem e-mail ou que já recebeu o lembrete (orders.payment_reminder_sent_at, SQL 55b).
 *
 * Tudo em SQL puro sobre SqlRunner (roda no Neon e no PGlite dos testes). O envio fica por injeção (sendEmail do Resend em produção),
 * então os testes cobrem a seleção, o "claim" (um só envio mesmo com dois crons ao mesmo tempo) e o texto, sem rede.
 */

import type { SqlRunner } from "@/lib/b2b/ownership";
import { PRODUCT_EMAIL_IMAGES } from "@/lib/catalog/product-email-images";
import { B2C_FREE_SHIPPING_THRESHOLD_CENTS } from "@/lib/checkout/benefits";
import { BRAND } from "@/lib/order-emails";
import { signTrackingToken } from "@/lib/order-tracking";

export const REMINDER_MIN_AGE_MS = 2 * 60 * 60 * 1000;
export const REMINDER_MAX_AGE_MS = 48 * 60 * 60 * 1000;
export const REMINDER_BATCH = 40;
export const REMINDER_STATUSES = ["pending", "checkout_pending"] as const;

export type ReminderCandidate = {
  orderId: string;
  status: string;
  email: string;
  name: string;
  totalCents: number;
  lastMethod: string | null;
  lastPaymentStatus: string | null;
  /** slug e valor da linha: foto e preço no e-mail (opcionais). */
  items: Array<{ name: string; qty: number; slug?: string | null; lineCents?: number }>;
  /** Frete cobrado no pedido (null = desconhecido). */
  shippingCents?: number | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Pedidos elegíveis agora. B2C de verdade: sem oferta/cliente B2B; só os dois status de pagamento pendente; janela de 2 h a 48 h (Luis, 12/11: era 1 h);
 * e-mail válido; sem lembrete anterior; sem pagamento já aprovado; não arquivado.
 */
export async function findReminderCandidates(run: SqlRunner, now = new Date(), limit = REMINDER_BATCH): Promise<ReminderCandidate[]> {
  // orders.created_at é timestamp SEM fuso, gravado em UTC: compara como timestamp (sem depender do fuso da sessão).
  const newest = new Date(now.getTime() - REMINDER_MIN_AGE_MS).toISOString().replace("Z", "");
  const oldest = new Date(now.getTime() - REMINDER_MAX_AGE_MS).toISOString().replace("Z", "");

  const rows = await run(
    `SELECT o.id, o.status, o.total_cents, to_jsonb(o) ->> 'shipping_cents' AS shipping_cents, c.email, c.name,
            lp.method AS last_method, lp.status AS last_payment_status
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       LEFT JOIN LATERAL (SELECT p.method, p.status FROM payments p WHERE p.order_id = o.id ORDER BY p.created_at DESC LIMIT 1) lp ON true
      WHERE o.status = ANY($1::text[])
        AND o.payment_reminder_sent_at IS NULL
        AND o.created_at < $2::timestamp AND o.created_at > $3::timestamp
        AND o.b2b_offer_id IS NULL AND o.b2b_client_id IS NULL
        AND COALESCE(to_jsonb(o) ->> 'archived_at', '') = ''
        AND COALESCE(btrim(c.email), '') <> ''
        AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id AND p.status IN ('paid', 'approved', 'authorized'))
      ORDER BY o.created_at
      LIMIT $4`,
    [[...REMINDER_STATUSES], newest, oldest, limit]
  );

  const candidates: ReminderCandidate[] = [];

  for (const row of rows) {
    const email = String(row.email ?? "").trim();

    if (!EMAIL_RE.test(email)) continue;

    const items = await run(
      `SELECT i.qty, i.unit_price_cents, to_jsonb(p) ->> 'slug' AS slug, COALESCE(to_jsonb(i) ->> 'product_name_snapshot', p.name, 'Produto') AS name
         FROM order_items i LEFT JOIN products p ON p.id = i.product_id
        WHERE i.order_id = $1::uuid AND i.unit_price_cents > 0 ORDER BY i.unit_price_cents DESC, p.name`,
      [String(row.id)]
    );

    candidates.push({
      orderId: String(row.id),
      status: String(row.status),
      email,
      name: String(row.name ?? ""),
      totalCents: Number(row.total_cents ?? 0),
      lastMethod: (row.last_method as string | null) ?? null,
      lastPaymentStatus: (row.last_payment_status as string | null) ?? null,
      items: items.map((item) => ({
        name: String(item.name),
        qty: Number(item.qty ?? 0),
        slug: (item.slug as string | null) ?? null,
        lineCents: Number(item.unit_price_cents ?? 0) * Number(item.qty ?? 0),
      })),
      shippingCents: row.shipping_cents === null || row.shipping_cents === undefined ? null : Number(row.shipping_cents),
    });
  }

  return candidates;
}

/**
 * Reserva o envio: marca o lembrete ANTES de mandar e só devolve true para quem conseguiu (dois crons ao mesmo tempo não duplicam).
 * Repete as travas de status, para um pedido que foi pago ou cancelado entre a seleção e o envio.
 */
export async function claimReminder(run: SqlRunner, orderId: string): Promise<boolean> {
  const rows = await run(
    `UPDATE orders SET payment_reminder_sent_at = (now() AT TIME ZONE 'UTC')
      WHERE id = $1::uuid AND payment_reminder_sent_at IS NULL AND status = ANY($2::text[])
        AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id = orders.id AND p.status IN ('paid', 'approved', 'authorized'))
      RETURNING id`,
    [orderId, [...REMINDER_STATUSES]]
  );

  return rows.length > 0;
}

/** O envio falhou: devolve o pedido para a fila (a próxima rodada tenta de novo, dentro das 48 h). */
export async function releaseReminder(run: SqlRunner, orderId: string): Promise<void> {
  await run(`UPDATE orders SET payment_reminder_sent_at = NULL WHERE id = $1::uuid`, [orderId]);
}

const brl = (cents: number) => `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const firstName = (name: string) => name.trim().split(/\s+/)[0] || "";
const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Link para retomar o pagamento (página /pagar/<token>); null se o segredo de assinatura não está configurado. */
export function resumeUrl(siteUrl: string, orderId: string): string | null {
  const token = signTrackingToken(orderId);

  return token ? `${siteUrl.replace(/\/$/, "")}/pagar/${token}` : null;
}

/** O último pagamento foi com cartão e não deu certo (recusado/cancelado/rejeitado)? */
export function cardWasDeclined(candidate: Pick<ReminderCandidate, "lastMethod" | "lastPaymentStatus" | "status">): boolean {
  const failed = ["rejected", "refused", "declined", "failed", "cancelled", "canceled"].includes(String(candidate.lastPaymentStatus ?? "").toLowerCase());

  return (candidate.lastMethod === "card" || candidate.lastMethod === "credit_card") && (failed || candidate.status === "checkout_pending");
}

/** Foto do produto para o e-mail: versão pequena (128 px) pelo otimizador de imagens do próprio site. null sem foto. */
export function emailImageUrl(origin: string, slug: string | null | undefined): string | null {
  const path = slug ? PRODUCT_EMAIL_IMAGES[slug] : undefined;

  return path ? `${origin}/_next/image?url=${encodeURIComponent(path)}&w=128&q=75` : null;
}

/** Frete no e-mail, só quando ajuda: grátis neste pedido, ou o aviso de grátis a partir de R$ 70 (sem pressão). */
export function reminderShippingNote(candidate: Pick<ReminderCandidate, "items" | "shippingCents">): string | null {
  const merchandise = candidate.items.reduce((sum, item) => sum + (item.lineCents ?? 0), 0);

  if (candidate.shippingCents === 0 && merchandise > 0) return "O frete deste pedido é grátis.";
  if (merchandise > 0 && merchandise < B2C_FREE_SHIPPING_THRESHOLD_CENTS) {
    return `Frete grátis a partir de ${brl(B2C_FREE_SHIPPING_THRESHOLD_CENTS).replace(",00", "")} em produtos.`;
  }

  return null;
}

/**
 * Lembrete 2 h depois (sem desconto). Visual no padrão dos e-mails de andamento (moldura bege, "Bio Florais" no topo): foto e nome
 * dos itens, total, botão grande "Concluir meu pedido", frete grátis quando couber. Tom acolhedor, sem pressão (Luis, 12/11).
 */
export function buildReminderEmail(candidate: ReminderCandidate, link: string): { subject: string; text: string; html: string } {
  const number = candidate.orderId.slice(0, 8).toUpperCase();
  const greeting = firstName(candidate.name) ? `Olá, ${firstName(candidate.name)}.` : "Olá.";
  const lines = candidate.items.map((item) => `${item.qty}× ${item.name}`);
  const cardTip = cardWasDeclined(candidate) ? "O pagamento no cartão não foi concluído. Se preferir, o Pix costuma ser aprovado na hora." : "Se o Pix venceu, é só gerar outro na própria página.";
  const shipping = reminderShippingNote(candidate);
  let origin = "";

  try {
    origin = new URL(link).origin;
  } catch {
    origin = "";
  }

  const subject = `Seu pedido #${number} está separado`;
  const text = [
    greeting,
    "",
    `Seu pedido #${number} está separado e aguarda o pagamento. Guardamos tudo para você.`,
    "",
    ...lines,
    "",
    `Total: ${brl(candidate.totalCents)}`,
    ...(shipping ? [shipping] : []),
    "",
    `Concluir meu pedido: ${link}`,
    cardTip,
    "",
    "Se você já pagou ou não quer mais o pedido, pode ignorar este e-mail.",
    "Bio Florais",
  ].join("\n");

  const cell = `font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:${BRAND.green}`;
  const itemRows = candidate.items
    .map((item) => {
      const image = origin ? emailImageUrl(origin, item.slug) : null;
      const photo = image
        ? `<img src="${escapeHtml(image)}" width="64" height="64" alt="${escapeHtml(item.name)}" style="display:block;width:64px;height:64px;object-fit:contain;border-radius:12px;background:${BRAND.beige}">`
        : `<div style="width:64px;height:64px;border-radius:12px;background:${BRAND.beige}"></div>`;
      const price = `<td align="right" style="padding:10px 0;border-bottom:1px solid ${BRAND.line};${cell};white-space:nowrap;vertical-align:middle">${item.lineCents ? brl(item.lineCents) : ""}</td>`;

      return `<tr><td width="76" style="padding:10px 12px 10px 0;border-bottom:1px solid ${BRAND.line};vertical-align:middle">${photo}</td><td style="padding:10px 0;border-bottom:1px solid ${BRAND.line};${cell};vertical-align:middle"><strong>${escapeHtml(item.name)}</strong><br><span style="color:${BRAND.muted};font-size:13px">Quantidade: ${item.qty}</span></td>${price}</tr>`;
    })
    .join("");

  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:0;background:${BRAND.beige}">
<table role="presentation" width="100%" style="background:${BRAND.beige};padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid ${BRAND.line};border-radius:16px">
<tr><td style="padding:22px 24px;border-bottom:1px solid ${BRAND.line};font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:bold;color:${BRAND.green}">${escapeHtml(BRAND.name)}</td></tr>
<tr><td style="padding:22px 24px;${cell}">
<p style="margin:0 0 6px;font-size:17px">${escapeHtml(greeting)}</p>
<p style="margin:0 0 18px">Seu pedido <strong>#${number}</strong> está separado e aguarda o pagamento. Guardamos tudo para você.</p>
<table role="presentation" width="100%" style="border-collapse:collapse;margin:0 0 12px">${itemRows}</table>
<table role="presentation" width="100%" style="margin:0 0 6px"><tr><td style="${cell};font-size:17px"><strong>Total</strong></td><td align="right" style="${cell};font-size:20px"><strong>${brl(candidate.totalCents)}</strong></td></tr></table>
${shipping ? `<p style="margin:0 0 18px;color:${BRAND.muted};font-size:13px">${escapeHtml(shipping)}</p>` : '<div style="height:12px"></div>'}
<table role="presentation" width="100%" style="margin:6px 0 18px"><tr><td align="center" style="border-radius:999px;background:${BRAND.green}"><a href="${escapeHtml(link)}" style="display:block;padding:16px 24px;font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:999px">Concluir meu pedido</a></td></tr></table>
<p style="margin:0 0 14px;font-size:14px">${escapeHtml(cardTip)}</p>
<p style="margin:0;font-size:12px;color:${BRAND.muted}">Se você já pagou ou não quer mais o pedido, pode ignorar este e-mail.</p>
</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid ${BRAND.line};font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${BRAND.muted}">Este e-mail é sobre o seu pedido na ${escapeHtml(BRAND.name)}. Pedido #${number}.</td></tr>
</table></td></tr></table></body></html>`;

  return { subject, text, html };
}

export type ReminderSummary = { candidates: number; sent: number; skipped: number; failed: number };

/** Uma rodada do cron: seleciona, reserva, envia (ou devolve para a fila se o envio falhar). */
export async function runPaymentReminders(
  run: SqlRunner,
  deps: { send: (mail: { to: string; subject: string; text: string; html: string }) => Promise<boolean>; siteUrl: string; now?: Date }
): Promise<ReminderSummary> {
  const candidates = await findReminderCandidates(run, deps.now ?? new Date());
  const summary: ReminderSummary = { candidates: candidates.length, sent: 0, skipped: 0, failed: 0 };

  for (const candidate of candidates) {
    const link = resumeUrl(deps.siteUrl, candidate.orderId);

    if (!link) {
      summary.skipped += 1;
      continue;
    }

    if (!(await claimReminder(run, candidate.orderId))) {
      summary.skipped += 1;
      continue;
    }

    const mail = buildReminderEmail(candidate, link);
    const ok = await deps.send({ to: candidate.email, ...mail });

    if (ok) {
      summary.sent += 1;
    } else {
      await releaseReminder(run, candidate.orderId);
      summary.failed += 1;
    }
  }

  return summary;
}
