/**
 * ADMIN — baixa manual de Pix recebido FORA do site (aprovada em princípio pelo Luis, 16/11; caso da vendedora que vendeu por Pix
 * direto). Desenho na PASSAGEM_BIO:
 *  - só pedido pendente, forma de pagamento Pix, não arquivado; valor IGUAL ao total; data do recebimento; referência do comprovante;
 *    nome de quem dá a baixa (o admin tem login único);
 *  - registro: linha em payments (provider "manual", pix, paid, data = data do recebimento) + evento "pix_manual_paid" em
 *    order_events; segunda baixa no mesmo pedido = recusada;
 *  - depois: o MESMO finalizador do pagamento aprovado (status paid, separação, cupom/parceiro, e-mail "uma vez por etapa");
 *  - comissão: conta a partir da data do recebimento (1ª linha paid de payments). Sem SQL novo.
 */

import type { SqlRunner } from "@/lib/b2b/ownership";
import { notArchivedCondition } from "@/lib/b2b/archive";

export const MANUAL_PIX_EVENT = "pix_manual_paid";

export type ManualPixInput = { by: unknown; amountCents: unknown; receivedOn: unknown; reference: unknown };
export type ManualPixClean = { by: string; amountCents: number; receivedOn: string; reference: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Validação dos campos (pura). `today` = AAAA-MM-DD em São Paulo. */
export function validateManualPix(input: ManualPixInput, today: string): { ok: true; value: ManualPixClean } | { ok: false; error: string } {
  const by = String(input.by ?? "").trim().replace(/\s+/g, " ");
  const reference = String(input.reference ?? "").trim().replace(/\s+/g, " ");
  const receivedOn = String(input.receivedOn ?? "").trim();
  const amountCents = Number(input.amountCents);

  if (by.length < 2 || by.length > 80) return { ok: false, error: "Informe quem está dando a baixa (nome)." };
  if (!Number.isInteger(amountCents) || amountCents <= 0) return { ok: false, error: "Informe o valor recebido." };
  if (!DATE_RE.test(receivedOn) || Number.isNaN(Date.parse(`${receivedOn}T12:00:00Z`))) return { ok: false, error: "Informe a data do recebimento." };
  if (receivedOn > today) return { ok: false, error: "A data do recebimento não pode ser no futuro." };
  if (reference.length < 3 || reference.length > 120) return { ok: false, error: "Informe a referência do comprovante (ID do Pix ou banco + horário)." };
  // Comprovante: só a referência, nunca CPF/CNPJ inteiro.
  if (/\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/.test(reference)) {
    return { ok: false, error: "Não coloque CPF ou CNPJ na referência; use o ID do Pix ou banco + horário." };
  }

  return { ok: true, value: { by, amountCents, receivedOn, reference } };
}

const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export type ManualPixResult =
  | { ok: true; resumed: boolean }
  | { ok: false; status: 400 | 404 | 409; error: string };

/**
 * Dá a baixa. `finalize` = o finalizador do pagamento aprovado (injetável no teste). Se a linha manual já existe e o pedido ainda
 * está pendente (o finalizador falhou na 1ª vez), só termina a finalização (sem gravar de novo).
 */
export async function recordManualPix(
  run: SqlRunner,
  orderId: string,
  input: ManualPixInput,
  options: { today: string; nowIso?: string; finalize: (args: { orderId: string; providerPaymentId: string; paidAt: string }) => Promise<unknown> }
): Promise<ManualPixResult> {
  const valid = validateManualPix(input, options.today);
  if (!valid.ok) return { ok: false, status: 400, error: valid.error };

  const { by, amountCents, receivedOn, reference } = valid.value;
  const live = await notArchivedCondition(run, "orders", "o");
  const [order] = await run(
    `SELECT o.id, o.status, o.total_cents, to_jsonb(o) ->> 'payment_method' AS payment_method, (${live}) AS live
       FROM orders o WHERE o.id = $1::uuid LIMIT 1`,
    [orderId]
  );

  if (!order) return { ok: false, status: 404, error: "Pedido não encontrado." };
  if (order.live === false) return { ok: false, status: 409, error: "Pedido arquivado." };
  if (String(order.payment_method ?? "") !== "pix") return { ok: false, status: 409, error: "Este pedido não é de Pix." };
  if (String(order.status) !== "pending") return { ok: false, status: 409, error: "Este pedido não está aguardando pagamento." };

  const total = Number(order.total_cents);
  if (amountCents !== total) {
    return { ok: false, status: 409, error: `O valor recebido (${brl(amountCents)}) é diferente do total do pedido (${brl(total)}). Confira antes de dar a baixa.` };
  }

  const paidAt = `${receivedOn}T12:00:00-03:00`;
  const raw = JSON.stringify({ manual: true, by, amountCents, receivedOn, reference, registeredAt: options.nowIso ?? new Date().toISOString() });

  // Grava só se ainda não há baixa manual neste pedido (dois cliques ao mesmo tempo: só um entra).
  const inserted = await run(
    `INSERT INTO payments (order_id, provider, external_id, method, status, raw_payload, created_at)
     SELECT $1::uuid, 'manual', $2, 'pix', 'paid', $3::jsonb, $4::timestamptz
      WHERE NOT EXISTS (SELECT 1 FROM payments WHERE order_id = $1::uuid AND provider = 'manual' AND status = 'paid')
     RETURNING id`,
    [orderId, reference.slice(0, 120), raw, paidAt]
  );

  const resumed = inserted.length === 0;

  if (!resumed) {
    try {
      await run(`INSERT INTO order_events (order_id, event, note, created_by) VALUES ($1, $2, $3, $4)`, [
        orderId,
        MANUAL_PIX_EVENT,
        `Pix pago fora do site: ${brl(amountCents)} em ${ddmm(receivedOn)}, comprovante ${reference}, por ${by}`.slice(0, 300),
        `admin: ${by}`.slice(0, 80),
      ]);
    } catch {
      // sem a tabela de eventos: a baixa vale do mesmo jeito (fica em payments)
    }
  }

  const [payment] = await run(`SELECT id FROM payments WHERE order_id = $1::uuid AND provider = 'manual' AND status = 'paid' ORDER BY created_at LIMIT 1`, [orderId]);

  await options.finalize({ orderId, providerPaymentId: `manual-pix:${payment?.id ?? reference}`, paidAt: new Date(paidAt).toISOString() });

  return { ok: true, resumed };
}
