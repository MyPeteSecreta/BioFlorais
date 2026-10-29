/**
 * BIO FLORAIS B2B — LINKS COM PROMOÇÃO do vendedor (SQL 52b).
 *
 * O link geral (/parceiros?v=<código>) abre a vitrine com preço B2B normal. O vendedor pode criar, em "Link geral para
 * divulgar", vários links próprios com UMA promoção ATIVA do admin (ou um kit display): /parceiros?v=<código>&promo=<código curto>.
 * Cada link com promoção tem a sua vitrine (oferta pública is_storefront com promo_link_id, com a promoção ligada nas linhas do
 * alcance dela). Nada é inventado pelo vendedor: a promoção e a elegibilidade vêm das regras do admin (matriz de comissão),
 * validadas pelo mesmo caminho do Offer Builder (createActiveOffer). Ao comprar, o lojista novo é vinculado ao vendedor e o pedido
 * vai para uma oferta DELE com a mesma promoção (a elegibilidade e a comissão seguem a regra atual); promoção indisponível para o
 * cliente (ex.: abertura de quem já comprou a linha) sai da oferta dele e o preço fica normal.
 * Link vencido ou revogado abre a loja normal com o aviso "esta promoção terminou".
 */

import { MAX_LINKS_PER_SELLER, MAX_VALIDITY_DAYS, PROMO_ENDED_NOTICE, generatePromoCode, normalizePromoCode, promoLinkPath, promoLinkStatus, withQueryParam, type PromoLinkStatus } from "@/lib/b2b/promo-link-core";
import { findPromotionRule, loadCommissionMatrix, type EligibilityMode } from "@/lib/b2b/commission";
import { commissionText, describeDeal, eligibilityText, mergeRanges, priceRangeText } from "@/lib/b2b/promo-explain";
import { displayByKey } from "@/lib/b2b/displays";
import { loadDisabledDisplays } from "@/lib/b2b/displays-server";
import { loadBuilderLines } from "@/lib/b2b/offer-builder";
import { issueOfferLink, readActiveOfferLink } from "@/lib/b2b/offer-link";
import { NOT_DEMO_SQL } from "@/lib/b2b/demo";
import type { SqlRunner } from "@/lib/b2b/ownership";
import { createActiveOffer, evaluateStandardOffer, evaluateTemplate } from "@/lib/b2b/quick-offer";
import { ensureStorefrontPath, findStorefront, STOREFRONT_CLIENT_NAME } from "@/lib/b2b/storefront";

export type PromoLinkKind = "promotion" | "display";

export type PromoLink = {
  id: string;
  responsibleId: string;
  code: string;
  name: string;
  kind: PromoLinkKind;
  promotionId: string | null;
  promotionName: string | null;
  displayKey: string | null;
  eligibilityMode: EligibilityMode | null;
  maxUses: number | null;
  durationDays: number | null;
  expiresAt: Date | null;
  offerId: string | null;
  createdAt: Date;
  revokedAt: Date | null;
};

function mapLink(row: Record<string, unknown>): PromoLink {
  // timestamp sem fuso (gravado em UTC): texto "2026-10-29 12:00:00" vira UTC; Date passa direto.
  const date = (value: unknown) => {
    if (!value) return null;
    if (value instanceof Date) return value;

    const text = String(value);

    return new Date(/Z$|[+-]\d\d(:?\d\d)?$/.test(text) ? text : `${text.replace(" ", "T")}Z`);
  };

  return {
    id: String(row.id),
    responsibleId: String(row.responsible_id),
    code: String(row.code),
    name: String(row.name),
    kind: row.kind === "display" ? "display" : "promotion",
    promotionId: row.promotion_id ? String(row.promotion_id) : null,
    promotionName: row.promotion_name ? String(row.promotion_name) : null,
    displayKey: row.display_key ? String(row.display_key) : null,
    eligibilityMode: row.eligibility_mode === "uses" || row.eligibility_mode === "days" ? row.eligibility_mode : null,
    maxUses: row.max_uses === null || row.max_uses === undefined ? null : Number(row.max_uses),
    durationDays: row.duration_days === null || row.duration_days === undefined ? null : Number(row.duration_days),
    expiresAt: date(row.expires_at),
    offerId: row.offer_id ? String(row.offer_id) : null,
    createdAt: date(row.created_at) ?? new Date(),
    revokedAt: date(row.revoked_at),
  };
}

const SELECT_LINK = `SELECT l.*, p.name AS promotion_name FROM b2b_promo_links l LEFT JOIN b2b_promotions p ON p.id = l.promotion_id`;

export async function findPromoLinkByCode(run: SqlRunner, codeInput: unknown): Promise<PromoLink | null> {
  const code = normalizePromoCode(codeInput);

  if (!code) return null;

  try {
    const [row] = await run(`${SELECT_LINK} WHERE upper(l.code) = $1 LIMIT 1`, [code]);

    return row ? mapLink(row) : null;
  } catch {
    return null;
  }
}

export async function findPromoLinkById(run: SqlRunner, id: string): Promise<PromoLink | null> {
  try {
    const [row] = await run(`${SELECT_LINK} WHERE l.id = $1::uuid LIMIT 1`, [id]);

    return row ? mapLink(row) : null;
  } catch {
    return null;
  }
}

export async function listPromoLinks(run: SqlRunner, responsibleId: string): Promise<PromoLink[]> {
  try {
    const rows = await run(`${SELECT_LINK} WHERE l.responsible_id = $1::uuid AND l.revoked_at IS NULL ORDER BY l.created_at DESC LIMIT 100`, [responsibleId]);

    return rows.map(mapLink);
  } catch {
    // SQL 52b ainda não aplicado.
    return [];
  }
}

export async function revokePromoLink(run: SqlRunner, responsibleId: string, id: string): Promise<boolean> {
  try {
    const rows = await run(`UPDATE b2b_promo_links SET revoked_at = now() WHERE id = $1::uuid AND responsible_id = $2::uuid AND revoked_at IS NULL RETURNING id`, [id, responsibleId]);

    return rows.length > 0;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Opções para o formulário: só promoções ATIVAS do admin, com as elegibilidades configuradas
// ---------------------------------------------------------------------------

export type PromoLinkChoice = {
  /** "uses:1" | "days:30" */
  value: string;
  mode: EligibilityMode;
  title: string;
  hint: string;
  /** "Sua comissão: 16% (10% fixo + 6% de bônus)" */
  commission: string;
};

export type PromoLinkPromotionOption = {
  id: string;
  name: string;
  /** "4 por 2" ou "−15%". */
  label: string;
  /** "R$ 29,90 por unidade" ou "de R$ X a R$ Y por unidade". */
  priceText: string | null;
  /** Uma linha do que é + a conta pronta. */
  summary: string;
  math: string | null;
  /** Linhas onde a promoção vale. */
  lines: string[];
  kind: "abertura_reconquista" | "recorrente";
  choices: PromoLinkChoice[];
};

export async function loadPromoLinkOptions(run: SqlRunner, responsibleId: string): Promise<PromoLinkPromotionOption[]> {
  const [lines, matrix] = await Promise.all([loadBuilderLines(new Date(), null), loadCommissionMatrix(run, responsibleId, null)]);
  const byId = new Map<string, PromoLinkPromotionOption>();
  const ranges = new Map<string, Array<import("@/lib/b2b/promo-explain").PriceRange | null>>();

  for (const line of lines) {
    for (const promotion of line.promotions) {
      let option = byId.get(promotion.id);

      if (!option) {
        const rules = matrix.rules.filter((rule) => rule.promotionId === promotion.id);

        const deal = describeDeal(promotion, promotion.priceRange);
        const choice = (rule: (typeof rules)[number]): PromoLinkChoice => {
          const mode = rule.eligibilityMode;
          const amount = (mode === "uses" ? rule.maxUses : rule.durationDays) as number;
          const text = eligibilityText(mode, amount);

          return { value: `${mode}:${amount}`, mode, title: text.title, hint: text.hint, commission: commissionText(matrix.basePercent, rule.extraPercent) };
        };
        const ordered = [
          ...rules.filter((rule) => rule.eligibilityMode === "uses" && rule.maxUses).sort((a, b) => (a.maxUses ?? 0) - (b.maxUses ?? 0)),
          ...rules.filter((rule) => rule.eligibilityMode === "days" && rule.durationDays).sort((a, b) => (a.durationDays ?? 0) - (b.durationDays ?? 0)),
        ];

        option = {
          id: promotion.id,
          name: promotion.name,
          label: deal.headline,
          priceText: null,
          summary: deal.summary,
          math: deal.math,
          lines: [],
          kind: promotion.promoType,
          choices: ordered.map(choice),
        };
        byId.set(promotion.id, option);
        ranges.set(promotion.id, []);
      }

      option.lines.push(line.name);
      ranges.get(promotion.id)?.push(promotion.priceRange ?? line.priceRange ?? null);
    }
  }

  for (const [id, option] of byId) option.priceText = priceRangeText(mergeRanges(ranges.get(id) ?? []));

  // Sem elegibilidade configurada o vendedor não consegue escolher a promoção.
  return [...byId.values()].filter((option) => option.choices.length > 0);
}

// ---------------------------------------------------------------------------
// Criação
// ---------------------------------------------------------------------------

export type CreatePromoLinkInput = {
  name: unknown;
  kind: unknown;
  promotionId?: unknown;
  displayKey?: unknown;
  eligibilityMode?: unknown;
  eligibilityValue?: unknown;
  /** Validade do link, em dias a partir de agora (1 a 365). */
  validityDays: unknown;
};

export type CreatePromoLinkResult = { ok: true; link: PromoLink; path: string } | { ok: false; status: number; error: string };

export { PROMO_ENDED_NOTICE, generatePromoCode, normalizePromoCode, promoLinkPath, promoLinkStatus, withQueryParam };
export type { PromoLinkStatus };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function createPromoLink(
  run: SqlRunner,
  seller: { id: string; name: string; referralCode: string },
  input: CreatePromoLinkInput,
  now = new Date()
): Promise<CreatePromoLinkResult> {
  const name = String(input.name ?? "").replace(/\s+/g, " ").trim();
  const kind: PromoLinkKind | null = input.kind === "promotion" ? "promotion" : input.kind === "display" ? "display" : null;
  const validityDays = Number(input.validityDays);

  if (name.length < 3 || name.length > 60) return { ok: false, status: 400, error: "Dê um nome ao link (de 3 a 60 letras), por exemplo: “Campanha de novembro”." };
  if (!kind) return { ok: false, status: 400, error: "Escolha uma promoção ou um kit display." };
  if (!Number.isInteger(validityDays) || validityDays < 1 || validityDays > MAX_VALIDITY_DAYS) return { ok: false, status: 400, error: "Informe a validade do link em dias (de 1 a 365)." };

  const expiresAt = new Date(now.getTime() + validityDays * DAY_MS);

  try {
    const [count] = await run(`SELECT count(*)::int AS n FROM b2b_promo_links WHERE responsible_id = $1::uuid AND revoked_at IS NULL`, [seller.id]);

    if (Number(count?.n ?? 0) >= MAX_LINKS_PER_SELLER) return { ok: false, status: 409, error: "Você chegou ao limite de links com promoção. Apague algum que não usa mais." };
  } catch {
    return { ok: false, status: 503, error: "Os links com promoção ainda não estão disponíveis (falta aplicar o SQL 52b)." };
  }

  // Vitrine padrão do vendedor garantida (é a loja normal, usada como base e como destino do link vencido).
  const defaultPath = await ensureStorefrontPath(run, { id: seller.id, name: seller.name });
  const base = await findStorefront(run, seller.id);

  if (!defaultPath || !base) return { ok: false, status: 503, error: "Não foi possível preparar a loja agora. Tente novamente em instantes." };

  let promotionId: string | null = null;
  let displayKey: string | null = null;
  let mode: EligibilityMode | null = null;
  let maxUses: number | null = null;
  let durationDays: number | null = null;
  let offerId: string | null = null;

  if (kind === "display") {
    const key = String(input.displayKey ?? "");
    const display = displayByKey(key);

    if (!display) return { ok: false, status: 400, error: "Kit display inválido." };
    if ((await loadDisabledDisplays(run)).has(display.key)) return { ok: false, status: 409, error: `O ${display.name} não está disponível no momento.` };

    displayKey = display.key;
  } else {
    const id = String(input.promotionId ?? "");

    if (!UUID_RE.test(id)) return { ok: false, status: 400, error: "Escolha uma promoção." };

    mode = input.eligibilityMode === "days" ? "days" : input.eligibilityMode === "uses" ? "uses" : null;
    const value = Number(input.eligibilityValue);

    if (!mode || !Number.isInteger(value) || value < 1) return { ok: false, status: 400, error: "Escolha a validade da promoção para o cliente (número de compras ou dias)." };

    maxUses = mode === "uses" ? value : null;
    durationDays = mode === "days" ? value : null;

    const [lines, matrix] = await Promise.all([loadBuilderLines(now, null), loadCommissionMatrix(run, seller.id, null)]);
    const targets = lines.filter((line) => line.promotions.some((promotion) => promotion.id === id));

    // Só promoção que o ADMIN criou e que está ativa, selecionável e vigente (é o que loadBuilderLines devolve).
    if (targets.length === 0) return { ok: false, status: 409, error: "Esta promoção não está ativa no momento. Escolha outra." };

    if (!findPromotionRule(matrix, { kind: "promotion", promotionId: id, eligibilityMode: mode, maxUses, durationDays })) {
      return { ok: false, status: 409, error: "Esta validade não está liberada para a promoção escolhida." };
    }

    promotionId = id;

    const standard = await evaluateStandardOffer(base.clientId);
    const created = await createActiveOffer(run, {
      responsible: { id: seller.id, name: seller.name },
      client: { id: base.clientId, displayName: STOREFRONT_CLIENT_NAME, phone: null },
      commercialGroupIds: standard.commercialGroupIds,
      promotions: targets.map((line) => ({ commercialGroupId: line.id, promotionId: id, eligibilityMode: mode as EligibilityMode, maxUses, durationDays })),
    });

    if (!created.ok) return { ok: false, status: created.status, error: created.error };

    offerId = created.offerId;
  }

  // Código curto único.
  let link: PromoLink | null = null;

  for (let attempt = 0; attempt < 8 && !link; attempt += 1) {
    const code = generatePromoCode();

    try {
      const rows = await run(
        `INSERT INTO b2b_promo_links (responsible_id, code, name, kind, promotion_id, display_key, eligibility_mode, max_uses, duration_days, expires_at, offer_id)
         SELECT $1::uuid, $2, $3, $4, $5::uuid, $6, $7, $8::int, $9::int, $10::timestamp, $11::uuid
          WHERE NOT EXISTS (SELECT 1 FROM b2b_promo_links WHERE upper(code) = $2)
         RETURNING id`,
        [seller.id, code, name, kind, promotionId, displayKey, mode, maxUses, durationDays, expiresAt.toISOString().replace("Z", ""), offerId]
      );

      if (rows[0]) link = await findPromoLinkById(run, String(rows[0].id));
    } catch (error) {
      console.error("[b2b/promo-links] gravação", error);
      return { ok: false, status: 503, error: "Não foi possível gravar o link agora. Tente novamente em instantes." };
    }
  }

  if (!link) return { ok: false, status: 503, error: "Não foi possível gerar o código do link. Tente novamente." };

  if (offerId) {
    // A vitrine do link: pública, marcada como loja, ligada ao link; a promoção vale na loja até o link vencer.
    await run(`UPDATE b2b_offers SET is_storefront = true, promo_link_id = $2::uuid WHERE id = $1::uuid`, [offerId, link.id]);
    await run(`UPDATE b2b_offer_promotions SET valid_until = $2::timestamp WHERE offer_id = $1::uuid AND eligibility_mode = 'days'`, [offerId, expiresAt.toISOString().replace("Z", "")]);
  }

  return { ok: true, link, path: promoLinkPath(seller.referralCode, link.code) };
}

// ---------------------------------------------------------------------------
// Abertura do link (/parceiros?...&promo=)
// ---------------------------------------------------------------------------

/** Caminho (/b2b/oferta/<token>) da vitrine do link; null se o link não tem vitrine (kit display). */
export async function promoLinkStorePath(run: SqlRunner, link: PromoLink, sellerName: string): Promise<string | null> {
  if (!link.offerId) return null;

  const contact = { clientName: STOREFRONT_CLIENT_NAME, clientPhone: null, responsibleName: sellerName };
  const existing = await readActiveOfferLink(link.offerId, contact);

  if (existing) return existing.path;

  void run;

  return (await issueOfferLink({ offerId: link.offerId, ...contact })).path;
}

/** Linha do kit display (slug da linha comercial) para abrir /linha/<slug>?kit=<chave>. */
export function displayLinkTarget(link: PromoLink): { lineSlug: string; kit: string } | null {
  const display = link.displayKey ? displayByKey(link.displayKey) : null;

  return display ? { lineSlug: display.lineSlug, kit: display.key } : null;
}

// ---------------------------------------------------------------------------
// Pedido: a oferta do lojista com a promoção do link
// ---------------------------------------------------------------------------

/**
 * Oferta ATIVA do cliente (com este vendedor) com a promoção do link; reaproveita a que ainda vale; cria se não houver. A
 * disponibilidade da promoção é conferida para ESTE cliente (abertura só para quem nunca comprou a linha / está há meses sem
 * comprar): se não estiver disponível, a promoção sai e a oferta sai com preço B2B normal.
 */
export async function ensurePromoClientOffer(
  run: SqlRunner,
  link: PromoLink,
  seller: { id: string; name: string },
  client: { id: string; displayName: string; phone: string | null }
): Promise<{ offerId: string; url: string } | null> {
  if (!link.promotionId || !link.eligibilityMode) return null;

  const rows = await run(
    `SELECT o.id FROM b2b_offers o
      WHERE o.client_id = $1::uuid AND o.responsible_id = $2::uuid AND o.status = 'active' AND o.revoked_at IS NULL
        AND COALESCE(to_jsonb(o) ->> 'is_storefront', 'false') <> 'true'
        AND EXISTS (SELECT 1 FROM b2b_offer_promotions p WHERE p.offer_id = o.id AND p.promotion_id = $3::uuid
                     AND (p.valid_until IS NULL OR p.valid_until > now()) AND (p.max_uses IS NULL OR p.uses_count < p.max_uses))
        AND EXISTS (SELECT 1 FROM b2b_offer_links l WHERE l.offer_id = o.id AND l.revoked_at IS NULL)
      ORDER BY o.created_at DESC LIMIT 3`,
    [client.id, seller.id, link.promotionId]
  );

  for (const row of rows) {
    const existing = await readActiveOfferLink(String(row.id), { clientName: client.displayName, clientPhone: client.phone, responsibleName: seller.name });

    if (existing) return { offerId: String(row.id), url: existing.url };
  }

  const standard = await evaluateStandardOffer(client.id);
  const lines = await loadBuilderLines(new Date(), null);
  const template = {
    commercialGroupIds: standard.commercialGroupIds,
    promotions: lines
      .filter((line) => line.promotions.some((promotion) => promotion.id === link.promotionId))
      .map((line) => ({
        commercialGroupId: line.id,
        promotionId: link.promotionId as string,
        eligibilityMode: link.eligibilityMode as EligibilityMode,
        maxUses: link.maxUses,
        durationDays: link.durationDays,
      })),
  };
  const evaluation = await evaluateTemplate(run, seller.id, client.id, template);
  const created = await createActiveOffer(run, {
    responsible: seller,
    client,
    commercialGroupIds: evaluation.commercialGroupIds.length > 0 ? evaluation.commercialGroupIds : standard.commercialGroupIds,
    promotions: evaluation.promotions,
  });

  return created.ok ? { offerId: created.offerId, url: created.url } : null;
}

/**
 * Para onde /parceiros?v=…&promo=… manda o visitante: a vitrine do link (promoção) ou do kit display; link vencido/revogado cai na loja
 * normal do vendedor com o aviso "esta promoção terminou". null = link desconhecido ou vendedor indisponível (segue o fluxo normal).
 */
export async function resolvePromoLinkTarget(run: SqlRunner, link: PromoLink, now = new Date()): Promise<string | null> {
  const [seller] = await run(
    `SELECT id, name FROM b2b_responsibles r WHERE id = $1::uuid AND status = 'active' AND ${NOT_DEMO_SQL("r")} LIMIT 1`,
    [link.responsibleId]
  ).catch(() => []);

  if (!seller) return null;

  const sellerRef = { id: String(seller.id), name: String(seller.name) };
  const defaultPath = await ensureStorefrontPath(run, sellerRef);

  if (!defaultPath) return null;
  if (promoLinkStatus(link, now) !== "active") return withQueryParam(defaultPath, "aviso", PROMO_ENDED_NOTICE);

  if (link.kind === "display") {
    const target = displayLinkTarget(link);

    return target ? `${defaultPath}/linha/${encodeURIComponent(target.lineSlug)}?kit=${encodeURIComponent(target.kit)}` : defaultPath;
  }

  return (await promoLinkStorePath(run, link, sellerRef.name)) ?? defaultPath;
}
