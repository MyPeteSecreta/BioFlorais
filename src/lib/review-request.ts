/**
 * PEDIDO DE AVALIAÇÃO (Luis, 12/11): 7 dias depois de ENTREGUE, um e-mail por pedido com o link para avaliar.
 *
 *  - Onde a avaliação cai: no link configurado no admin (/admin/recuperacao). O site não tem avaliações próprias; o recomendado é o
 *    link "Pedir avaliações" do Perfil da Empresa no Google (g.page/r/…/review). Sem link configurado ou desligado: nada sai.
 *  - Sem brinde nem desconto em troca da avaliação (o Google proíbe avaliação incentivada).
 *  - Só B2C. Uma vez por pedido (order_events `review_request`). Janela de 7 a 10 dias depois da entrega (data do evento 'delivered'
 *    no histórico): ao ligar, não sai para entrega antiga. Nunca: cancelado, arquivado, sem e-mail.
 * Sem SQL novo (configuração em b2b_settings, chave `b2c_review_request`).
 */

import type { SqlRunner } from "@/lib/b2b/ownership";
import { firstNameOf, renderSimpleEmail } from "@/lib/email-layout";
import { BRAND } from "@/lib/order-emails";

export const REVIEW_EVENT = "review_request";
export const REVIEW_SETTING_KEY = "b2c_review_request";
export const REVIEW_MIN_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const REVIEW_MAX_AGE_MS = 10 * 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ReviewSettings = { enabled: boolean; url: string };

export function cleanReviewUrl(value: unknown): string {
  const url = String(value ?? "").trim();

  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

export async function loadReviewSettings(run: SqlRunner): Promise<ReviewSettings> {
  try {
    const [row] = await run(`SELECT value FROM b2b_settings WHERE key = $1`, [REVIEW_SETTING_KEY]);
    if (!row) return { enabled: false, url: "" };
    const parsed = JSON.parse(String(row.value)) as Partial<ReviewSettings>;

    return { enabled: parsed.enabled === true, url: cleanReviewUrl(parsed.url) };
  } catch {
    return { enabled: false, url: "" };
  }
}

export async function saveReviewSettings(run: SqlRunner, settings: ReviewSettings): Promise<ReviewSettings> {
  const url = cleanReviewUrl(settings.url);
  const clean = { enabled: settings.enabled === true && Boolean(url), url };

  await run(
    `INSERT INTO b2b_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [REVIEW_SETTING_KEY, JSON.stringify(clean)]
  );

  return clean;
}

const ts = (date: Date) => date.toISOString().replace("Z", "");

export async function findReviewCandidates(run: SqlRunner, now = new Date(), limit = 40) {
  const rows = await run(
    `SELECT o.id, c.email, c.name
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       JOIN LATERAL (SELECT max(e.created_at) AS at FROM order_events e WHERE e.order_id = o.id AND e.event = 'delivered') d ON true
      WHERE o.fulfillment_status = 'delivered'
        AND o.status IN ('paid', 'approved')
        AND o.b2b_offer_id IS NULL AND o.b2b_client_id IS NULL
        AND COALESCE(to_jsonb(o) ->> 'archived_at', '') = ''
        AND d.at < $1::timestamp AND d.at > $2::timestamp
        AND COALESCE(btrim(c.email), '') <> ''
        AND NOT EXISTS (SELECT 1 FROM order_events e WHERE e.order_id = o.id AND e.event = '${REVIEW_EVENT}')
      ORDER BY d.at
      LIMIT $3`,
    [ts(new Date(now.getTime() - REVIEW_MIN_AGE_MS)), ts(new Date(now.getTime() - REVIEW_MAX_AGE_MS)), limit]
  );

  return rows
    .map((row) => ({ orderId: String(row.id), email: String(row.email ?? "").trim(), name: String(row.name ?? "") }))
    .filter((row) => EMAIL_RE.test(row.email));
}

export function buildReviewEmail(input: { orderId: string; name: string }, ctx: { reviewUrl: string; supportUrl: string }) {
  const number = input.orderId.slice(0, 8).toUpperCase();
  const name = firstNameOf(input.name);
  const { text, html } = renderSimpleEmail({
    greeting: name ? `Olá, ${name}.` : "Olá.",
    parts: [
      { p: `Seu pedido #${number} foi entregue há uma semana. Esperamos que você esteja gostando!` },
      { p: `Sua opinião ajuda outras pessoas a conhecer a ${BRAND.name} e leva só um minuto.` },
      { button: `Avaliar a ${BRAND.name}`, url: ctx.reviewUrl },
      { small: `Se algo não saiu como esperado, fale com a gente antes: ${ctx.supportUrl}` },
    ],
    footer: `Este e-mail é sobre o seu pedido na ${BRAND.name}. Pedido #${number}.`,
  });

  return { subject: `Como foi a sua experiência com a ${BRAND.name}?`, text, html };
}

export type ReviewSummary = { enabled: boolean; candidates: number; sent: number; failed: number };

export async function runReviewRequests(
  run: SqlRunner,
  deps: { send: (mail: { to: string; subject: string; text: string; html: string }) => Promise<boolean>; siteUrl: string; now?: Date }
): Promise<ReviewSummary> {
  const settings = await loadReviewSettings(run);
  const summary: ReviewSummary = { enabled: settings.enabled && Boolean(settings.url), candidates: 0, sent: 0, failed: 0 };

  if (!summary.enabled) return summary;

  const candidates = await findReviewCandidates(run, deps.now ?? new Date());
  summary.candidates = candidates.length;
  const supportUrl = `${deps.siteUrl.replace(/\/$/, "")}${BRAND.supportPath}`;

  for (const candidate of candidates) {
    const claimed = await run(
      `INSERT INTO order_events (order_id, event, note, created_by)
       SELECT $1, '${REVIEW_EVENT}', 'enviando', 'e-mail'
        WHERE NOT EXISTS (SELECT 1 FROM order_events WHERE order_id = $1 AND event = '${REVIEW_EVENT}')
       RETURNING id`,
      [candidate.orderId]
    );

    if (claimed.length === 0) continue;

    const ok = await deps.send({ to: candidate.email, ...buildReviewEmail(candidate, { reviewUrl: settings.url, supportUrl }) }).catch(() => false);

    await run(`UPDATE order_events SET note = $2 WHERE order_id = $1 AND event = '${REVIEW_EVENT}'`, [candidate.orderId, ok ? "enviado" : "não enviado: falha no envio"]);

    if (ok) summary.sent += 1;
    else summary.failed += 1;
  }

  return summary;
}
