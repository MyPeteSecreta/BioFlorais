/*
 * Links com promoção do vendedor (SQL 52b): /parceiros?v=<código>&promo=<código curto>. Parte pura (código, situação, caminhos) e
 * contratos de código (sessão, só promoção ativa do admin, link vencido abre a loja normal com aviso). O fluxo completo (gerar,
 * abrir anônimo, comprar, vincular, vencer) foi exercitado no harness com banco PGlite.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { generatePromoCode, normalizePromoCode, promoLinkPath, promoLinkStatus, withQueryParam, PROMO_ENDED_NOTICE } from "../src/lib/b2b/promo-link-core.ts";
import { PARTNER_INTERNAL_PARAMS, withForwardedParams } from "../src/lib/b2b/partners.ts";

const root = new URL("../", import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), "utf8").replace(/\r\n/g, "\n");

test("código curto: 6 letras/números sem caracteres ambíguos; normaliza e recusa o que não é código", () => {
  for (let i = 0; i < 50; i += 1) assert.match(generatePromoCode(), /^[A-HJKMNP-Z2-9]{6}$/);

  assert.equal(normalizePromoCode(" ab12cd "), "AB12CD");
  assert.equal(normalizePromoCode("x"), null);
  assert.equal(normalizePromoCode("ab 12"), null);
  assert.equal(normalizePromoCode(undefined), null);
});

test("situação do link: ativo, vencido (data passou) e revogado; sem data de fim nunca vence", () => {
  const now = new Date("2026-10-29T12:00:00Z");

  assert.equal(promoLinkStatus({ expiresAt: new Date("2026-11-28T12:00:00Z"), revokedAt: null }, now), "active");
  assert.equal(promoLinkStatus({ expiresAt: new Date("2026-10-29T11:59:59Z"), revokedAt: null }, now), "expired");
  assert.equal(promoLinkStatus({ expiresAt: null, revokedAt: null }, now), "active");
  assert.equal(promoLinkStatus({ expiresAt: new Date("2027-01-01T00:00:00Z"), revokedAt: new Date("2026-10-01T00:00:00Z") }, now), "revoked");
});

test("caminhos: link com promoção, aviso na loja normal, e o parâmetro promo não vai para a loja", () => {
  assert.equal(promoLinkPath("ANA01", "K7M2QX"), "/parceiros?v=ANA01&promo=K7M2QX");
  assert.equal(withQueryParam("/b2b/oferta/abc", "aviso", PROMO_ENDED_NOTICE), "/b2b/oferta/abc?aviso=promo-encerrada");
  assert.equal(withQueryParam("/b2b/oferta/abc?kit=x", "aviso", "y"), "/b2b/oferta/abc?kit=x&aviso=y");
  assert.ok(PARTNER_INTERNAL_PARAMS.includes("promo") && PARTNER_INTERNAL_PARAMS.includes("v"));
  assert.equal(withForwardedParams("/b2b/oferta/abc", { v: "ANA01", promo: "K7M2QX", utm_source: "insta" }), "/b2b/oferta/abc?utm_source=insta");
});

test("contratos: só promoção ativa do admin e elegibilidade da matriz; vários links; vitrine do link; vencido abre a loja normal", () => {
  const links = read("src/lib/b2b/promo-links.ts");
  assert.ok(links.includes("loadBuilderLines(now, null)") && links.includes("findPromotionRule("), "promoção vem das ativas do admin e a elegibilidade da matriz");
  assert.ok(links.includes("createActiveOffer(") && links.includes("promo_link_id"), "a vitrine do link nasce pelo mesmo caminho do Offer Builder");
  assert.ok(links.includes("MAX_LINKS_PER_SELLER"), "limite de links por vendedor");
  assert.ok(links.includes("evaluateTemplate(") && links.includes("ensurePromoClientOffer"), "no pedido a promoção é conferida para o cliente");

  const route = read("src/app/api/b2b/promo-links/route.ts");
  assert.ok(route.includes("readB2BResponsibleSession(request.cookies.get(B2B_SESSION_COOKIE)?.value)") && route.includes("status: 401"));
  assert.ok(route.includes("loadDemoState") && route.includes('"Cache-Control": "private, no-store"'));

  const page = read("src/app/parceiros/page.tsx");
  assert.ok(page.includes("findPromoLinkByCode") && page.includes("resolvePromoLinkTarget"));

  const offerPage = read("src/app/b2b/oferta/[token]/page.tsx");
  assert.ok(offerPage.includes("Promoção: {context.promoLink.name}") && offerPage.includes("Esta promoção terminou."));

  const orders = read("src/app/api/b2b/orders/create/route.ts");
  assert.ok(orders.includes('resolution.error === "promo_link_ended"') && orders.includes("ensurePromoClientOffer"));

  const sql = read("sql/b2b/52b_links_com_promocao.sql");
  assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS b2b_promo_links") && sql.includes("promo_link_id") && sql.includes("DROP INDEX IF EXISTS b2b_offers_storefront_uq"));
  assert.ok(!/DELETE FROM|DROP TABLE|TRUNCATE/i.test(sql), "o SQL é só aditivo");

  assert.ok(read("src/components/b2b/ReferralLinkPanel.tsx").includes("PromoLinksPanel"));
  assert.ok(read("src/components/b2b/PromoLinksPanel.tsx").includes("Criar link com promoção"));
});
