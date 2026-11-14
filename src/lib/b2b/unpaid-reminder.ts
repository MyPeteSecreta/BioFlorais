/**
 * Item 41 (14/11): pedido B2B (oferta do lojista / pedido lançado pelo vendedor) NÃO PAGO recebe 2 lembretes por e-mail:
 *  - 1º: 2 h a 48 h depois do pedido;  2º: 48 h a 72 h depois.
 *  - SEMPRE com o preço do pedido (PREÇO CHEIO): nunca cupom, nunca a oferta de 10% do B2C.
 *  - O botão leva ao LINK DE PAGAMENTO (/b2b/pagar, Pix ou cartão; Pix vencido gera outro na hora; item 42).
 *  - Só Pix ou cartão pendente. Boleto a prazo NÃO entra (tem os avisos de vencimento próprios); mostruário não entra (não tem oferta).
 *  - Uma vez cada, registrado em order_events (b2b_unpaid_1 / b2b_unpaid_2) ANTES de mandar.
 *  - Liga/desliga em /admin/recuperacao (b2b_settings `b2b_unpaid_reminder`). Vem DESLIGADO até o Luis aprovar os textos.
 * SQL puro sobre SqlRunner (Neon e PGlite). Sem SQL novo.
 */

import type { SqlRunner } from "@/lib/b2b/ownership";
import { brlCents, renderSimpleEmail } from "@/lib/email-layout";

export const B2B_REMINDER_SETTING_KEY = "b2b_unpaid_reminder";
export const B2B_REMINDER_EVENTS = { first: "b2b_unpaid_1", second: "b2b_unpaid_2" } as const;
export const B2B_REMINDER_WINDOWS = {
  first: { minMs: 2 * 60 * 60 * 1000, maxMs: 48 * 60 * 60 * 1000 },
  second: { minMs: 48 * 60 * 60 * 1000, maxMs: 72 * 60 * 60 * 1000 },
} as const;
export const B2B_REMINDER_BATCH = 30;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ts = (date: Date) => date.toISOString().replace("Z", "");

export type B2BReminderKind = keyof typeof B2B_REMINDER_EVENTS;

export async function loadB2BReminderEnabled(run: SqlRunner): Promise<boolean> {
  try {
    const [row] = await run(`SELECT value FROM b2b_settings WHERE key = $1`, [B2B_REMINDER_SETTING_KEY]);

    return row ? (JSON.parse(String(row.value)) as { enabled?: boolean }).enabled === true : false;
  } catch {
    return false;
  }
}

export async function saveB2BReminderEnabled(run: SqlRunner, enabled: boolean): Promise<boolean> {
  await run(
    `INSERT INTO b2b_settings (key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [B2B_REMINDER_SETTING_KEY, JSON.stringify({ enabled: enabled === true })]
  );

  return enabled === true;
}

export type B2BReminderCandidate = {
  orderId: string;
  offerId: string;
  email: string;
  name: string;
  totalCents: number;
  paymentMethod: string;
  items: Array<{ name: string; qty: number }>;
};

export async function findB2BReminderCandidates(run: SqlRunner, kind: B2BReminderKind, now = new Date()): Promise<B2BReminderCandidate[]> {
  const window = B2B_REMINDER_WINDOWS[kind];
  const newest = ts(new Date(now.getTime() - window.minMs));
  const oldest = ts(new Date(now.getTime() - window.maxMs));
  const event = B2B_REMINDER_EVENTS[kind];

  const rows = await run(
    `SELECT o.id, o.b2b_offer_id, o.total_cents, o.payment_method, c.email, c.name
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
      WHERE o.status = 'pending'
        AND o.b2b_offer_id IS NOT NULL
        AND o.payment_method IN ('pix', 'card')
        AND o.created_at < $1::timestamp AND o.created_at > $2::timestamp
        AND COALESCE(to_jsonb(o) ->> 'archived_at', '') = ''
        AND COALESCE(btrim(c.email), '') <> ''
        AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id AND p.status IN ('paid', 'approved', 'authorized'))
        AND NOT EXISTS (SELECT 1 FROM order_events e WHERE e.order_id = o.id AND e.event = '${event}')
      ORDER BY o.created_at
      LIMIT $3`,
    [newest, oldest, B2B_REMINDER_BATCH]
  );

  const candidates: B2BReminderCandidate[] = [];

  for (const row of rows) {
    const email = String(row.email ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) continue;

    const items = await run(
      `SELECT i.qty, COALESCE(to_jsonb(i) ->> 'product_name_snapshot', p.name, 'Produto') AS name
         FROM order_items i LEFT JOIN products p ON p.id = i.product_id
        WHERE i.order_id = $1::uuid AND i.unit_price_cents > 0 ORDER BY i.unit_price_cents DESC, p.name`,
      [String(row.id)]
    );

    candidates.push({
      orderId: String(row.id),
      offerId: String(row.b2b_offer_id),
      email,
      name: String(row.name ?? ""),
      totalCents: Number(row.total_cents ?? 0),
      paymentMethod: String(row.payment_method ?? ""),
      items: items.map((item) => ({ name: String(item.name), qty: Number(item.qty ?? 0) })),
    });
  }

  return candidates;
}

/** Texto no tom B2B: o valor é o do pedido (sem desconto novo); o nome é o da loja inteiro. */
export function buildB2BReminderEmail(candidate: Pick<B2BReminderCandidate, "orderId" | "name" | "totalCents" | "paymentMethod" | "items">, kind: B2BReminderKind, payUrl: string) {
  const number = candidate.orderId.slice(0, 8).toUpperCase();
  const who = String(candidate.name ?? "").trim();
  const how = candidate.paymentMethod === "pix" ? "no Pix (se o código anterior venceu, o link gera um novo na hora)" : "no cartão";
  const subject = kind === "first" ? `Pedido #${number} aguardando pagamento · Bio Florais` : `Lembrete: pedido #${number} ainda aguardando pagamento`;
  const opening =
    kind === "first"
      ? `O pedido #${number} da sua loja na Bio Florais está registrado e aguarda o pagamento para seguir para a separação.`
      : `Passando para lembrar: o pedido #${number} da sua loja segue registrado, aguardando o pagamento para ser separado e enviado.`;

  const { text, html } = renderSimpleEmail({
    greeting: who ? `Olá, ${who}.` : "Olá.",
    parts: [
      { p: opening },
      { lines: candidate.items.map((item) => `${item.qty}× ${item.name}`) },
      { p: `Valor do pedido: ${brlCents(candidate.totalCents)}.` },
      { button: "Pagar o pedido", url: payUrl },
      { p: `Pagamento ${how}.` },
      { small: "Se o pedido já foi pago ou se quiser alterar algo, é só falar com o seu representante. Se não quiser mais o pedido, pode ignorar este e-mail." },
    ],
    footer: `Este e-mail é sobre o pedido #${number} da sua loja na Bio Florais.`,
  });

  return { subject, text, html };
}

export type B2BReminderSummary = { enabled: boolean; first: number; second: number; failed: number; skipped: number };

/** Uma rodada do cron. `payUrlFor` monta o link de pagamento a partir do token da oferta (null = sem link: não envia). */
export async function runB2BUnpaidReminders(
  run: SqlRunner,
  deps: {
    send: (mail: { to: string; subject: string; text: string; html: string }) => Promise<boolean>;
    payUrlFor: (candidate: B2BReminderCandidate) => Promise<string | null>;
    now?: Date;
  }
): Promise<B2BReminderSummary> {
  const summary: B2BReminderSummary = { enabled: await loadB2BReminderEnabled(run), first: 0, second: 0, failed: 0, skipped: 0 };

  if (!summary.enabled) return summary;

  const now = deps.now ?? new Date();

  for (const kind of ["first", "second"] as const) {
    const event = B2B_REMINDER_EVENTS[kind];

    for (const candidate of await findB2BReminderCandidates(run, kind, now)) {
      const url = await deps.payUrlFor(candidate).catch(() => null);

      if (!url) {
        summary.skipped += 1;
        continue;
      }

      const claimed = await run(
        `INSERT INTO order_events (order_id, event, note, created_by)
         SELECT $1, '${event}', 'enviando', 'e-mail'
          WHERE NOT EXISTS (SELECT 1 FROM order_events WHERE order_id = $1 AND event = '${event}')
         RETURNING id`,
        [candidate.orderId]
      );
      if (claimed.length === 0) continue;

      const ok = await deps.send({ to: candidate.email, ...buildB2BReminderEmail(candidate, kind, url) }).catch(() => false);

      await run(`UPDATE order_events SET note = $2 WHERE order_id = $1 AND event = '${event}'`, [candidate.orderId, ok ? "enviado" : "não enviado: falha no envio"]);

      if (ok) summary[kind] += 1;
      else summary.failed += 1;
    }
  }

  return summary;
}
