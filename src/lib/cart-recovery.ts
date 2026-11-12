/**
 * CARRINHO ABANDONADO (B2C). Luis, 12/11: o mesmo esquema do pedido não pago (src/lib/recovery-offer.ts), respeitando a LGPD.
 *
 *  - SÓ com consentimento: a cliente marca no checkout "Quero receber um lembrete da minha sacola por e-mail" (caixa desmarcada por
 *    padrão; LGPD art. 7º, I). Sem a marca, nada é gravado. Desmarcar apaga a sacola na hora.
 *  - Guarda o mínimo: e-mail, primeiro nome e os itens (slug, nome, quantidade). Tabela cart_recoveries (SQL 56b). Sem a tabela, nada
 *    acontece e o site segue igual.
 *  - 2 h depois da última mudança na sacola: lembrete SEM desconto. Em 2 dias (janela 48–72 h): UM e-mail com cupom pessoal VOLTA-XXXXXX
 *    (o mesmo controle do pedido não pago: 1 uso, 1 por e-mail, 48 h, preso ao e-mail), só se a oferta de desconto estiver ligada no
 *    admin, com o mesmo %. Oferta no máximo 1 vez a cada 30 dias por e-mail (nem a do pedido nem a da sacola).
 *  - Nunca: quem fez pedido depois de mexer na sacola (vira "convertido"), sacola vazia, e-mail inválido.
 *  - Todo e-mail tem o link "Não quero mais receber" (/sacola/sair/<link assinado>), que apaga a sacola.
 *  - Retenção: a tarefa apaga sozinha a sacola 30 dias depois da última mudança.
 *  - Liga/desliga no admin (/admin/recuperacao), em b2b_settings (`b2c_cart_recovery`). Vem DESLIGADO; desligado, o checkout nem mostra
 *    a caixa.
 *
 * SQL puro sobre SqlRunner (Neon e PGlite).
 */

import type { SqlRunner } from "@/lib/b2b/ownership";
import { bioProducts } from "@/lib/catalog/bio-products";
import { firstNameOf, renderSimpleEmail } from "@/lib/email-layout";
import { signTrackingToken } from "@/lib/order-tracking";
import { RECOVERY_BINDING_PREFIX, RECOVERY_EVENT, RECOVERY_VALID_MS, loadRecoverySettings, newRecoveryCode } from "@/lib/recovery-offer";

export const CART_SETTING_KEY = "b2c_cart_recovery";
export const CART_REMINDER_MIN_AGE_MS = 2 * 60 * 60 * 1000;
export const CART_OFFER_MIN_AGE_MS = 48 * 60 * 60 * 1000;
export const CART_OFFER_MAX_AGE_MS = 72 * 60 * 60 * 1000;
export const CART_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const CART_BATCH = 30;
export const CART_MAX_ITEMS = 30;
export const CART_MAX_QTY = 20;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const ts = (date: Date) => date.toISOString().replace("Z", "");
const PRODUCTS = new Map(bioProducts.map((product) => [product.slug, product]));

export type CartItem = { productSlug: string; name: string; qty: number };

// ---------------------------------------------------------------------------------------------------------------------------------
// Configuração (liga/desliga)
// ---------------------------------------------------------------------------------------------------------------------------------

export async function loadCartRecoveryEnabled(run: SqlRunner): Promise<boolean> {
  try {
    const [row] = await run(`SELECT value FROM b2b_settings WHERE key = $1`, [CART_SETTING_KEY]);

    return row ? (JSON.parse(String(row.value)) as { enabled?: boolean }).enabled === true : false;
  } catch {
    return false;
  }
}

export async function saveCartRecoveryEnabled(run: SqlRunner, enabled: boolean): Promise<boolean> {
  await run(
    `INSERT INTO b2b_settings (key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [CART_SETTING_KEY, JSON.stringify({ enabled: enabled === true })]
  );

  return enabled === true;
}

/** A tabela do SQL 56b existe? */
export async function cartTableReady(run: SqlRunner): Promise<boolean> {
  try {
    const [row] = await run(`SELECT 1 AS ok FROM information_schema.tables WHERE table_name = 'cart_recoveries'`);

    return Boolean(row);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Entrada do checkout
// ---------------------------------------------------------------------------------------------------------------------------------

/** Limpa o que vem do navegador: só produtos do catálogo, quantidade de 1 a 20, no máximo 30 itens; o nome vem do catálogo. */
export function sanitizeCartItems(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];

  const bySlug = new Map<string, CartItem>();

  for (const entry of raw.slice(0, CART_MAX_ITEMS)) {
    const slug = String((entry as { productSlug?: unknown })?.productSlug ?? "").trim();
    const product = PRODUCTS.get(slug);
    const qty = Math.floor(Number((entry as { qty?: unknown })?.qty));

    if (!product || !Number.isFinite(qty) || qty < 1) continue;

    const current = bySlug.get(slug);
    const total = Math.min(CART_MAX_QTY, (current?.qty ?? 0) + qty);
    bySlug.set(slug, { productSlug: slug, name: product.name, qty: total });
  }

  return [...bySlug.values()];
}

export function cleanEmail(value: unknown): string | null {
  const email = String(value ?? "").trim().toLowerCase();

  return email.length <= 200 && EMAIL_RE.test(email) ? email : null;
}

/** Grava (ou atualiza) a sacola de quem deu o aceite. Sacola vazia apaga. */
export async function saveCartForRecovery(
  run: SqlRunner,
  input: { email: string; name?: string | null; items: CartItem[]; now?: Date }
): Promise<"saved" | "removed"> {
  const now = input.now ?? new Date();

  if (input.items.length === 0) {
    await removeCartByEmail(run, input.email);
    return "removed";
  }

  const monthAgo = ts(new Date(now.getTime() - CART_RETENTION_MS));

  await run(
    `INSERT INTO cart_recoveries (email, first_name, items_json, consent_at, updated_at)
     VALUES ($1, $2, $3, $4::timestamp, $4::timestamp)
     ON CONFLICT ((lower(email))) DO UPDATE SET
       first_name = EXCLUDED.first_name,
       items_json = EXCLUDED.items_json,
       consent_at = EXCLUDED.consent_at,
       updated_at = EXCLUDED.updated_at,
       reminder_sent_at = CASE
         WHEN cart_recoveries.converted_at IS NOT NULL OR cart_recoveries.reminder_sent_at < $5::timestamp THEN NULL
         ELSE cart_recoveries.reminder_sent_at END,
       converted_at = NULL`,
    [input.email, firstNameOf(input.name ?? "").slice(0, 60) || null, JSON.stringify(input.items), ts(now), monthAgo]
  );

  return "saved";
}

export async function removeCartByEmail(run: SqlRunner, email: string) {
  await run(`DELETE FROM cart_recoveries WHERE lower(email) = lower($1)`, [email]);
}

export async function removeCartById(run: SqlRunner, id: string): Promise<boolean> {
  const rows = await run(`DELETE FROM cart_recoveries WHERE id = $1::uuid RETURNING id`, [id]);

  return rows.length > 0;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// E-mails
// ---------------------------------------------------------------------------------------------------------------------------------

const brDateTime = (date: Date) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    .format(date)
    .replace(",", " às");

const consentNote = (unsubscribeUrl: string) =>
  [
    { small: "Você recebeu este e-mail porque marcou, no checkout da Bio Florais, que queria um lembrete da sua sacola. Mandamos no máximo 2 e-mails sobre ela." },
    { small: `Não quer mais receber? Saia da lista (a sacola guardada é apagada): ${unsubscribeUrl}` },
  ] as const;

export function buildCartReminderEmail(cart: { firstName: string | null; items: CartItem[] }, links: { resumeUrl: string; unsubscribeUrl: string }) {
  const name = firstNameOf(cart.firstName ?? "");
  const { text, html } = renderSimpleEmail({
    greeting: name ? `Olá, ${name}.` : "Olá.",
    parts: [
      { p: "Você deixou estes itens na sua sacola:" },
      { lines: cart.items.map((item) => `${item.qty}× ${item.name}`) },
      { p: "Guardamos a sacola para você concluir a compra quando quiser." },
      { button: "Voltar para a minha sacola", url: links.resumeUrl },
      ...consentNote(links.unsubscribeUrl),
    ],
    footer: "Lembrete da sua sacola na Bio Florais.",
  });

  return { subject: "Sua sacola na Bio Florais está guardada", text, html };
}

export function buildCartOfferEmail(
  cart: { firstName: string | null; items: CartItem[] },
  offer: { code: string; percent: number; expiresAt: Date; resumeUrl: string; unsubscribeUrl: string }
) {
  const name = firstNameOf(cart.firstName ?? "");
  const { text, html } = renderSimpleEmail({
    greeting: name ? `Olá, ${name}.` : "Olá.",
    parts: [
      { p: "Sua sacola ainda está guardada:" },
      { lines: cart.items.map((item) => `${item.qty}× ${item.name}`) },
      { p: `Para você levar, preparamos um cupom de ${offer.percent}% de desconto, só seu:` },
      { code: offer.code },
      { p: `Vale até ${brDateTime(offer.expiresAt)} (48 horas), uma vez, com este e-mail. Não soma com outras promoções, a não ser as que o site já permite juntar.` },
      { button: `Concluir com ${offer.percent}% de desconto`, url: offer.resumeUrl },
      { small: "O botão monta a sacola de novo e deixa o cupom pronto no checkout: é só conferir e clicar em Aplicar." },
      ...consentNote(offer.unsubscribeUrl),
    ],
    footer: "Lembrete da sua sacola na Bio Florais.",
  });

  return { subject: `${offer.percent}% de desconto para levar a sua sacola`, text, html };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Tarefa (roda junto com o lembrete de pedido não pago, a cada 15 min)
// ---------------------------------------------------------------------------------------------------------------------------------

type CartRow = { id: string; email: string; firstName: string | null; items: CartItem[] };

const parseItems = (raw: unknown): CartItem[] => {
  try {
    return sanitizeCartItems(JSON.parse(String(raw ?? "[]")));
  } catch {
    return [];
  }
};

/** Marca como convertida a sacola de quem fez pedido B2C depois de mexer nela (30 min de folga). */
async function markConverted(run: SqlRunner, now: Date) {
  await run(
    `UPDATE cart_recoveries cr SET converted_at = $1::timestamp
      WHERE cr.converted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM orders o JOIN customers c ON c.id = o.customer_id
           WHERE lower(c.email) = lower(cr.email) AND o.b2b_offer_id IS NULL AND o.b2b_client_id IS NULL
             AND o.created_at >= cr.updated_at - interval '30 minutes')`,
    [ts(now)]
  );
}

async function findCarts(run: SqlRunner, sql: string, params: unknown[]): Promise<CartRow[]> {
  const rows = await run(sql, params);

  return rows
    .map((row) => ({ id: String(row.id), email: String(row.email ?? "").trim().toLowerCase(), firstName: (row.first_name as string | null) ?? null, items: parseItems(row.items_json) }))
    .filter((cart) => EMAIL_RE.test(cart.email) && cart.items.length > 0);
}

export type CartRecoverySummary = { enabled: boolean; ready: boolean; reminders: number; offers: number; failed: number; purged: number };

export async function runCartRecovery(
  run: SqlRunner,
  deps: { send: (mail: { to: string; subject: string; text: string; html: string }) => Promise<boolean>; siteUrl: string; now?: Date }
): Promise<CartRecoverySummary> {
  const summary: CartRecoverySummary = { enabled: false, ready: false, reminders: 0, offers: 0, failed: 0, purged: 0 };

  if (!(await cartTableReady(run))) return summary;
  summary.ready = true;

  const now = deps.now ?? new Date();
  const site = deps.siteUrl.replace(/\/$/, "");

  // Retenção (LGPD): sempre, mesmo desligado.
  const purged = await run(`DELETE FROM cart_recoveries WHERE updated_at < $1::timestamp RETURNING id`, [ts(new Date(now.getTime() - CART_RETENTION_MS))]);
  summary.purged = purged.length;

  summary.enabled = await loadCartRecoveryEnabled(run);
  if (!summary.enabled) return summary;

  await markConverted(run, now);

  const links = (id: string) => {
    const token = signTrackingToken(id);
    return token ? { resumeUrl: `${site}/sacola/${token}`, unsubscribeUrl: `${site}/sacola/sair/${token}` } : null;
  };

  // 1) Lembrete sem desconto: 2 h a 48 h depois da última mudança.
  const reminders = await findCarts(
    run,
    `SELECT id, email, first_name, items_json FROM cart_recoveries
      WHERE converted_at IS NULL AND reminder_sent_at IS NULL
        AND updated_at < $1::timestamp AND updated_at > $2::timestamp
      ORDER BY updated_at LIMIT $3`,
    [ts(new Date(now.getTime() - CART_REMINDER_MIN_AGE_MS)), ts(new Date(now.getTime() - CART_OFFER_MIN_AGE_MS)), CART_BATCH]
  );

  for (const cart of reminders) {
    const url = links(cart.id);
    if (!url) continue;

    // Marca antes de mandar: nunca 2 lembretes da mesma sacola.
    const claimed = await run(`UPDATE cart_recoveries SET reminder_sent_at = $2::timestamp WHERE id = $1::uuid AND reminder_sent_at IS NULL RETURNING id`, [cart.id, ts(now)]);
    if (claimed.length === 0) continue;

    const ok = await deps.send({ to: cart.email, ...buildCartReminderEmail(cart, url) }).catch(() => false);
    if (ok) summary.reminders += 1;
    else summary.failed += 1;
  }

  // 2) Oferta: só com a oferta de desconto ligada no admin (mesmo %), 48–72 h, no máximo 1 oferta a cada 30 dias por e-mail.
  const offer = await loadRecoverySettings(run);
  if (!offer.enabled) return summary;

  const monthAgo = ts(new Date(now.getTime() - 30 * DAY_MS));
  const offers = await findCarts(
    run,
    `SELECT cr.id, cr.email, cr.first_name, cr.items_json FROM cart_recoveries cr
      WHERE cr.converted_at IS NULL AND cr.reminder_sent_at IS NOT NULL
        AND (cr.offer_sent_at IS NULL OR cr.offer_sent_at < $3::timestamp)
        AND cr.updated_at < $1::timestamp AND cr.updated_at > $2::timestamp
        AND NOT EXISTS (
          SELECT 1 FROM order_events e JOIN orders o ON o.id = e.order_id JOIN customers c ON c.id = o.customer_id
           WHERE e.event = '${RECOVERY_EVENT}' AND lower(c.email) = lower(cr.email) AND e.created_at > $3::timestamp)
      ORDER BY cr.updated_at LIMIT $4`,
    [ts(new Date(now.getTime() - CART_OFFER_MIN_AGE_MS)), ts(new Date(now.getTime() - CART_OFFER_MAX_AGE_MS)), monthAgo, CART_BATCH]
  );

  for (const cart of offers) {
    const url = links(cart.id);
    if (!url) continue;

    const code = newRecoveryCode();
    const claimed = await run(
      `UPDATE cart_recoveries SET offer_sent_at = $2::timestamp, offer_code = $3
        WHERE id = $1::uuid AND (offer_sent_at IS NULL OR offer_sent_at < $4::timestamp) RETURNING id`,
      [cart.id, ts(now), code, monthAgo]
    );
    if (claimed.length === 0) continue;

    try {
      const expiresAt = new Date(now.getTime() + RECOVERY_VALID_MS);

      await run(
        `INSERT INTO coupons (code, discount_type, discount_value, coupon_type, scope, max_uses, one_per_customer, expires_at, active)
         VALUES ($1, 'percentage', $2, 'normal', 'b2c', 1, true, $3::timestamp, true)`,
        [code, offer.percent, ts(expiresAt)]
      );
      // Cupom pessoal: a criação do pedido recusa outro e-mail (recoveryCouponOwnerError).
      await run(`INSERT INTO b2b_settings (key, value) VALUES ($1, $2)`, [`${RECOVERY_BINDING_PREFIX}${code}`, JSON.stringify({ email: cart.email, cartId: cart.id })]);

      const ok = await deps.send({ to: cart.email, ...buildCartOfferEmail(cart, { code, percent: offer.percent, expiresAt, ...url }) }).catch(() => false);
      if (ok) summary.offers += 1;
      else summary.failed += 1;
    } catch (error) {
      summary.failed += 1;
      console.error("[cart-recovery] falha", cart.id.slice(0, 8), error instanceof Error ? error.message : error);
    }
  }

  return summary;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Páginas /sacola/<link> e relatório
// ---------------------------------------------------------------------------------------------------------------------------------

export async function loadCartForRestore(run: SqlRunner, id: string) {
  if (!(await cartTableReady(run))) return null;

  const [row] = await run(`SELECT id, items_json, offer_code FROM cart_recoveries WHERE id = $1::uuid`, [id]);
  if (!row) return null;

  const items = parseItems(row.items_json);
  const code = row.offer_code ? String(row.offer_code) : null;
  let offer: { code: string; valid: boolean } | null = null;

  if (code) {
    const [coupon] = await run(
      `SELECT used_count, max_uses, active, to_char(expires_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS expires_at FROM coupons WHERE code = $1`,
      [code]
    );
    const expired = coupon?.expires_at ? new Date(String(coupon.expires_at)).getTime() < Date.now() : true;
    const used = coupon ? Number(coupon.used_count ?? 0) >= Number(coupon.max_uses ?? 1) : true;
    offer = { code, valid: Boolean(coupon?.active) && !expired && !used };
  }

  return { items, offer };
}

export type CartRecoveryReport = { active: number; reminders30: number; offers30: number; converted30: number; couponsUsed: number };

export async function loadCartRecoveryReport(run: SqlRunner, now = new Date()): Promise<CartRecoveryReport | null> {
  if (!(await cartTableReady(run))) return null;

  const since = ts(new Date(now.getTime() - 30 * DAY_MS));
  const [row] = await run(
    `SELECT count(*) FILTER (WHERE converted_at IS NULL)::int AS active,
            count(*) FILTER (WHERE reminder_sent_at > $1::timestamp)::int AS reminders30,
            count(*) FILTER (WHERE offer_sent_at > $1::timestamp)::int AS offers30,
            count(*) FILTER (WHERE converted_at > $1::timestamp)::int AS converted30
       FROM cart_recoveries`,
    [since]
  );
  const [used] = await run(
    `SELECT count(*)::int AS total FROM coupons c WHERE c.used_count > 0 AND EXISTS (SELECT 1 FROM cart_recoveries cr WHERE cr.offer_code = c.code)`
  );

  return {
    active: Number(row?.active ?? 0),
    reminders30: Number(row?.reminders30 ?? 0),
    offers30: Number(row?.offers30 ?? 0),
    converted30: Number(row?.converted30 ?? 0),
    couponsUsed: Number(used?.total ?? 0),
  };
}
