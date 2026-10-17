/*
 * Rodada 11 — displays e kits (Bio): composição fixa (DISPLAYS_COMPOSICAO.md), "mais vendidos" = ordem do site,
 * display grátis só com o kit completo, frete 200 g, observação no Omie, mostruário (Kit Provador R$ 2,00,
 * display R$ 3,00, 1 por linha a cada 180 dias), fotos com fallback, nada muda no B2C.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";

process.env.ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "teste-displays";

const displays = await import("../src/lib/b2b/displays.ts");
const server = await import("../src/lib/b2b/displays-server.ts");
const { reconcileDisplayList } = await import("../src/lib/b2b/cart-displays.ts");
const { bioCommercialOrder, bioProducts, getProduct } = await import("../src/lib/catalog/bio-products.ts");
const { resolveB2BUnitPriceCents } = await import("../src/lib/b2b/pricing.ts");
const showcase = await import("../src/lib/b2b/showcase.ts");

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-17T12:00:00Z");

const price = (slug) => {
  const product = getProduct(slug);
  return resolveB2BUnitPriceCents(product.priceCents, product.category);
};
const total = (kit) => kit.reduce((sum, item) => sum + price(item.slug) * item.qty, 0);

test("kit compacto Adulto: 8 SKUs, 13 unidades (Ansiedade 3) = R$ 258,70, acima do mínimo", () => {
  const kit = displays.composeKit(displays.displayByKey("adulto-compacto"));
  assert.equal(kit.length, 8);
  assert.equal(displays.kitUnits(kit), 13);
  assert.equal(kit.find((item) => item.slug.endsWith("sensacao-de-ansiedade")).qty, 3);
  assert.deepEqual(
    kit.map((item) => [item.slug.replace("adulto-floral-em-gotas-", ""), item.qty]),
    [["sensacao-de-ansiedade", 3], ["rescue", 2], ["sono", 2], ["tristeza-estado-depressivo", 2], ["medo", 1], ["fase-da-menopausa", 1], ["reducao-de-peso", 1], ["stress", 1]]
  );
  for (const item of kit) assert.ok(getProduct(item.slug), item.slug);
  assert.equal(price(kit[0].slug), 1990);
  assert.equal(total(kit), 25870);
  assert.ok(total(kit) >= 25000);
  assert.equal(displays.kitSummary(displays.displayByKey("adulto-compacto"), 13), "13 unidades (12 no display + 1 Ansiedade de reposição) · display grátis");
});

test("Pet 12: 9 SKUs, 12 unidades (2 de Ansiedade, Lambedura e Estresse; 1 dos demais)", () => {
  const kit = displays.composeKit(displays.displayByKey("pet-12"));
  assert.equal(kit.length, 9);
  assert.equal(displays.kitUnits(kit), 12);
  assert.deepEqual(kit.filter((item) => item.qty === 2).map((item) => item.slug.replace("pet-floral-em-gotas-", "")), ["ansiedade", "lambedura-e-automutilacao", "stress"]);
  for (const item of kit) assert.ok(getProduct(item.slug), item.slug);
});

test('"N mais vendidos" segue a ordem dos cards da linha no B2C (lida na hora)', () => {
  // Adulto e Pet: bioCommercialOrder; demais linhas: ordem do catálogo.
  assert.deepEqual(displays.rankedLineSlugs("adulto").slice(0, 30), bioCommercialOrder.adulto.slugs.slice(0, 30));
  assert.deepEqual(displays.rankedLineSlugs("pet").slice(0, 25), bioCommercialOrder.pet.slugs.filter((slug) => getProduct(slug)).slice(0, 25));
  assert.ok(!displays.rankedLineSlugs("pet").some((slug) => /snack/.test(slug)), "snack não é floral");

  const medio = displays.composeKit(displays.displayByKey("adulto-medio"));
  assert.equal(medio.length, 24);
  assert.equal(displays.kitUnits(medio), 30);
  assert.deepEqual(medio.map((item) => item.slug), bioCommercialOrder.adulto.slugs.slice(0, 24));
  assert.deepEqual(medio.map((item) => item.qty), [...Array(6).fill(2), ...Array(18).fill(1)]);

  const grande = displays.composeKit(displays.displayByKey("adulto-grande"));
  assert.equal(grande.length, 30);
  assert.equal(displays.kitUnits(grande), 60);
  assert.ok(grande.every((item) => item.qty === 2));

  const pet30 = displays.composeKit(displays.displayByKey("pet-30"));
  assert.equal(pet30.length, 24);
  assert.equal(displays.kitUnits(pet30), 30);
  const pet44 = displays.composeKit(displays.displayByKey("pet-44"));
  assert.equal(pet44.length, 22);
  assert.equal(displays.kitUnits(pet44), 44);

  // a ordem é lida do catálogo: nenhum kit repete SKU
  for (const display of displays.BIO_DISPLAYS) {
    const kit = displays.composeKit(display);
    assert.equal(new Set(kit.map((item) => item.slug)).size, kit.length, display.key);
    for (const item of kit) assert.ok(getProduct(item.slug), `${display.key}: ${item.slug}`);
  }
});

test("demais linhas: Baby, Kids, Teen, Infantil 10 × 2 = 20; Virtudes Divinas 36 × 1; Dose Única 5 × 2 = 10", () => {
  for (const key of ["baby", "kids", "teen", "infantil"]) {
    const kit = displays.composeKit(displays.displayByKey(key));
    assert.equal(kit.length, 10, key);
    assert.equal(displays.kitUnits(kit), 20, key);
  }
  const virtudes = displays.composeKit(displays.displayByKey("virtudes-divinas"));
  assert.equal(virtudes.length, 36);
  assert.equal(displays.kitUnits(virtudes), 36);
  const dose = displays.composeKit(displays.displayByKey("dose-unica"));
  assert.equal(dose.length, 5);
  assert.equal(displays.kitUnits(dose), 10);
  assert.equal(displays.BIO_DISPLAYS.length, 12);
});

test("display grátis só com o kit COMPLETO: remover item tira o display; servidor recusa kit incompleto", () => {
  const compact = displays.displayByKey("adulto-compacto");
  const kit = displays.composeKit(compact);
  const qty = new Map(kit.map((item) => [item.slug, item.qty]));

  const ok = displays.validateDisplays(["adulto-compacto"], qty);
  assert.equal(ok.ok, true);
  assert.equal(ok.displays[0].count, 1);

  // tira 1 Rescue: kit incompleto
  const less = new Map(qty);
  less.set(kit[1].slug, 1);
  const refused = displays.validateDisplays(["adulto-compacto"], less);
  assert.equal(refused.ok, false);
  assert.match(refused.error, /display vem grátis com o kit completo/i);

  // mais itens além do kit continuam valendo
  const more = new Map(qty);
  more.set(kit[0].slug, 10);
  assert.equal(displays.validateDisplays(["adulto-compacto"], more).ok, true);

  // dois kits exigem o dobro
  assert.equal(displays.validateDisplays(["adulto-compacto", "adulto-compacto"], qty).ok, false);
  const double = new Map(kit.map((item) => [item.slug, item.qty * 2]));
  assert.equal(displays.validateDisplays(["adulto-compacto", "adulto-compacto"], double).ok, true);

  // desligado no admin / chave inválida / formato inválido
  assert.equal(displays.validateDisplays(["adulto-compacto"], qty, new Set(["adulto-compacto"])).ok, false);
  assert.equal(displays.validateDisplays(["nao-existe"], qty).ok, false);
  assert.equal(displays.validateDisplays("adulto-compacto", qty).ok, false);
  assert.deepEqual(displays.validateDisplays(undefined, qty), { ok: true, displays: [] });
  assert.equal(displays.completeDisplayCounts(["adulto-compacto"], less).size, 0);
  assert.equal(displays.completeDisplayCounts(["adulto-compacto"], qty).get("adulto-compacto"), 1);

  // a sacola faz o mesmo no navegador (pura): remover item tira o display
  const composition = kit.map((item, index) => ({ productId: `p${index}`, qty: item.qty }));
  const lines = composition.map((item) => ({ ...item }));
  const entry = { key: "adulto-compacto", name: compact.name, composition };
  assert.equal(reconcileDisplayList([entry], lines).displays.length, 1);
  lines[1] = { ...lines[1], qty: 1 };
  const afterRemove = reconcileDisplayList([entry], lines);
  assert.equal(afterRemove.displays.length, 0);
  assert.equal(afterRemove.removed.length, 1);
  assert.ok(read("src/lib/b2b/cart-context.tsx").includes("O display vem grátis com o kit completo"));
});

test("frete soma 200 g (30 × 30 × 3 cm); observação do Omie; display não vira item do pedido", () => {
  assert.equal(displays.DISPLAY_WEIGHT_GRAMS, 200);
  assert.deepEqual(displays.DISPLAY_DIMENSIONS_CM, { length: 30, width: 30, height: 3 });
  const quote = read("src/lib/b2b/quote.ts");
  assert.ok(quote.includes("validateDisplays(") && quote.includes("DISPLAY_WEIGHT_GRAMS") && quote.includes("DISPLAY_DIMENSIONS_CM.length"));
  assert.ok(quote.indexOf("validateDisplays(") < quote.indexOf("resolveB2BPromotionBonusLines("), "revalidado no servidor antes da promoção/mínimo");

  assert.equal(displays.displayOmieObservation(displays.displayByKey("adulto-compacto")), "+ 1 Display compacto Florais Adulto (brinde)");
  const feed = read("src/lib/central/brand-api.ts");
  assert.ok(feed.includes("displayOmieObservation") && feed.includes("commercial_adjustments_json") && feed.includes("omieObservation"));
  const create = read("src/app/api/b2b/orders/create/route.ts");
  assert.ok(create.includes("displays: body.displays") && create.includes("quote.displays.map"));
  assert.ok(!/orderItems[\s\S]{0,200}display/i.test(create.slice(create.indexOf("itemSnapshots"))), "display não é item");
  // checkout/carrinho mostram a linha R$ 0,00 e mandam as chaves ao servidor
  assert.ok(read("src/app/b2b/checkout/B2BCheckoutContent.tsx").includes("linha-display") && read("src/app/b2b/checkout/B2BCheckoutContent.tsx").includes("displays: displayKeys"));
  assert.ok(read("src/app/b2b/carrinho/B2BCartContent.tsx").includes("displays-brinde"));
  assert.ok(read("src/app/admin/(protected)/pedidos/[id]/page.tsx").includes("pedido-display"));
});

test("fotos: nome fixo em public/b2b/displays; sem arquivo o card usa a imagem da linha; adulto-compacto já publicada", () => {
  assert.ok(existsSync(new URL("../public/b2b/displays/adulto-compacto.webp", import.meta.url)));
  assert.equal(server.displayPhotoUrl("adulto-compacto"), "/b2b/displays/adulto-compacto.webp");
  assert.equal(server.displayPhotoUrl("pet-12"), null);

  const root = mkdtempSync(join(tmpdir(), "displays-"));
  mkdirSync(join(root, "public", "b2b", "displays"), { recursive: true });
  assert.equal(server.displayPhotoUrl("pet-12", root), null);
  writeFileSync(join(root, "public", "b2b", "displays", "pet-12.jpg"), "x");
  assert.equal(server.displayPhotoUrl("pet-12", root), "/b2b/displays/pet-12.jpg");
  // nomes fixos conforme o LEIAME
  assert.deepEqual(displays.BIO_DISPLAYS.map((display) => display.key), ["adulto-compacto", "adulto-medio", "adulto-grande", "pet-12", "pet-30", "pet-44", "baby", "kids", "teen", "infantil", "virtudes-divinas", "dose-unica"]);
});

test("cards de kit por linha: Adulto (compacto + escolha), Pet (escolha), demais (Kit com display); desligar tira", () => {
  const lineProducts = (line) =>
    bioProducts.filter((product) => product.lineSlug === line).map((product) => ({ id: `id-${product.slug}`, slug: product.slug, name: product.name, category: product.category, b2cPriceCents: product.priceCents }));

  const adulto = server.buildKitCards("adulto", lineProducts("adulto"), new Set());
  assert.equal(adulto.length, 2);
  assert.equal(adulto[0].title, "Kit display compacto 15 × 15");
  assert.equal(adulto[0].featured, true);
  assert.equal(adulto[0].options[0].totalCents, 25870);
  assert.equal(adulto[0].options[0].units, 13);
  assert.equal(adulto[1].title, "Escolha seu display");
  assert.deepEqual(adulto[1].options.map((option) => option.label), ["Compacto", "Médio", "Grande"]);
  assert.deepEqual(adulto[1].options.map((option) => option.units), [13, 30, 60]);
  assert.equal(adulto[0].options[0].photo, "/b2b/displays/adulto-compacto.webp");
  assert.equal(adulto[1].options[1].photo, null, "sem foto: o card usa a imagem da linha + selo Display");
  assert.equal(adulto[0].lineImage, "/assets/home/linhas/Adulto.png");

  const pet = server.buildKitCards("pet", lineProducts("pet"), new Set());
  assert.equal(pet.length, 1);
  assert.equal(pet[0].title, "Escolha seu display");
  assert.deepEqual(pet[0].options.map((option) => option.label), ["12", "30", "44"]);

  for (const line of ["baby", "kids", "teen", "infantil", "virtudes-divinas", "dose-unica"]) {
    const cards = server.buildKitCards(line, lineProducts(line), new Set());
    assert.equal(cards.length, 1, line);
    assert.equal(cards[0].title, "Kit com display");
    assert.equal(cards[0].options.length, 1);
  }

  // nada de display em linha sem display; desligado no admin some
  assert.deepEqual(server.buildKitCards("cosmeticos", lineProducts("cosmeticos"), new Set()), []);
  assert.equal(server.buildKitCards("adulto", lineProducts("adulto"), new Set(["adulto-compacto"])).length, 1);
  assert.deepEqual(server.buildKitCards("baby", lineProducts("baby"), new Set(["baby"])), []);
  assert.equal(server.lineSlugsWithDisplay(new Set(["baby"])).has("baby"), false);
  assert.equal(server.lineSlugsWithDisplay(new Set()).has("adulto"), true);
});

test("liga/desliga do admin: tolerante sem a tabela e persiste a lista", async () => {
  const pg = new PGlite();
  const run = async (text, params = []) => (await pg.query(text, params)).rows;
  assert.equal((await server.loadDisabledDisplays(run)).size, 0, "sem b2b_settings: tudo ligado");
  await pg.exec(`CREATE TABLE b2b_settings (key text PRIMARY KEY, value text NOT NULL, updated_at timestamp NOT NULL DEFAULT now());`);
  assert.equal((await server.loadDisabledDisplays(run)).size, 0);
  await server.saveDisabledDisplays(run, ["pet-44", "baby", "nao-existe"]);
  assert.deepEqual([...(await server.loadDisabledDisplays(run))].sort(), ["baby", "pet-44"]);
  await server.saveDisabledDisplays(run, []);
  assert.equal((await server.loadDisabledDisplays(run)).size, 0);
});

test("41b: aditivo e idempotente; 14 produtos internos, 3 colunas e 2 grupos; 41a confere pelo slug adulto-%", async () => {
  const pg = new PGlite();
  await pg.exec(`CREATE TABLE b2b_settings (key text PRIMARY KEY, value text NOT NULL, updated_at timestamp NOT NULL DEFAULT now());
    CREATE TABLE products (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text UNIQUE NOT NULL, name text NOT NULL, line_slug text, category text,
      price_cents integer NOT NULL, weight_grams integer, length_cm integer, width_cm integer, height_cm integer, active boolean NOT NULL DEFAULT true,
      image_url text, created_at timestamp DEFAULT now());`);
  // produtos reais do catálogo (como no Neon) para a conferência por slug
  for (const product of bioProducts.filter((item) => ["adulto", "pet", "baby", "kids", "teen", "infantil", "virtudes-divinas", "dose-unica"].includes(item.lineSlug))) {
    await pg.query(`INSERT INTO products (slug, name, line_slug, category, price_cents) VALUES ($1, $2, $3, $4, $5)`, [product.slug, product.name, product.lineSlug, product.category, product.priceCents]);
  }

  const pre41 = (await pg.query(read("sql/b2b/41a_displays_conferencia_one_shot.sql"))).rows;
  assert.equal(pre41.length, 1, "uma linha JSON");
  assert.equal(pre41[0].conferencia_displays.mostruario_39b_existe, false, "sem o 39b avisa, sem erro");
  assert.equal(pre41[0].conferencia_displays.kit_compacto_skus_encontrados, 8);
  assert.equal(pre41[0].conferencia_displays.florais_adulto, 33);

  await pg.exec(read("sql/b2b/39b_mostruario.sql"));
  await pg.exec(read("sql/b2b/40b_mostruario_tabela_final.sql"));

  const sql = read("sql/b2b/41b_displays_mostruario.sql");
  assert.ok(/BEGIN;/.test(sql) && /COMMIT;/.test(sql) && /SELECT 'ok' AS resultado;\s*$/.test(sql), "transação e linha final ok");
  assert.ok(!/\b(DROP|DELETE|TRUNCATE)\b/i.test(sql.replace(/--.*$/gm, "")));
  const first = await pg.exec(sql);
  assert.equal(first.at(-1).rows[0].resultado, "ok");
  await pg.exec(sql);

  const conf = (await pg.query(read("sql/b2b/41a_displays_conferencia_one_shot.sql"))).rows[0].conferencia_displays;
  assert.equal(conf.colunas_grupos_ok, true);
  assert.equal(conf.produtos_internos_displays, 12);
  assert.equal(conf.produtos_internos_provador, 2);
  assert.equal(conf.grupos_displays_e_provador, 2);
  assert.equal(conf.kit_compacto_skus_encontrados, conf.kit_compacto_skus_esperados);
  assert.equal(conf.kit_pet_12_skus_encontrados, conf.kit_pet_12_skus_esperados);

  const internos = (await pg.query("SELECT slug, category, weight_grams, length_cm, width_cm, height_cm FROM products WHERE slug LIKE 'bio-%' ORDER BY slug")).rows;
  assert.equal(internos.length, 14);
  assert.ok(internos.filter((row) => row.category === "Display").every((row) => row.weight_grams === 200 && row.length_cm === 30 && row.width_cm === 30 && row.height_cm === 3));
  assert.ok(internos.filter((row) => row.category === "Kit Provador").every((row) => row.weight_grams === 8 && row.length_cm === 6 && row.width_cm === 2 && row.height_cm === 2));
  assert.deepEqual(
    displays.BIO_DISPLAYS.map((display) => displays.showcaseDisplaySlug(display)).sort(),
    internos.filter((row) => row.category === "Display").map((row) => row.slug).sort(),
    "slug do produto = código interno em minúsculas"
  );

  // mostruário: preço fixo, limite 1 por linha a cada 180 dias (janela própria), destaque, fora do teto da linha
  const run = async (text, params = []) => (await pg.query(text, params)).rows;
  const config = await showcase.loadShowcaseConfig(run);
  assert.equal(config.available, true);
  const displayGroup = config.groups.find((group) => group.name === "Displays");
  const provGroup = config.groups.find((group) => group.name === "Kit Provador (florais de ambiente)");
  assert.equal(displayGroup.windowDays, 180);
  assert.equal(displayGroup.fixedPriceCents, 300);
  assert.equal(provGroup.fixedPriceCents, 200);
  assert.equal(provGroup.highlight, true);

  const rows = await run(`SELECT id, slug, name, category, line_slug, price_cents FROM products WHERE slug LIKE 'bio-%' OR slug LIKE 'adulto-floral-em-gotas-%'`);
  const candidates = rows.map((row) => ({ id: String(row.id), slug: row.slug, name: row.name, category: row.category, lineSlug: row.line_slug, content: "", b2cPriceCents: Number(row.price_cents) }));
  const catalog = showcase.buildShowcaseCatalog(config.groups, candidates, config.percent);
  const bySlug = (slug) => Array.from(catalog.values()).find((entry) => entry.product.slug === slug);

  assert.equal(bySlug("bio-disp-adulto-compacto").priceCents, 300, "display R$ 3,00 fixo (fora dos 15%)");
  assert.equal(bySlug("bio-prov-itsblossom").priceCents, 200, "Kit Provador R$ 2,00 fixo");
  assert.equal(bySlug("bio-prov-ambpet").priceCents, 200);
  assert.equal(bySlug("bio-disp-adulto-compacto").key, bySlug("bio-disp-adulto-grande").key, "1 por LINHA: os 3 displays do Adulto dividem a cota");
  assert.notEqual(bySlug("bio-disp-adulto-compacto").key, bySlug("bio-disp-pet-12").key);

  const compact = bySlug("bio-disp-adulto-compacto").product.id;
  const grande = bySlug("bio-disp-adulto-grande").product.id;
  const usage = [{ productId: compact, qty: 1, createdAt: new Date(NOW.getTime() - 100 * DAY) }];
  let quotas = showcase.buildShowcaseQuotas(catalog, usage, config.windowDays, NOW);
  let lineQuotas = showcase.buildShowcaseLineQuotas(catalog, usage, config.windowDays, config.lineCaps, NOW);
  assert.equal(quotas.get(bySlug("bio-disp-adulto-grande").key).remaining, 0, "100 dias atrás ainda bloqueia (janela de 180)");
  assert.equal(quotas.get(bySlug("bio-disp-adulto-grande").key).releasesAt.toISOString(), new Date(NOW.getTime() + 80 * DAY).toISOString());
  const blocked = showcase.validateShowcaseCart([{ productId: grande, qty: 1 }], catalog, quotas, lineQuotas);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.status, 409);
  assert.equal(quotas.get(bySlug("bio-disp-pet-12").key).remaining, 1, "outra linha não é afetada");
  assert.equal(showcase.validateShowcaseCart([{ productId: grande, qty: 2 }], catalog, showcase.buildShowcaseQuotas(catalog, [], config.windowDays, NOW), lineQuotas).ok, false, "2 de uma mesma linha passam do limite 1");

  quotas = showcase.buildShowcaseQuotas(catalog, [{ productId: compact, qty: 1, createdAt: new Date(NOW.getTime() - 190 * DAY) }], config.windowDays, NOW);
  assert.equal(quotas.get(bySlug("bio-disp-adulto-grande").key).remaining, 1, "190 dias atrás libera");
  const ok = showcase.validateShowcaseCart([{ productId: grande, qty: 1 }, { productId: bySlug("bio-prov-ambpet").product.id, qty: 1 }], catalog, quotas, lineQuotas);
  assert.equal(ok.ok, true);
  assert.equal(ok.subtotalCents, 300 + 200);

  // display/provador não gastam o teto de unidades da linha (florais Adulto continuam 3)
  lineQuotas = showcase.buildShowcaseLineQuotas(catalog, [{ productId: compact, qty: 1, createdAt: new Date(NOW.getTime() - 5 * DAY) }], config.windowDays, config.lineCaps, NOW);
  assert.equal(lineQuotas.get("adulto").cap, 3);
  assert.equal(lineQuotas.get("adulto").used, 0);

  // janela geral continua 45 dias para os demais grupos
  assert.equal(config.windowDays, 45);
});

test("loja do lojista: faixa, selo, cards de kit com o mesmo componente; mostruário com destaque; admin; B2C intocado", () => {
  const strip = read("src/components/b2b/DisplayStrip.tsx");
  for (const text of ["Pouco espaço no balcão? Temos uma opção compacta!", "O display Bio Florais ocupa só 15 × 15 cm.", "8 fragrâncias, 12 unidades. Cabe ao lado do caixa e vende sozinho.", "Quero o kit com display"]) {
    assert.ok(strip.includes(text), text);
  }
  assert.ok(strip.includes("md:order-2") && /aspect-\[16\/10\]/.test(strip), "foto à direita no desktop, em cima no celular");
  assert.ok(strip.includes("rounded-[26px] border border-[#eadfda] bg-white shadow-sm"), "mesmo estilo dos cards de linha");

  const offer = read("src/app/b2b/oferta/[token]/page.tsx");
  assert.ok(offer.indexOf("</B2BHero>") < offer.indexOf("<DisplayStrip") && offer.indexOf("<DisplayStrip") < offer.indexOf(`{store ? "Nossas linhas" : "Sua oferta"}`), "faixa entre Meus pedidos/Acompanhar e o título Sua oferta");
  assert.ok(offer.includes("?kit=adulto-compacto") && offer.includes("withDisplay={displayLines.has(line.slug)}"));
  assert.ok(read("src/components/b2b/B2BLineCard.tsx").includes("Com display"));

  const catalog = read("src/components/b2b/B2BOfferCatalog.tsx");
  const kitCard = catalog.slice(catalog.indexOf("function KitCard"), catalog.indexOf("function ProductCard"));
  const productCard = catalog.slice(catalog.indexOf("function ProductCard"), catalog.indexOf("export default function B2BOfferCatalog"));
  // mesmo componente visual: container, proporção da foto, selo, título, preço e botão iguais aos do produto
  for (const shared of ["rounded-[20px] border", "aspect-square", "rounded-2xl bg-[#fbf5f1]", "text-[11px] font-extrabold uppercase tracking-[0.06em]", "text-sm font-bold leading-snug text-[#422347]", "text-lg font-extrabold text-[#55245f]", "rounded-full bg-[#63326d]"]) {
    assert.ok(kitCard.includes(shared) && productCard.includes(shared), shared);
  }
  assert.ok(kitCard.includes("Display") && kitCard.includes("Escolha seu display") && kitCard.includes("Adicionar kit") && kitCard.includes("grátis"));
  assert.ok(catalog.includes("kits.map") && catalog.indexOf("kits.map") < catalog.indexOf("group.products.map"), "kits são os PRIMEIROS cards");
  assert.ok(read("src/app/b2b/oferta/[token]/linha/[slug]/page.tsx").includes("buildKitCards("));

  // mostruário e admin
  assert.ok(read("src/components/b2b/ShowcaseStore.tsx").includes("selo-destaque"));
  assert.ok(read("src/components/admin/b2b/AdminB2BTabs.tsx").includes("DisplaysTab"));
  assert.ok(read("src/app/api/admin/b2b/displays/route.ts").includes("isAdminRequest"));

  // B2C intocado: nada em src/app/(site), checkout, produto, linha do B2C
  for (const file of ["src/app/linha/[slug]/page.tsx", "src/app/produto/[slug]/page.tsx", "src/app/checkout/page.tsx", "src/app/page.tsx"]) {
    assert.ok(!/displays?(-|\/|"|\b)/i.test(read(file).replace(/display[:\s-]*(flex|grid|none|block|inline|contents)/gi, "")) || !read(file).includes("lib/b2b/displays"), file);
  }
});
