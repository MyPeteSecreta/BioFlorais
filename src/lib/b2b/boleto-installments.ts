/**
 * BIO FLORAIS B2B — baixa de boletos por PARCELA (C10).
 *
 * Fonte do cronograma: b2b_boleto_requests.schedule ([{installment, dueDate,
 * amountCents}]). A BAIXA (data do pagamento, valor pago) fica em
 * b2b_boleto_payments (sql/b2b/20b). Situação da parcela:
 *   Pago      = tem baixa
 *   Cancelado = pedido cancelado/estornado e sem baixa
 *   Vencido   = vencimento (data civil de São Paulo) anterior a hoje, sem baixa
 *   Em aberto = o resto
 * A baixa alimenta: a comissão da parcela ("A receber" no dia 10 do mês
 * seguinte à DATA DA BAIXA, nunca pelo vencimento — commissions.ts) e o status
 * do pedido (todas as parcelas baixadas = "Pago").
 * SQL puro sobre SqlRunner (roda no Neon e no PGlite dos testes).
 */

import { andNotArchived } from "@/lib/b2b/archive";
import type { SqlRunner } from "@/lib/b2b/ownership";
import { isUuid } from "@/lib/b2b/admin-input";

export type InstallmentStatus = "aberto" | "vencido" | "pago" | "cancelado";

export type BoletoInstallment = {
  orderId: string;
  orderNumber: string;
  clientName: string;
  responsibleName: string;
  installment: number;
  installments: number;
  dueDate: string | null; // AAAA-MM-DD
  amountCents: number;
  status: InstallmentStatus;
  paidAt: string | null; // AAAA-MM-DD
  paidCents: number | null;
  note: string | null;
};

const CANCELLED = ["cancelled", "canceled", "failed", "expired", "refunded", "rejected"];

/** Hoje (AAAA-MM-DD) no calendário de São Paulo. */
export function todaySaoPaulo(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}

export function installmentStatus(input: {
  orderStatus: string;
  dueDate: string | null;
  paid: boolean;
  today: string;
}): InstallmentStatus {
  if (input.paid) return "pago";
  if (CANCELLED.includes(input.orderStatus)) return "cancelado";
  if (input.dueDate && input.dueDate < input.today) return "vencido";
  return "aberto";
}

export type InstallmentFilters = {
  status?: InstallmentStatus | "" | null;
  dueFrom?: string | null;
  dueTo?: string | null;
  clientId?: string | null;
  responsibleId?: string | null;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parcelas de todos os boletos B2B (cronograma expandido + baixas), com filtros. */
export async function loadBoletoInstallments(
  run: SqlRunner,
  filters: InstallmentFilters = {},
  now = new Date()
): Promise<BoletoInstallment[]> {
  const today = todaySaoPaulo(now);
  const clientId = filters.clientId && isUuid(filters.clientId) ? filters.clientId : null;
  const responsibleId = filters.responsibleId && isUuid(filters.responsibleId) ? filters.responsibleId : null;
  const dueFrom = filters.dueFrom && DATE_RE.test(filters.dueFrom) ? filters.dueFrom : null;
  const dueTo = filters.dueTo && DATE_RE.test(filters.dueTo) ? filters.dueTo : null;

  const notArchived = await andNotArchived(run, "orders", "o");
  const rows = await run(
    `SELECT o.id AS order_id, o.status AS order_status,
            coalesce(c.display_name, '') AS client_name,
            coalesce(o.b2b_responsible_name, r.name, '') AS responsible_name,
            br.installments,
            CASE WHEN br.schedule IS NOT NULL AND jsonb_typeof(br.schedule) = 'array' AND jsonb_array_length(br.schedule) > 0
                 THEN (e.item ->> 'installment')::int ELSE e.n END AS installment,
            e.item ->> 'dueDate' AS due_date,
            coalesce((e.item ->> 'amountCents')::int,
                     CASE WHEN e.n = br.installments THEN br.last_installment_amount_cents ELSE br.installment_amount_cents END) AS amount_cents,
            to_char(bp.paid_at, 'YYYY-MM-DD') AS paid_at, bp.paid_cents, bp.note
       FROM b2b_boleto_requests br
       JOIN orders o ON o.id = br.order_id
       LEFT JOIN b2b_clients c ON c.id = o.b2b_client_id
       LEFT JOIN b2b_responsibles r ON r.id = o.b2b_responsible_id
       CROSS JOIN LATERAL (
         SELECT item, n FROM (
           SELECT item, ord::int AS n
             FROM jsonb_array_elements(CASE WHEN br.schedule IS NOT NULL AND jsonb_typeof(br.schedule) = 'array'
                                            THEN br.schedule ELSE '[]'::jsonb END) WITH ORDINALITY AS t(item, ord)
           UNION ALL
           SELECT NULL::jsonb, g FROM generate_series(1, br.installments) g
            WHERE br.schedule IS NULL OR jsonb_typeof(br.schedule) <> 'array' OR jsonb_array_length(br.schedule) = 0
         ) x
       ) e
       LEFT JOIN b2b_boleto_payments bp
              ON bp.order_id = o.id
             AND bp.installment = CASE WHEN br.schedule IS NOT NULL AND jsonb_typeof(br.schedule) = 'array' AND jsonb_array_length(br.schedule) > 0
                                       THEN (e.item ->> 'installment')::int ELSE e.n END
      WHERE o.b2b_offer_id IS NOT NULL${notArchived}
        AND ($1::uuid IS NULL OR o.b2b_client_id = $1::uuid)
        AND ($2::uuid IS NULL OR o.b2b_responsible_id = $2::uuid)
      ORDER BY due_date NULLS LAST, o.created_at, installment`,
    [clientId, responsibleId]
  );

  const list = rows
    .map<BoletoInstallment>((row) => {
      const dueDate = (row.due_date as string | null) ?? null;
      const paid = Boolean(row.paid_at);

      return {
        orderId: String(row.order_id),
        orderNumber: String(row.order_id).slice(0, 8).toUpperCase(),
        clientName: String(row.client_name ?? ""),
        responsibleName: String(row.responsible_name ?? ""),
        installment: Number(row.installment),
        installments: Number(row.installments),
        dueDate,
        amountCents: Number(row.amount_cents ?? 0),
        status: installmentStatus({ orderStatus: String(row.order_status ?? ""), dueDate, paid, today }),
        paidAt: (row.paid_at as string | null) ?? null,
        paidCents: row.paid_cents === null || row.paid_cents === undefined ? null : Number(row.paid_cents),
        note: (row.note as string | null) ?? null,
      };
    })
    .filter((item) => !filters.status || item.status === filters.status)
    .filter((item) => !dueFrom || (item.dueDate !== null && item.dueDate >= dueFrom))
    .filter((item) => !dueTo || (item.dueDate !== null && item.dueDate <= dueTo));

  return list;
}

export type BaixaResult = { ok: true; orderPaid: boolean } | { ok: false; status: number; error: string };

/**
 * Dá baixa numa parcela. Aceita valor diferente do da parcela, mas exige
 * observação. Quando TODAS as parcelas do pedido estão baixadas, o pedido
 * (B2B, boleto) passa a "Pago" e entra na separação.
 */
export async function giveBaixa(
  run: SqlRunner,
  input: { orderId: string; installment: number; paidAt: string; paidCents: number | null; note: string | null },
  now = new Date()
): Promise<BaixaResult> {
  if (!isUuid(input.orderId) || !Number.isInteger(input.installment) || input.installment < 1) {
    return { ok: false, status: 400, error: "Parcela inválida." };
  }

  if (!DATE_RE.test(input.paidAt) || input.paidAt > todaySaoPaulo(now)) {
    return { ok: false, status: 400, error: "Informe a data do pagamento (não pode ser futura)." };
  }

  const installments = await loadBoletoInstallments(run, {}, now);
  const mine = installments.filter((item) => item.orderId === input.orderId);
  const target = mine.find((item) => item.installment === input.installment);

  if (!target) return { ok: false, status: 404, error: "Parcela não encontrada." };
  if (target.status === "pago") return { ok: false, status: 409, error: "Esta parcela já tem baixa." };
  if (target.status === "cancelado") return { ok: false, status: 409, error: "Pedido cancelado: não é possível dar baixa." };

  const paidCents = input.paidCents ?? target.amountCents;

  if (!Number.isInteger(paidCents) || paidCents <= 0) {
    return { ok: false, status: 400, error: "Valor pago inválido." };
  }

  if (paidCents !== target.amountCents && !input.note?.trim()) {
    return { ok: false, status: 400, error: "O valor pago é diferente do da parcela: informe uma observação." };
  }

  await run(
    `INSERT INTO b2b_boleto_payments (order_id, installment, paid_at, paid_cents, note, created_by)
     VALUES ($1, $2, $3::date, $4, $5, 'admin')`,
    [input.orderId, input.installment, input.paidAt, paidCents, input.note?.trim() || null]
  );
  await run(
    `INSERT INTO b2b_boleto_payment_log (order_id, installment, action, paid_at, paid_cents, note, created_by)
     VALUES ($1, $2, 'baixa', $3::date, $4, $5, 'admin')`,
    [input.orderId, input.installment, input.paidAt, paidCents, input.note?.trim() || null]
  );

  const allPaid = mine.every((item) => item.installment === input.installment || item.status === "pago");

  if (allPaid) {
    // Pedido B2B por boleto com todas as parcelas baixadas = Pago (entra na separação).
    await run(
      `UPDATE orders SET status = 'paid', fulfillment_status = 'paid_to_prepare'
        WHERE id = $1 AND b2b_offer_id IS NOT NULL AND payment_method = 'boleto' AND status = 'pending'`,
      [input.orderId]
    );
  }

  return { ok: true, orderPaid: allPaid };
}

/** Desfaz a baixa (com motivo). Se o pedido já avançou na separação, não desfaz. */
export async function undoBaixa(
  run: SqlRunner,
  input: { orderId: string; installment: number; reason: string }
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!isUuid(input.orderId) || !Number.isInteger(input.installment)) {
    return { ok: false, status: 400, error: "Parcela inválida." };
  }

  if (!input.reason.trim()) return { ok: false, status: 400, error: "Informe o motivo para desfazer a baixa." };

  const [baixa] = await run(
    `SELECT to_char(paid_at, 'YYYY-MM-DD') AS paid_at, paid_cents FROM b2b_boleto_payments WHERE order_id = $1 AND installment = $2`,
    [input.orderId, input.installment]
  );

  if (!baixa) return { ok: false, status: 404, error: "Esta parcela não tem baixa." };

  const [order] = await run(`SELECT status, fulfillment_status FROM orders WHERE id = $1`, [input.orderId]);

  if (
    order?.status === "paid" &&
    !["paid_to_prepare", "awaiting_payment"].includes(String(order.fulfillment_status ?? ""))
  ) {
    return { ok: false, status: 409, error: "O pedido já avançou na separação/envio: não dá para desfazer a baixa." };
  }

  // A comissão dessa parcela já paga ao vendedor trava o desfazer (desfaça o pagamento da comissão antes).
  const [payout] = await run(
    `SELECT 1 AS x FROM b2b_commission_payouts WHERE order_id = $1 AND installment = $2`,
    [input.orderId, input.installment]
  ).catch(() => []);

  if (payout) {
    return { ok: false, status: 409, error: "A comissão desta parcela já foi paga ao vendedor: desfaça esse pagamento primeiro." };
  }

  await run(`DELETE FROM b2b_boleto_payments WHERE order_id = $1 AND installment = $2`, [input.orderId, input.installment]);
  await run(
    `INSERT INTO b2b_boleto_payment_log (order_id, installment, action, paid_at, paid_cents, note, created_by)
     VALUES ($1, $2, 'desfeita', $3::date, $4, $5, 'admin')`,
    [input.orderId, input.installment, baixa.paid_at, baixa.paid_cents, input.reason.trim()]
  );

  // Pedido deixa de estar todo pago: volta a aguardar (só se ainda não foi para a separação).
  await run(
    `UPDATE orders SET status = 'pending', fulfillment_status = 'awaiting_payment'
      WHERE id = $1 AND b2b_offer_id IS NOT NULL AND payment_method = 'boleto'
        AND status = 'paid' AND fulfillment_status = 'paid_to_prepare'`,
    [input.orderId]
  );

  return { ok: true };
}
