/*
 * MOSTRUÁRIO do vendedor/RCA: preço (% + "reais + 0,90"), só menor volume, condicionador fora, limites por
 * grupo/linha na janela móvel, item fora da lista recusado, vendedor em teste bloqueado, frete regional,
 * pedido marcado e fora da comissão, pagamento autorizado pela sessão do vendedor, Central/Omie.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";

process.env.ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "teste-mostruario";

const showcase = await import("../src/lib/b2b/showcase.ts");
const { bioProducts } = await import("../src/lib/catalog/bio-products.ts");
const { createB2BResponsibleSession } = await import("../src/lib/b2b/responsible-session.ts");
const { verifyShowcaseOrderAccess } = await import("../src/lib/b2b/showcase-order-access.ts");

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-13T12:00:00Z");

const candidates = bioProducts
  .filter((product) => product.priceCents > 0)
  .map((product) => ({
    id: product.slug,
    slug: product.slug,
    name: product.name,
    category: product.category,
    lineSlug: product.lineSlug,
    content: product.content,
    b2cPriceCents: product.priceCents,
  }));

async function seededConfig() {
  const pg = new PGlite();
  await pg.exec(`CREATE TABLE b2b_settings (key text PRIMARY KEY, value text NOT NULL, updated_at timestamp NOT NULL DEFAULT now());`);
  const sql = read("sql/b2b/39b_mostruario.sql");
  await pg.exec(sql);
  await pg.exec(sql); // idempotente
  const run = async (text, params = []) => (await pg.query(text, params)).rows;
  return { pg, run, config: await showcase.loadShowcaseConfig(run), sql };
}

test("39a/39b: preflight em uma linha; 39b aditivo e idempotente; seed da Bio sem condicionador e linha nova desativada", async () => {
  const pg = new PGlite();
  await pg.exec(`CREATE TABLE b2b_settings (key text PRIMARY KEY, value text NOT NULL, updated_at timestamp NOT NULL DEFAULT now());
    CREATE TABLE orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), origin text);`);

  const pre = (await pg.query(read("sql/b2b/39a_mostruario_preflight_one_shot.sql"))).rows;
  assert.equal(pre.length, 1);
  assert.equal(pre[0].preflight_mostruario.pode_prosseguir, true);
  assert.equal(pre[0].preflight_mostruario.tabela_grupos_ja_existe, false);

  const sql = read("sql/b2b/39b_mostruario.sql");
  assert.ok(/BEGIN;/.test(sql) && /COMMIT;/.test(sql) && /IF NOT EXISTS/.test(sql));
  assert.ok(!/\b(DROP|DELETE|TRUNCATE|UPDATE)\b/i.test(sql.replace(/--.*$/gm, "")));
  await pg.exec(sql);
  await pg.exec(sql);

  const groups = (await pg.query("SELECT name, limit_qty, per_line, active FROM b2b_showcase_groups ORDER BY sort_order")).rows;
  assert.equal(groups.length, 10);
  assert.ok(groups.every((group) => group.active === true));
  assert.ok(!groups.some((group) => /condicionador/i.test(group.name)));
  assert.deepEqual(
    (await pg.query("SELECT key, value FROM b2b_settings ORDER BY key")).rows.map((row) => [row.key, row.value]),
    [["showcase_price_percent", "15"], ["showcase_window_days", "45"]]
  );
  // Admin que mexeu na configuração não é sobrescrito ao rodar de novo.
  await pg.exec(`UPDATE b2b_settings SET value = '20' WHERE key = 'showcase_price_percent'; UPDATE b2b_showcase_groups SET limit_qty = 5;`);
  await pg.exec(sql);
  assert.equal((await pg.query("SELECT value FROM b2b_settings WHERE key = 'showcase_price_percent'")).rows[0].value, "20");
  assert.equal((await pg.query("SELECT max(limit_qty) AS m FROM b2b_showcase_groups")).rows[0].m, 5);
  assert.equal((await pg.query(read("sql/b2b/39a_mostruario_preflight_one_shot.sql"))).rows[0].preflight_mostruario.grupos_atuais, 10);
});

test("preço de mostruário: % do B2C com o arredondamento 'reais + 0,90'", () => {
  assert.equal(showcase.showcasePriceCents(3590, 15), 590); // 5,385 -> 5,90
  assert.equal(showcase.showcasePriceCents(3990, 15), 590);
  assert.equal(showcase.showcasePriceCents(2990, 15), 490);
  assert.equal(showcase.showcasePriceCents(3490, 15), 590);
  assert.equal(showcase.showcasePriceCents(7990, 15), 1190);
  assert.equal(showcase.showcasePriceCents(3590, 20), 790);
  assert.equal(showcase.parseShowcasePercent("15,5"), 15.5);
  assert.equal(showcase.parseShowcasePercent("0"), null);
  assert.equal(showcase.parseShowcasePercent("101"), null);
  assert.equal(showcase.parseShowcaseWindowDays("45"), 45);
  assert.equal(showcase.parseShowcaseWindowDays("0"), null);
});

test("volume: ml/L/g/kg normalizados", () => {
  assert.equal(showcase.parseShowcaseVolume("500 ml"), 500);
  assert.equal(showcase.parseShowcaseVolume("5 L"), 5000);
  assert.equal(showcase.parseShowcaseVolume("300ml"), 300);
  assert.equal(showcase.parseShowcaseVolume("140g"), 140);
  assert.equal(showcase.parseShowcaseVolume("1,5 kg"), 1500);
  assert.equal(showcase.parseShowcaseVolume(""), null);
});

test("catálogo liberado: só menor volume, condicionador fora de tudo, linha nova/Home Care/Dose Única indisponíveis", async () => {
  const { config } = await seededConfig();
  const catalog = showcase.buildShowcaseCatalog(config.groups, candidates, config.percent);
  const entries = Array.from(catalog.values());
  const bySlug = (slug) => catalog.get(slug);

  // condicionador (humano, pet e 5 L) nunca entra
  assert.equal(entries.filter((entry) => /condicionador/i.test(`${entry.product.category} ${entry.product.name}`)).length, 0);
  assert.equal(bySlug("cosmeticos-condicionador-uso-diario"), undefined);

  // pet: shampoo 500 ml sim, 5 L não; perfume 120 ml sim, 500 ml não
  const petShampoo = entries.filter((entry) => entry.product.lineSlug === "cosmeticos-pet" && entry.product.category === "Shampoo");
  assert.equal(petShampoo.length, 8);
  assert.ok(petShampoo.every((entry) => showcase.parseShowcaseVolume(entry.product.content) === 500));
  const petPerfume = entries.filter((entry) => entry.product.category === "Perfume Spray");
  assert.equal(petPerfume.length, 5);
  assert.ok(petPerfume.every((entry) => showcase.parseShowcaseVolume(entry.product.content) === 120));
  assert.equal(petPerfume[0].priceCents, 590); // 3490 * 15% = 5,235 -> 5,90

  // humano: shampoo comum x Murumuru em cotas separadas
  const shampoos = entries.filter((entry) => entry.product.lineSlug === "cosmeticos" && entry.product.category === "Shampoo");
  assert.equal(shampoos.length, 12);
  const murumuru = shampoos.filter((entry) => /muru muru/i.test(entry.product.name));
  assert.equal(murumuru.length, 4);
  assert.equal(new Set(murumuru.map((entry) => entry.key)).size, 1);
  assert.notEqual(murumuru[0].key, shampoos.find((entry) => !/muru muru/i.test(entry.product.name)).key);

  // florais por linha; snack, dose única, virtudes e home care ficam de fora
  const florais = entries.filter((entry) => entry.product.category === "Floral em gotas");
  assert.equal(new Set(florais.map((entry) => entry.key)).size, 6);
  assert.equal(entries.filter((entry) => entry.product.category === "Snack Floral").length, 0);
  assert.equal(entries.filter((entry) => ["dose-unica", "virtudes-divinas", "home-care"].includes(entry.product.lineSlug)).length, 0);
  assert.ok(entries.every((entry) => entry.priceCents % 100 === 90));

  // item fora da lista recusado pelo servidor
  const quotas = showcase.buildShowcaseQuotas(catalog, [], 45, NOW);
  const refused = showcase.validateShowcaseCart([{ productId: "cosmeticos-condicionador-uso-diario", qty: 1 }], catalog, quotas);
  assert.equal(refused.ok, false);
  assert.equal(refused.status, 400);
  assert.equal(showcase.validateShowcaseCart([{ productId: "nao-existe", qty: 1 }], catalog, quotas).ok, false);
  assert.equal(showcase.validateShowcaseCart([{ productId: "adulto-floral-em-gotas-rescue", qty: 0 }], catalog, quotas).ok, false);
  assert.equal(showcase.validateShowcaseCart([], catalog, quotas).ok, false);
});

test("limite por grupo/linha e janela móvel de 45 dias, com restante e data de liberação", async () => {
  const { config } = await seededConfig();
  const catalog = showcase.buildShowcaseCatalog(config.groups, candidates, config.percent);
  const adulto = candidates.filter((product) => product.lineSlug === "adulto" && product.category === "Floral em gotas").slice(0, 3);
  const infantil = candidates.find((product) => product.lineSlug === "infantil" && product.category === "Floral em gotas");
  const shampoo = candidates.find((product) => product.lineSlug === "cosmeticos" && product.category === "Shampoo" && !/muru muru/i.test(product.name));

  // sem compras: 2 por linha
  let quotas = showcase.buildShowcaseQuotas(catalog, [], 45, NOW);
  let cart = showcase.validateShowcaseCart([{ productId: adulto[0].id, qty: 1 }, { productId: adulto[1].id, qty: 1 }, { productId: infantil.id, qty: 2 }], catalog, quotas);
  assert.equal(cart.ok, true);
  assert.equal(cart.subtotalCents, catalog.get(adulto[0].id).priceCents + catalog.get(adulto[1].id).priceCents + 2 * catalog.get(infantil.id).priceCents);
  assert.equal(showcase.validateShowcaseCart([{ productId: adulto[0].id, qty: 3 }], catalog, quotas).ok, false);
  assert.equal(
    showcase.validateShowcaseCart([{ productId: adulto[0].id, qty: 1 }, { productId: adulto[1].id, qty: 1 }, { productId: adulto[2].id, qty: 1 }], catalog, quotas).ok,
    false,
    "o limite é por LINHA (soma dos florais), não por produto"
  );

  // comprou 2 florais Adulto há 10 dias e 1 shampoo há 50 dias (fora da janela)
  const usage = [
    { productId: adulto[0].id, qty: 2, createdAt: new Date(NOW.getTime() - 10 * DAY) },
    { productId: shampoo.id, qty: 1, createdAt: new Date(NOW.getTime() - 50 * DAY) },
  ];
  quotas = showcase.buildShowcaseQuotas(catalog, usage, 45, NOW);
  const adultoQuota = quotas.get(catalog.get(adulto[0].id).key);
  assert.equal(adultoQuota.used, 2);
  assert.equal(adultoQuota.remaining, 0);
  assert.equal(adultoQuota.releasesAt.toISOString(), new Date(NOW.getTime() + 35 * DAY).toISOString());
  assert.equal(quotas.get(catalog.get(infantil.id).key).remaining, 2, "outra linha não é afetada");
  assert.equal(quotas.get(catalog.get(shampoo.id).key).remaining, 1, "compra fora da janela libera");

  const blocked = showcase.validateShowcaseCart([{ productId: adulto[1].id, qty: 1 }], catalog, quotas);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.status, 409);
  assert.equal(showcase.validateShowcaseCart([{ productId: infantil.id, qty: 2 }, { productId: shampoo.id, qty: 1 }], catalog, quotas).ok, true);
  assert.equal(showcase.validateShowcaseCart([{ productId: shampoo.id, qty: 2 }], catalog, quotas).ok, false);

  // janela configurável: com 5 dias a compra de 10 dias atrás já não conta
  assert.equal(showcase.buildShowcaseQuotas(catalog, usage, 5, NOW).get(catalog.get(adulto[0].id).key).remaining, 2);
});

test("consulta de uso: conta pago e pendente recente; ignora cancelado, pendente velho, outro vendedor e outra origem", async () => {
  const pg = new PGlite();
  await pg.exec(`CREATE TABLE orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), status text, created_at timestamp DEFAULT now(),
      b2b_responsible_id uuid, origin text);
    CREATE TABLE order_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid, product_id uuid, qty int);`);
  const A = "00000000-0000-4000-8000-00000000000a";
  const B = "00000000-0000-4000-8000-00000000000b";
  const P = "00000000-0000-4000-8000-0000000000f1";
  const add = async (status, ageMinutes, vendor, origin) => {
    const [order] = (
      await pg.query(
        `INSERT INTO orders (status, created_at, b2b_responsible_id, origin) VALUES ($1, now() - ($2::int * interval '1 minute'), $3::uuid, $4) RETURNING id`,
        [status, ageMinutes, vendor, origin]
      )
    ).rows;
    await pg.query(`INSERT INTO order_items (order_id, product_id, qty) VALUES ($1, $2, 1)`, [order.id, P]);
  };
  await add("paid", 60 * 24 * 10, A, "mostruario"); // conta
  await add("pending", 10, A, "mostruario"); // conta (reserva)
  await add("pending", 60 * 5, A, "mostruario"); // pendente velho: não
  await add("cancelled", 10, A, "mostruario"); // não
  await add("paid", 60 * 24 * 60, A, "mostruario"); // fora da janela
  await add("paid", 60, B, "mostruario"); // outro vendedor
  await add("paid", 60, A, "parceiros"); // outra origem
  await add("paid", 60, A, null); // pedido comum

  const run = async (text, params = []) => (await pg.query(text, params)).rows;
  const usage = await showcase.loadShowcaseUsage(run, A, 45);
  assert.equal(usage.length, 2);
  assert.ok(usage.every((row) => row.productId === P && row.qty === 1 && row.createdAt instanceof Date));

  const ids = await showcase.loadShowcaseOrderIds(run);
  assert.equal(ids.size, 6);
});

test("frete do mostruário: sempre a tarifa regional, na modalidade mais barata, custo real preservado", () => {
  const options = [
    { serviceName: "SEDEX", priceCents: 4500, etaDays: 2 },
    { serviceName: "PAC", priceCents: 2100, etaDays: 6 },
  ];
  const [only, ...rest] = showcase.applyShowcaseFreight(options, 990);
  assert.equal(rest.length, 0);
  assert.deepEqual(only, { serviceName: "PAC", etaDays: 6, priceCents: 990, realPriceCents: 2100 });
  // mesmo que o real seja menor que a tarifa, vale a tarifa regional (decisão: SEMPRE)
  assert.equal(showcase.applyShowcaseFreight([{ serviceName: "PAC", priceCents: 500, etaDays: 4 }], 3590)[0].priceCents, 3590);
  assert.deepEqual(showcase.applyShowcaseFreight([], 990), []);
});

test("quem pode pedir: cadastro completo; demonstração, teste e cadastro sem endereço/documento bloqueados", () => {
  const complete = {
    isDemo: false, accessState: "complete", cpf: "12345678901", cnpj: null, postalCode: "01001000",
    street: "Rua A", addressNumber: "10", neighborhood: "Centro", city: "São Paulo", state: "SP",
  };
  assert.equal(showcase.showcaseEligibility(complete).ok, true);
  assert.equal(showcase.showcaseEligibility({ ...complete, isDemo: true }).reason, "demo");
  assert.equal(showcase.showcaseEligibility({ ...complete, accessState: "trial" }).reason, "trial");
  assert.equal(showcase.showcaseEligibility({ ...complete, accessState: "expired" }).reason, "trial");
  assert.equal(showcase.showcaseEligibility({ ...complete, cpf: null }).reason, "incomplete");
  assert.equal(showcase.showcaseEligibility({ ...complete, street: "" }).reason, "incomplete");
  assert.equal(showcase.showcaseEligibility({ ...complete, cpf: null, cnpj: "12345678000199" }).ok, true);
});

test("pagamento do pedido de mostruário: só o próprio vendedor (sessão), nunca demonstração nem pedido comum sem oferta", async () => {
  const pg = new PGlite();
  await pg.exec(`CREATE TABLE b2b_responsibles (id uuid PRIMARY KEY, name text, is_demo boolean DEFAULT false, demo_expires_at timestamp);
    CREATE TABLE orders (id uuid PRIMARY KEY, b2b_responsible_id uuid, origin text);`);
  const A = "00000000-0000-4000-8000-00000000000a";
  const B = "00000000-0000-4000-8000-00000000000b";
  const D = "00000000-0000-4000-8000-0000000000dd";
  const O1 = "00000000-0000-4000-8000-0000000000a1";
  const O2 = "00000000-0000-4000-8000-0000000000a2";
  const O3 = "00000000-0000-4000-8000-0000000000a3";
  await pg.exec(`INSERT INTO b2b_responsibles (id, name, is_demo) VALUES ('${A}', 'Ana', false), ('${B}', 'Bia', false), ('${D}', 'Demo', true);
    INSERT INTO orders VALUES ('${O1}', '${A}', 'mostruario'), ('${O2}', '${A}', NULL), ('${O3}', '${D}', 'mostruario');`);
  const run = async (text, params = []) => (await pg.query(text, params)).rows;

  assert.deepEqual(await verifyShowcaseOrderAccess(run, O1, createB2BResponsibleSession(A)), { ok: true });
  assert.equal((await verifyShowcaseOrderAccess(run, O1, undefined)).status, 401);
  assert.equal((await verifyShowcaseOrderAccess(run, O1, createB2BResponsibleSession(B))).status, 403);
  assert.equal((await verifyShowcaseOrderAccess(run, O2, createB2BResponsibleSession(A))).status, 403, "pedido comum sem oferta segue recusado");
  assert.equal((await verifyShowcaseOrderAccess(run, O3, createB2BResponsibleSession(D))).status, 403, "demonstração nunca paga");
  assert.equal((await verifyShowcaseOrderAccess(run, "00000000-0000-4000-8000-0000000000ff", createB2BResponsibleSession(A))).status, 403);
});

test("pedido marcado e fora da comissão/relatórios; aparece na Central/Omie com a marcação", () => {
  const create = read("src/app/api/b2b/showcase/orders/route.ts");
  // vendedor logado, revalidação no servidor, comprador = vendedor, marcado pela origem
  assert.ok(create.includes("requireResponsible(request)") && create.includes("loadShowcaseState") && create.includes("computeShowcaseQuote"));
  assert.ok(create.includes("SHOWCASE_ORIGIN") && create.includes("PEDIDO DE MOSTRUÁRIO – vendedor"));
  assert.ok(!create.includes("b2b_offer_id") && !create.includes("b2bOfferId") && !create.includes("coupon") && !create.includes("commission"));
  assert.ok(create.includes("vendor.name") && create.includes("vendor.email") && create.includes("ensureOmieVendorDefault"));
  assert.ok(create.includes("quote.state") && create.includes("origin"));

  // sem oferta/cliente, as consultas de comissão e relatório (b2b_offer_id IS NOT NULL) já o excluem
  assert.ok(read("src/lib/b2b/commissions.ts").includes("o.b2b_offer_id IS NOT NULL"));
  assert.ok(read("src/app/api/admin/b2b/tracking/route.ts").includes("isNotNull(orders.b2bOfferId)"));
  assert.ok(read("src/app/api/admin/b2b/responsibles/route.ts").includes("isNotNull(orders.b2bOfferId)"));

  // Central: feed com showcase + observação + vendedor no Omie
  const feed = read("src/lib/central/brand-api.ts");
  assert.ok(feed.includes("SHOWCASE_ORIGIN") && feed.includes("omieObservation") && feed.includes("PEDIDO DE MOSTRUÁRIO – vendedor") && feed.includes("effectiveOmieVendor"));
  const contract = read("src/lib/central/contract.ts");
  assert.ok(contract.includes("showcase?: boolean") && contract.includes("omieObservation?: string | null") && contract.includes("omieVendor?: string | null"));

  // admin de pedidos: selo na lista e no detalhe
  assert.ok(read("src/app/admin/(protected)/pedidos/page.tsx").includes("showcase-badge"));
  assert.ok(read("src/app/admin/(protected)/pedidos/[id]/page.tsx").includes("showcase-badge"));
});

test("rotas de pagamento Pix/cartão aceitam o pedido de mostruário pela sessão; boleto segue só por oferta", () => {
  for (const route of [
    "src/app/api/b2b/payments/mercadopago/pix/route.ts",
    "src/app/api/b2b/payments/mercadopago/card/route.ts",
    "src/app/api/b2b/payments/lunium/pix/route.ts",
  ]) {
    assert.ok(read(route).includes("verifyB2BOrderPaymentAccess"), route);
  }
  assert.ok(read("src/app/api/b2b/payments/boleto/route.ts").includes("verifyB2BOrderOfferToken"));
  assert.ok(read("src/lib/b2b/order-payment-access.ts").includes("verifyB2BOrderOfferToken(order.b2bOfferId"));
});

test("área do vendedor e admin: botão, loja, aba Mostruário; admin validado e grupo novo desativado", () => {
  assert.ok(read("src/app/b2b/painel/page.tsx").includes("Solicitar mostruário"));
  const page = read("src/app/b2b/painel/mostruario/page.tsx");
  assert.ok(page.includes("requireResponsiblePage") && page.includes("Completar cadastro") && page.includes("ShowcaseStore"));
  const store = read("src/components/b2b/ShowcaseStore.tsx");
  assert.ok(store.includes("Você ainda pode pegar") && store.includes("Libera de novo em") && store.includes('useState<"pix" | "card">("pix")'));
  assert.ok(read("src/components/admin/b2b/AdminB2BTabs.tsx").includes("ShowcaseTab"));
  const admin = read("src/app/api/admin/b2b/showcase/route.ts");
  assert.ok(admin.includes("isAdminRequest") && admin.includes("parseShowcasePercent") && admin.includes("parseShowcaseWindowDays"));
  // grupo novo nasce DESATIVADO: active = false no INSERT
  assert.ok(/INSERT INTO b2b_showcase_groups[\s\S]*?\$8::boolean, false,/.test(admin) && admin.includes("DESATIVADO"));
  assert.ok(read("src/components/admin/b2b/ShowcaseTab.tsx").includes("entra desativada"));
});

// ---------------------------------------------------------------------------
// Adendo 15/10 + tabela final do Luis: unidades, teto por linha, 40a/40b
// ---------------------------------------------------------------------------

async function finalConfig(caps = []) {
  const pg = new PGlite();
  await pg.exec(`CREATE TABLE b2b_settings (key text PRIMARY KEY, value text NOT NULL, updated_at timestamp NOT NULL DEFAULT now());
    CREATE TABLE orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), origin text);`);
  const pre39 = (await pg.query(read("sql/b2b/40a_mostruario_tabela_final_preflight_one_shot.sql"))).rows;
  assert.equal(pre39.length, 1);
  assert.equal(pre39[0].preflight_mostruario_tabela_final.pode_prosseguir, false, "sem o 39b o preflight avisa, sem erro");
  await pg.exec(read("sql/b2b/39b_mostruario.sql"));
  const pre = (await pg.query(read("sql/b2b/40a_mostruario_tabela_final_preflight_one_shot.sql"))).rows[0].preflight_mostruario_tabela_final;
  assert.equal(pre.pode_prosseguir, true);
  assert.equal(pre.florais_seed_original_a_ajustar, 1);
  const sql40 = read("sql/b2b/40b_mostruario_tabela_final.sql");
  await pg.exec(sql40);
  await pg.exec(sql40); // idempotente
  for (const [line, cap] of caps) await pg.query(`INSERT INTO b2b_showcase_line_caps (line_slug, cap_qty) VALUES ($1, $2)`, [line, cap]);
  const run = async (text, params = []) => (await pg.query(text, params)).rows;
  return { pg, run, config: await showcase.loadShowcaseConfig(run), sql40 };
}

test("40a/40b: ajusta (sem apagar) os grupos do 39b; idempotente; respeita edição do admin", async () => {
  const { pg, sql40 } = await finalConfig();
  assert.ok(/BEGIN;/.test(sql40) && /COMMIT;/.test(sql40) && !/\b(DROP|DELETE|TRUNCATE)\b/i.test(sql40.replace(/--.*$/gm, "")));
  const groups = (await pg.query("SELECT name, limit_qty, per_line, line_slugs FROM b2b_showcase_groups ORDER BY sort_order, name")).rows;
  assert.equal(groups.length, 14); // 10 do 39b + Adulto + Pet + 2 Home Care
  const by = Object.fromEntries(groups.map((group) => [group.name, group]));
  assert.equal(by["Florais · Adulto"].limit_qty, 3);
  assert.equal(by["Florais · Pet"].limit_qty, 3);
  assert.equal(by["Florais (por linha)"].limit_qty, 2);
  assert.equal(by["Florais (por linha)"].per_line, true);
  assert.deepEqual(by["Florais (por linha)"].line_slugs, ["infantil", "baby", "kids", "teen", "virtudes-divinas", "dose-unica"]);
  assert.equal(by["Home Care · Aromatizador"].limit_qty, 1);
  assert.equal(by["Home Care · Sabonete líquido"].limit_qty, 1);
  assert.equal((await pg.query("SELECT count(*)::int AS n FROM b2b_showcase_line_caps")).rows[0].n, 0);

  // admin renomeou/editou o grupo de florais antes do 40b: o ajuste não sobrescreve
  const edited = new PGlite();
  await edited.exec(`CREATE TABLE b2b_settings (key text PRIMARY KEY, value text NOT NULL, updated_at timestamp NOT NULL DEFAULT now());`);
  await edited.exec(read("sql/b2b/39b_mostruario.sql"));
  await edited.exec(`UPDATE b2b_showcase_groups SET name = 'Meus florais', limit_qty = 4, line_slugs = ARRAY['adulto','pet'] WHERE per_line = true`);
  await edited.exec(sql40);
  const mine = (await edited.query("SELECT name, limit_qty, line_slugs FROM b2b_showcase_groups WHERE name = 'Meus florais'")).rows;
  assert.equal(mine.length, 1);
  assert.equal(mine[0].limit_qty, 4);
});

test("tabela final: florais Adulto/Pet 3, demais 2 (Kids, Teen, Virtudes, Dose Única), Cosméticos 5, Pet 4, Home Care 1 de cada tipo; tetos padrão", async () => {
  const { config } = await finalConfig();
  const catalog = showcase.buildShowcaseCatalog(config.groups, candidates, config.percent);
  const lineQuotas = showcase.buildShowcaseLineQuotas(catalog, [], 45, config.lineCaps, NOW);
  const cap = (line) => lineQuotas.get(line)?.cap;

  assert.equal(cap("adulto"), 3);
  assert.equal(cap("pet"), 3);
  for (const line of ["infantil", "baby", "kids", "teen", "virtudes-divinas", "dose-unica"]) assert.equal(cap(line), 2, line);
  assert.equal(cap("cosmeticos"), 5);
  assert.equal(cap("cosmeticos-pet"), 4);
  assert.equal(cap("home-care"), 2);

  // Home Care: tipos = Aromatizador Spray e Sabonete Líquido; condicionador continua fora
  const home = Array.from(catalog.values()).filter((entry) => entry.lineSlug === "home-care");
  assert.deepEqual(Array.from(new Set(home.map((entry) => entry.product.category))).sort(), ["Aromatizador Spray", "Sabonete Líquido"]);
  assert.equal(new Set(home.map((entry) => entry.key)).size, 2);
  assert.equal(Array.from(catalog.values()).filter((entry) => /condicionador/i.test(entry.product.category)).length, 0);
  assert.ok(Array.from(catalog.values()).some((entry) => entry.lineSlug === "virtudes-divinas"));
  assert.ok(Array.from(catalog.values()).some((entry) => entry.lineSlug === "dose-unica"));
});

test("teto por linha: soma de todos os grupos da linha na janela, configurável; servidor revalida grupo E teto", async () => {
  const { config } = await finalConfig([["cosmeticos", 2]]);
  assert.deepEqual(config.lineCaps, { cosmeticos: 2 });
  const catalog = showcase.buildShowcaseCatalog(config.groups, candidates, config.percent);
  const first = (line, category, notName) =>
    candidates.find((product) => product.lineSlug === line && product.category === category && (!notName || !notName.test(product.name)));
  const shampoo = first("cosmeticos", "Shampoo", /muru muru/i);
  const maos = first("cosmeticos", "Creme Mãos");
  const corpo = first("cosmeticos", "Creme Corpo");
  const sabonete = first("cosmeticos", "Sabonete Líquido");

  let lineQuotas = showcase.buildShowcaseLineQuotas(catalog, [], 45, config.lineCaps, NOW);
  let quotas = showcase.buildShowcaseQuotas(catalog, [], 45, NOW);
  assert.equal(lineQuotas.get("cosmeticos").cap, 2);
  assert.equal(lineQuotas.get("cosmeticos").custom, true);
  assert.equal(lineQuotas.get("cosmeticos").defaultCap, 5);

  // cada grupo respeita 1, mas o teto da linha (2) barra o 3º item
  const ok = showcase.validateShowcaseCart([{ productId: shampoo.id, qty: 1 }, { productId: maos.id, qty: 1 }], catalog, quotas, lineQuotas);
  assert.equal(ok.ok, true);
  const over = showcase.validateShowcaseCart(
    [{ productId: shampoo.id, qty: 1 }, { productId: maos.id, qty: 1 }, { productId: corpo.id, qty: 1 }],
    catalog, quotas, lineQuotas
  );
  assert.equal(over.ok, false);
  assert.equal(over.status, 409);
  assert.match(over.error, /Teto da linha/);
  // sem o argumento de teto (chamada antiga) o grupo continua valendo
  assert.equal(
    showcase.validateShowcaseCart([{ productId: shampoo.id, qty: 1 }, { productId: maos.id, qty: 1 }, { productId: corpo.id, qty: 1 }], catalog, quotas).ok,
    true
  );
  // grupo continua valendo sozinho (2 sabonetes > limite 1)
  assert.equal(showcase.validateShowcaseCart([{ productId: sabonete.id, qty: 2 }], catalog, quotas, lineQuotas).ok, false);

  // uso na janela conta no teto: 2 unidades de cosméticos esgotam a linha; libera 45 dias depois da compra mais antiga
  const usage = [
    { productId: shampoo.id, qty: 1, createdAt: new Date(NOW.getTime() - 10 * DAY) },
    { productId: maos.id, qty: 1, createdAt: new Date(NOW.getTime() - 12 * DAY) },
  ];
  lineQuotas = showcase.buildShowcaseLineQuotas(catalog, usage, 45, config.lineCaps, NOW);
  quotas = showcase.buildShowcaseQuotas(catalog, usage, 45, NOW);
  assert.equal(lineQuotas.get("cosmeticos").remaining, 0);
  assert.equal(lineQuotas.get("cosmeticos").releasesAt.toISOString(), new Date(NOW.getTime() + 33 * DAY).toISOString());
  const blocked = showcase.validateShowcaseCart([{ productId: sabonete.id, qty: 1 }], catalog, quotas, lineQuotas);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.status, 409);
  assert.equal(showcase.findShowcaseOverLimit(quotas, lineQuotas), false);
  // reconferência pós-gravação detecta teto estourado (corrida)
  const raced = showcase.buildShowcaseLineQuotas(catalog, [...usage, { productId: corpo.id, qty: 1, createdAt: new Date(NOW.getTime() - 1 * DAY) }], 45, config.lineCaps, NOW);
  assert.equal(showcase.findShowcaseOverLimit(quotas, raced), true);

  // florais Adulto: 3 no total (soma entre produtos diferentes)
  const adulto = candidates.filter((product) => product.lineSlug === "adulto" && product.category === "Floral em gotas").slice(0, 4);
  const adultoQuotas = showcase.buildShowcaseQuotas(catalog, [], 45, NOW);
  const adultoLines = showcase.buildShowcaseLineQuotas(catalog, [], 45, {}, NOW);
  const cart = (n) => showcase.validateShowcaseCart(adulto.slice(0, n).map((product) => ({ productId: product.id, qty: 1 })), catalog, adultoQuotas, adultoLines);
  assert.equal(cart(3).ok, true);
  assert.equal(cart(4).ok, false);
});

test("teto por linha na tela, no admin e no servidor", () => {
  const store = read("src/components/b2b/ShowcaseStore.tsx");
  assert.ok(store.includes("Você ainda pode pedir") && store.includes("desta linha") && store.includes("libera em"));
  assert.ok(store.includes("showcase-line-cap") && store.includes("usedByLine"));
  assert.ok(read("src/lib/b2b/showcase-quote.ts").includes("state.lineQuotas"));
  const create = read("src/app/api/b2b/showcase/orders/route.ts");
  assert.ok(create.includes("buildShowcaseLineQuotas") && create.includes("findShowcaseOverLimit"));
  const admin = read("src/app/api/admin/b2b/showcase/route.ts");
  assert.ok(admin.includes("save_line_cap") && admin.includes("b2b_showcase_line_caps") && admin.includes("isAdminRequest"));
  assert.ok(read("src/components/admin/b2b/ShowcaseTab.tsx").includes("Teto por linha"));
  assert.ok(read("src/lib/b2b/showcase.ts").includes("b2b_showcase_line_caps"));
});
