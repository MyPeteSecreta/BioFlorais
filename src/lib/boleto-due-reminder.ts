/**
 * AVISO DE VENCIMENTO DO BOLETO B2B (Luis, 12/11). Cron diário (manhã em São Paulo): para cada parcela EM ABERTO, um e-mail 3 dias
 * antes do vencimento e outro no dia. Uma vez por parcela e por aviso (order_events `boleto_due_3d_<n>` / `boleto_due_0d_<n>`,
 * registrado antes de mandar). Nunca: parcela com baixa (paga), pedido cancelado ou arquivado, sem e-mail.
 * As parcelas vêm de loadBoletoInstallments (mesma fonte de "Boletos a receber"). Sem SQL novo.
 */

import { loadBoletoInstallments, todaySaoPaulo, type BoletoInstallment } from "@/lib/b2b/boleto-installments";
import type { SqlRunner } from "@/lib/b2b/ownership";
import { brDateIso, brlCents, renderSimpleEmail } from "@/lib/email-layout";
import { BRAND } from "@/lib/order-emails";
import { signTrackingToken } from "@/lib/order-tracking";

export type DueKind = "3d" | "0d";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "AAAA-MM-DD" + dias (calendário, sem fuso). */
export function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

/** Qual aviso cabe hoje para a parcela (ou null). Só parcela em aberto (não vencida, não paga, não cancelada). */
export function dueKindFor(installment: Pick<BoletoInstallment, "status" | "dueDate">, today: string): DueKind | null {
  if (installment.status !== "aberto" || !installment.dueDate) return null;
  if (installment.dueDate === today) return "0d";
  if (installment.dueDate === addDaysIso(today, 3)) return "3d";

  return null;
}

export const dueEvent = (kind: DueKind, installment: number) => `boleto_due_${kind}_${installment}`;

export function buildDueEmail(
  installment: Pick<BoletoInstallment, "orderId" | "installment" | "installments" | "amountCents" | "dueDate">,
  kind: DueKind,
  ctx: { name: string; trackUrl: string; supportUrl: string }
): { subject: string; text: string; html: string } {
  const number = installment.orderId.slice(0, 8).toUpperCase();
  const due = brDateIso(installment.dueDate);
  const label = `${installment.installment}ª parcela de ${installment.installments}`;
  const subject = kind === "0d" ? `Seu boleto vence hoje · pedido #${number}` : `Seu boleto vence em 3 dias · pedido #${number}`;
  const name = String(ctx.name ?? "").trim();

  const { text, html } = renderSimpleEmail({
    greeting: name ? `Olá, ${name}.` : "Olá.",
    parts: [
      {
        p:
          kind === "0d"
            ? `Lembrete: a ${label} do boleto do pedido #${number} vence hoje (${due}).`
            : `Lembrete: a ${label} do boleto do pedido #${number} vence em 3 dias, no dia ${due}.`,
      },
      { lines: [`Valor: ${brlCents(installment.amountCents)}`, `Vencimento: ${due}`] },
      { p: "Se você já pagou, pode ignorar este e-mail: a baixa aparece no acompanhamento do pedido em alguns dias." },
      { p: `Precisa da segunda via ou de ajuda? Fale com o seu representante ou com a gente: ${ctx.supportUrl}` },
      { button: "Acompanhar pedido", url: ctx.trackUrl },
    ],
    footer: `Este e-mail é sobre o seu pedido na ${BRAND.name}. Pedido #${number}.`,
  });

  return { subject, text, html };
}

async function claim(run: SqlRunner, orderId: string, event: string): Promise<boolean> {
  const rows = await run(
    `INSERT INTO order_events (order_id, event, note, created_by)
     SELECT $1, $2, 'enviando', 'e-mail'
      WHERE NOT EXISTS (SELECT 1 FROM order_events WHERE order_id = $1 AND event = $2)
     RETURNING id`,
    [orderId, event]
  );

  return rows.length > 0;
}

export type DueSummary = { checked: number; due: number; sent: number; failed: number; skipped: number };

export async function runBoletoDueReminders(
  run: SqlRunner,
  deps: { send: (mail: { to: string; subject: string; text: string; html: string }) => Promise<boolean>; siteUrl: string; now?: Date }
): Promise<DueSummary> {
  const now = deps.now ?? new Date();
  const today = todaySaoPaulo(now);
  const installments = await loadBoletoInstallments(run, {}, now);
  const summary: DueSummary = { checked: installments.length, due: 0, sent: 0, failed: 0, skipped: 0 };
  const site = deps.siteUrl.replace(/\/$/, "");

  for (const installment of installments) {
    const kind = dueKindFor(installment, today);
    if (!kind) continue;
    summary.due += 1;

    const [customer] = await run(
      `SELECT c.email, c.name, o.status, o.fulfillment_status FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = $1`,
      [installment.orderId]
    );
    const email = String(customer?.email ?? "").trim();

    if (!EMAIL_RE.test(email) || customer?.fulfillment_status === "cancelled") {
      summary.skipped += 1;
      continue;
    }

    const event = dueEvent(kind, installment.installment);
    if (!(await claim(run, installment.orderId, event))) {
      summary.skipped += 1;
      continue;
    }

    const token = signTrackingToken(installment.orderId);
    const mail = buildDueEmail(installment, kind, {
      name: String(customer?.name ?? installment.clientName ?? ""),
      trackUrl: token ? `${site}${BRAND.trackPath}/${token}` : `${site}${BRAND.trackSearchPath}`,
      supportUrl: `${site}${BRAND.supportPath}`,
    });
    const ok = await deps.send({ to: email, ...mail }).catch(() => false);

    await run(`UPDATE order_events SET note = $3 WHERE order_id = $1 AND event = $2`, [installment.orderId, event, ok ? "enviado" : "não enviado: falha no envio"]);

    if (ok) summary.sent += 1;
    else summary.failed += 1;
  }

  return summary;
}
