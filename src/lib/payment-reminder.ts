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
  items: Array<{ name: string; qty: number }>;
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
    `SELECT o.id, o.status, o.total_cents, c.email, c.name,
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
      `SELECT i.qty, COALESCE(to_jsonb(i) ->> 'product_name_snapshot', p.name, 'Produto') AS name
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
      items: items.map((item) => ({ name: String(item.name), qty: Number(item.qty ?? 0) })),
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

export function buildReminderEmail(candidate: ReminderCandidate, link: string): { subject: string; text: string; html: string } {
  const number = candidate.orderId.slice(0, 8).toUpperCase();
  const greeting = firstName(candidate.name) ? `Olá, ${firstName(candidate.name)}.` : "Olá.";
  const lines = candidate.items.map((item) => `${item.qty}× ${item.name}`);
  const cardTip = cardWasDeclined(candidate) ? "O pagamento no cartão não foi concluído. Se preferir, o Pix costuma ser aprovado na hora." : "Se o Pix venceu, é só gerar outro na própria página.";

  const subject = `Seu pedido #${number} está separado`;
  const text = [
    greeting,
    "",
    `Seu pedido #${number} está separado e aguarda o pagamento.`,
    "",
    ...lines,
    "",
    `Total: ${brl(candidate.totalCents)}`,
    "",
    `Para concluir o pagamento: ${link}`,
    cardTip,
    "",
    "Se você já pagou ou não quer mais o pedido, pode ignorar este e-mail.",
    "Bio Florais",
  ].join("\n");

  const html = [
    `<p>${escapeHtml(greeting)}</p>`,
    `<p>Seu pedido <strong>#${number}</strong> está separado e aguarda o pagamento.</p>`,
    `<ul>${candidate.items.map((item) => `<li>${item.qty}× ${escapeHtml(item.name)}</li>`).join("")}</ul>`,
    `<p><strong>Total: ${brl(candidate.totalCents)}</strong></p>`,
    `<p><a href="${escapeHtml(link)}">Concluir o pagamento</a></p>`,
    `<p>${escapeHtml(cardTip)}</p>`,
    `<p style="color:#6c5b69;font-size:12px">Se você já pagou ou não quer mais o pedido, pode ignorar este e-mail.<br>Bio Florais</p>`,
  ].join("");

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
