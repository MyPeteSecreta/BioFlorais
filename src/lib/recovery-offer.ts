/**
 * PEDIDO NÃO PAGO → OFERTA DE DESCONTO (B2C). Luis, 12/11: se em 2 dias o pedido não foi pago (Pix vencido entra aqui), UM e-mail com
 * um cupom de desconto (padrão 10%) para concluir a compra.
 *
 * CONTROLE:
 *  - Cupom ÚNICO por pedido (VOLTA-XXXXXX), na tabela coupons que já existe: 1 uso, 1 por e-mail, validade de 48 h, escopo B2C.
 *  - Preso ao e-mail da cliente: o vínculo fica em b2b_settings (`recovery_coupon:<CÓDIGO>`) e a criação do pedido recusa outro e-mail.
 *  - Soma com outra promoção só no que a regra do site já permite (o cupom é um cupom comercial comum: decideCampaignCoupons decide).
 *  - Liga/desliga e o % no admin (/admin/recuperacao), em b2b_settings (`b2c_recovery_offer`). Vem DESLIGADO até ligarem.
 *  - Relatório no admin: enviados, usados, pagos e o valor vendido com os cupons.
 *  - Nunca: pedido pago, cancelado, B2B, orçamento, arquivado, sem e-mail, que já usou um cupom VOLTA, cliente que comprou depois
 *    (mesmo e-mail, pedido pago mais novo) ou que já recebeu uma oferta nos últimos 30 dias.
 *  - Uma vez por pedido: registrado em order_events (`recovery_offer`, nota = código) antes de mandar.
 *
 * SQL puro sobre SqlRunner (Neon e PGlite). Sem SQL novo.
 */

import { randomInt } from "node:crypto";

import type { SqlRunner } from "@/lib/b2b/ownership";
import { brlCents, firstNameOf, renderSimpleEmail } from "@/lib/email-layout";
import { signTrackingToken } from "@/lib/order-tracking";

export const RECOVERY_PREFIX = "VOLTA-";
export const RECOVERY_EVENT = "recovery_offer";
export const RECOVERY_SETTING_KEY = "b2c_recovery_offer";
export const RECOVERY_BINDING_PREFIX = "recovery_coupon:";
export const RECOVERY_MIN_AGE_MS = 48 * 60 * 60 * 1000;
/** Janela de 24 h depois dos 2 dias: ao ligar, não sai oferta para pedido antigo. */
export const RECOVERY_MAX_AGE_MS = 72 * 60 * 60 * 1000;
export const RECOVERY_VALID_MS = 48 * 60 * 60 * 1000;
export const RECOVERY_BATCH = 30;
export const RECOVERY_DEFAULT = { enabled: false, percent: 10 };
const STATUSES = ["pending", "checkout_pending"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type RecoverySettings = { enabled: boolean; percent: number };

export function clampPercent(value: unknown): number {
  const n = Math.round(Number(value));

  return Number.isFinite(n) ? Math.min(30, Math.max(5, n)) : RECOVERY_DEFAULT.percent;
}

export async function loadRecoverySettings(run: SqlRunner): Promise<RecoverySettings> {
  try {
    const [row] = await run(`SELECT value FROM b2b_settings WHERE key = $1`, [RECOVERY_SETTING_KEY]);
    if (!row) return { ...RECOVERY_DEFAULT };
    const parsed = JSON.parse(String(row.value)) as Partial<RecoverySettings>;

    return { enabled: parsed.enabled === true, percent: clampPercent(parsed.percent) };
  } catch {
    return { ...RECOVERY_DEFAULT };
  }
}

export async function saveRecoverySettings(run: SqlRunner, settings: RecoverySettings): Promise<RecoverySettings> {
  const clean = { enabled: settings.enabled === true, percent: clampPercent(settings.percent) };

  await run(
    `INSERT INTO b2b_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [RECOVERY_SETTING_KEY, JSON.stringify(clean)]
  );

  return clean;
}

export function newRecoveryCode(): string {
  let code = RECOVERY_PREFIX;
  for (let i = 0; i < 6; i += 1) code += ALPHABET[randomInt(ALPHABET.length)];

  return code;
}

export type RecoveryCandidate = { orderId: string; email: string; name: string; totalCents: number; items: Array<{ slug: string | null; name: string; qty: number }> };

const ts = (date: Date) => date.toISOString().replace("Z", "");

export async function findRecoveryCandidates(run: SqlRunner, now = new Date(), limit = RECOVERY_BATCH): Promise<RecoveryCandidate[]> {
  const newest = ts(new Date(now.getTime() - RECOVERY_MIN_AGE_MS));
  const oldest = ts(new Date(now.getTime() - RECOVERY_MAX_AGE_MS));
  const monthAgo = ts(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));

  const rows = await run(
    `SELECT o.id, o.total_cents, c.email, c.name
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
      WHERE o.status = ANY($1::text[])
        AND o.created_at < $2::timestamp AND o.created_at > $3::timestamp
        AND o.b2b_offer_id IS NULL AND o.b2b_client_id IS NULL
        AND COALESCE(to_jsonb(o) ->> 'archived_at', '') = ''
        AND COALESCE(btrim(c.email), '') <> ''
        AND COALESCE(o.coupon_code, '') NOT LIKE 'VOLTA-%'
        AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id AND p.status IN ('paid', 'approved', 'authorized'))
        AND NOT EXISTS (SELECT 1 FROM order_events e WHERE e.order_id = o.id AND e.event = '${RECOVERY_EVENT}')
        AND NOT EXISTS (
          SELECT 1 FROM orders o2 JOIN customers c2 ON c2.id = o2.customer_id
           WHERE lower(c2.email) = lower(c.email) AND o2.status IN ('paid', 'approved') AND o2.created_at > o.created_at)
        AND NOT EXISTS (
          SELECT 1 FROM order_events e2 JOIN orders o3 ON o3.id = e2.order_id JOIN customers c3 ON c3.id = o3.customer_id
           WHERE e2.event = '${RECOVERY_EVENT}' AND lower(c3.email) = lower(c.email) AND e2.created_at > $4::timestamp)
      ORDER BY o.created_at
      LIMIT $5`,
    [STATUSES, newest, oldest, monthAgo, limit]
  );

  const candidates: RecoveryCandidate[] = [];

  for (const row of rows) {
    const email = String(row.email ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) continue;

    const items = await run(
      `SELECT i.qty, p.slug, COALESCE(to_jsonb(i) ->> 'product_name_snapshot', p.name, 'Produto') AS name
         FROM order_items i LEFT JOIN products p ON p.id = i.product_id
        WHERE i.order_id = $1::uuid AND i.unit_price_cents > 0 ORDER BY i.unit_price_cents DESC, p.name`,
      [String(row.id)]
    );

    candidates.push({
      orderId: String(row.id),
      email,
      name: String(row.name ?? ""),
      totalCents: Number(row.total_cents ?? 0),
      items: items.map((item) => ({ slug: (item.slug as string | null) ?? null, name: String(item.name), qty: Number(item.qty ?? 0) })),
    });
  }

  return candidates;
}

/** Registra a oferta do pedido (uma vez). Só quem inseriu segue. */
async function claimOffer(run: SqlRunner, orderId: string, code: string): Promise<boolean> {
  const rows = await run(
    `INSERT INTO order_events (order_id, event, note, created_by)
     SELECT $1, '${RECOVERY_EVENT}', $2, 'e-mail'
      WHERE NOT EXISTS (SELECT 1 FROM order_events WHERE order_id = $1 AND event = '${RECOVERY_EVENT}')
     RETURNING id`,
    [orderId, code]
  );

  return rows.length > 0;
}

/** Cria o cupom de uso único (48 h) e prende ao e-mail. */
export async function createRecoveryCoupon(run: SqlRunner, input: { code: string; percent: number; email: string; orderId: string; now: Date }) {
  const expiresAt = new Date(input.now.getTime() + RECOVERY_VALID_MS);

  await run(
    `INSERT INTO coupons (code, discount_type, discount_value, coupon_type, scope, max_uses, one_per_customer, expires_at, active)
     VALUES ($1, 'percentage', $2, 'normal', 'b2c', 1, true, $3::timestamp, true)`,
    [input.code, input.percent, ts(expiresAt)]
  );
  await run(`INSERT INTO b2b_settings (key, value) VALUES ($1, $2)`, [
    `${RECOVERY_BINDING_PREFIX}${input.code}`,
    JSON.stringify({ email: input.email, orderId: input.orderId }),
  ]);

  return expiresAt;
}

/**
 * Na criação do pedido: cupom VOLTA só vale para o e-mail que recebeu. Devolve a mensagem de erro, ou null se pode usar.
 * Cupom que não é VOLTA: sempre null.
 */
export async function recoveryCouponOwnerError(run: SqlRunner, code: string, customerEmail: string): Promise<string | null> {
  if (!code.toUpperCase().startsWith(RECOVERY_PREFIX)) return null;

  const [row] = await run(`SELECT value FROM b2b_settings WHERE key = $1`, [`${RECOVERY_BINDING_PREFIX}${code.toUpperCase()}`]);

  if (!row) return "Este cupom não é válido.";

  try {
    const bound = JSON.parse(String(row.value)) as { email?: string };

    return String(bound.email ?? "").toLowerCase() === String(customerEmail ?? "").trim().toLowerCase()
      ? null
      : "Este cupom é pessoal: use o mesmo e-mail que recebeu a oferta.";
  } catch {
    return "Este cupom não é válido.";
  }
}

const brDateTime = (date: Date) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    .format(date)
    .replace(",", " às");

export function buildRecoveryEmail(
  candidate: Pick<RecoveryCandidate, "orderId" | "name" | "items">,
  offer: { code: string; percent: number; expiresAt: Date; resumeUrl: string }
): { subject: string; text: string; html: string } {
  const number = candidate.orderId.slice(0, 8).toUpperCase();
  const name = firstNameOf(candidate.name);
  const subject = `${offer.percent}% de desconto para concluir seu pedido #${number}`;
  const { text, html } = renderSimpleEmail({
    greeting: name ? `Olá, ${name}.` : "Olá.",
    parts: [
      { p: `Seu pedido #${number} ficou sem pagamento:` },
      { lines: candidate.items.map((item) => `${item.qty}× ${item.name}`) },
      { p: `Para você concluir a compra, preparamos um cupom de ${offer.percent}% de desconto, só seu:` },
      { code: offer.code },
      { p: `Vale até ${brDateTime(offer.expiresAt)} (48 horas), uma vez, com este e-mail. Não soma com outras promoções, a não ser as que o site já permite juntar.` },
      { button: `Retomar com ${offer.percent}% de desconto`, url: offer.resumeUrl },
      { small: "O botão monta a sacola de novo e deixa o cupom pronto no checkout: é só conferir e clicar em Aplicar. Se você já comprou ou não quer mais, é só ignorar este e-mail." },
    ],
    footer: `Este e-mail é sobre o seu pedido na Bio Florais. Pedido #${number}.`,
  });

  return { subject, text, html };
}

export type RecoverySummary = { enabled: boolean; candidates: number; sent: number; failed: number };

export async function runRecoveryOffers(
  run: SqlRunner,
  deps: { send: (mail: { to: string; subject: string; text: string; html: string }) => Promise<boolean>; siteUrl: string; now?: Date }
): Promise<RecoverySummary> {
  const settings = await loadRecoverySettings(run);
  const summary: RecoverySummary = { enabled: settings.enabled, candidates: 0, sent: 0, failed: 0 };

  if (!settings.enabled) return summary;

  const now = deps.now ?? new Date();
  const candidates = await findRecoveryCandidates(run, now);
  summary.candidates = candidates.length;
  const site = deps.siteUrl.replace(/\/$/, "");

  for (const candidate of candidates) {
    const token = signTrackingToken(candidate.orderId);
    if (!token) continue;

    const code = newRecoveryCode();
    if (!(await claimOffer(run, candidate.orderId, code))) continue;

    try {
      const expiresAt = await createRecoveryCoupon(run, { code, percent: settings.percent, email: candidate.email, orderId: candidate.orderId, now });
      const mail = buildRecoveryEmail(candidate, { code, percent: settings.percent, expiresAt, resumeUrl: `${site}/retomar/${token}` });
      const ok = await deps.send({ to: candidate.email, ...mail }).catch(() => false);

      await run(`UPDATE order_events SET note = $2 WHERE order_id = $1 AND event = '${RECOVERY_EVENT}'`, [
        candidate.orderId,
        ok ? code : `${code} · não enviado: falha no envio`,
      ]);

      if (ok) summary.sent += 1;
      else summary.failed += 1;
    } catch (error) {
      summary.failed += 1;
      console.error("[recovery-offer] falha", candidate.orderId.slice(0, 8), error instanceof Error ? error.message : error);
    }
  }

  return summary;
}

/** Cupom VOLTA do pedido (para a página /retomar). */
export async function loadRecoveryForOrder(run: SqlRunner, orderId: string) {
  const [event] = await run(`SELECT note FROM order_events WHERE order_id = $1 AND event = '${RECOVERY_EVENT}' LIMIT 1`, [orderId]);
  const code = String(event?.note ?? "").split(" ")[0];

  if (!code.startsWith(RECOVERY_PREFIX)) return null;

  const [coupon] = await run(
    `SELECT code, discount_value, used_count, max_uses, active, to_char(expires_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS expires_at FROM coupons WHERE code = $1`,
    [code]
  );

  if (!coupon) return null;

  const expired = coupon.expires_at ? new Date(String(coupon.expires_at)).getTime() < Date.now() : false;
  const used = Number(coupon.used_count ?? 0) >= Number(coupon.max_uses ?? 1);

  return { code, percent: Number(coupon.discount_value), valid: Boolean(coupon.active) && !expired && !used };
}

/** Itens do pedido para remontar a sacola (só produtos pagos, com slug). */
export async function loadOrderCartItems(run: SqlRunner, orderId: string) {
  const rows = await run(
    `SELECT i.qty, p.slug, p.name FROM order_items i JOIN products p ON p.id = i.product_id
      WHERE i.order_id = $1::uuid AND i.unit_price_cents > 0 AND p.slug IS NOT NULL ORDER BY i.unit_price_cents DESC`,
    [orderId]
  );

  return rows.map((row) => ({ productSlug: String(row.slug), name: String(row.name ?? "Produto"), qty: Math.max(1, Number(row.qty ?? 1)) }));
}

export type RecoveryReport = { sent: number; used: number; paidOrders: number; paidCents: number; sent30: number; used30: number };

export async function loadRecoveryReport(run: SqlRunner, now = new Date()): Promise<RecoveryReport> {
  const since = ts(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
  const [sent] = await run(
    `SELECT count(*)::int AS total, count(*) FILTER (WHERE created_at > $1::timestamp)::int AS last30
       FROM order_events WHERE event = '${RECOVERY_EVENT}' AND note NOT LIKE '%não enviado%'`,
    [since]
  );
  const [used] = await run(
    `SELECT count(*)::int AS total, count(*) FILTER (WHERE r.redeemed_at > $1::timestamp)::int AS last30
       FROM coupon_redemptions r JOIN coupons c ON c.id = r.coupon_id WHERE c.code LIKE 'VOLTA-%'`,
    [since]
  );
  const [paid] = await run(
    `SELECT count(*)::int AS orders, COALESCE(sum(total_cents), 0)::bigint AS cents
       FROM orders WHERE coupon_code LIKE 'VOLTA-%' AND status IN ('paid', 'approved')`
  );

  return {
    sent: Number(sent?.total ?? 0),
    sent30: Number(sent?.last30 ?? 0),
    used: Number(used?.total ?? 0),
    used30: Number(used?.last30 ?? 0),
    paidOrders: Number(paid?.orders ?? 0),
    paidCents: Number(paid?.cents ?? 0),
  };
}

export { brlCents };
