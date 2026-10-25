/*
 * Medição para Google e Meta: Google tag com Consent Mode v2 (padrão negado), pixel da Meta só com aceite de marketing,
 * eventos de compra (valor em BRL e id do pedido, sem dado pessoal), feeds /feeds/google.xml e /feeds/meta.csv, políticas.
 * Só código: nenhum ID nem chave no repositório (tudo por variável de ambiente).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  GOOGLE_CONSENT_DEFAULT,
  googleConsentFromChoice,
  googlePurchaseEvent,
  googleTagIds,
  metaAddToCartEvent,
  metaInitiateCheckoutEvent,
  metaPixelId,
  metaPurchaseEvent,
  metaViewContentEvent,
  purchaseSentKey,
  safePageLocation,
} from "../src/lib/measurement.ts";
import { META_CSV_COLUMNS, buildFeedItem, feedDescription, isFeedEligible, renderGoogleFeedXml, renderMetaFeedCsv } from "../src/lib/feeds/products.ts";
import { loadFeedItems } from "../src/lib/feeds/items.server.ts";
import { bioProducts } from "../src/lib/catalog/bio-products.ts";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("Consent Mode v2: tudo NEGADO por padrão; marketing aceito concede anúncios e análise; recusa mantém negado", () => {
  assert.deepEqual(GOOGLE_CONSENT_DEFAULT, { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" });
  assert.deepEqual(googleConsentFromChoice(null), GOOGLE_CONSENT_DEFAULT);
  assert.deepEqual(googleConsentFromChoice({ marketing: false }), GOOGLE_CONSENT_DEFAULT);
  assert.deepEqual(googleConsentFromChoice({ marketing: true }), { ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted", analytics_storage: "granted" });
  // análise e marketing separados quando o banner tiver os dois interruptores
  assert.deepEqual(googleConsentFromChoice({ marketing: false, analytics: true }), { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "granted" });
  assert.deepEqual(googleConsentFromChoice({ marketing: true, analytics: false }).analytics_storage, "denied");
});

test("IDs só por variável de ambiente: ausentes = medição desligada; formatos inválidos são ignorados", () => {
  assert.deepEqual(googleTagIds(undefined), []);
  assert.deepEqual(googleTagIds(""), []);
  assert.deepEqual(googleTagIds("G-ABC123, AW-123456789 ,lixo"), ["G-ABC123", "AW-123456789"]);
  assert.equal(metaPixelId(undefined), null);
  assert.equal(metaPixelId("abc"), null);
  assert.equal(metaPixelId("1234567890123456"), "1234567890123456");

  // nenhum ID real no código
  for (const file of ["src/lib/measurement.ts", "src/lib/measurement-client.ts", "src/components/measurement/GoogleTag.tsx", "src/components/measurement/MetaPixel.tsx", "src/components/measurement/PurchaseMeasurement.tsx"]) {
    const src = read(file);
    assert.ok(!/\b(G|AW|GT)-[A-Z0-9]{6,}\b/.test(src.replace(/G-ABC123/g, "")) && !/\b\d{15,16}\b/.test(src), `${file}: sem ID fixo`);
  }
  assert.ok(read("src/lib/measurement.ts").includes("NEXT_PUBLIC_GOOGLE_TAG_ID") && read("src/lib/measurement.ts").includes("NEXT_PUBLIC_META_PIXEL_ID"));
});

test("eventos: purchase (Google) e Purchase (Meta) com valor em BRL e id do pedido; sem dado pessoal; event_id = id do pedido", () => {
  const order = { orderId: "50b98660-9802-4541-9612-964c885ac3ca", valueCents: 6477, items: [{ id: "adulto-floral-em-gotas-sono", quantity: 2, priceCents: 3590 }] };

  const google = googlePurchaseEvent(order);
  assert.equal(google.name, "purchase");
  assert.equal(google.params.transaction_id, order.orderId);
  assert.equal(google.params.value, 64.77);
  assert.equal(google.params.currency, "BRL");
  assert.deepEqual(google.params.items, [{ item_id: "adulto-floral-em-gotas-sono", quantity: 2, price: 35.9 }]);

  const meta = metaPurchaseEvent(order);
  assert.equal(meta.name, "Purchase");
  assert.equal(meta.eventId, order.orderId);
  assert.equal(meta.params.value, 64.77);
  assert.equal(meta.params.currency, "BRL");
  assert.equal(meta.params.num_items, 2);

  for (const text of [JSON.stringify(google), JSON.stringify(meta)]) assert.ok(!/@|cpf|cnpj|email|phone|telefone|nome/i.test(text), "sem dado pessoal");

  assert.deepEqual(metaViewContentEvent({ slug: "x", name: "X", priceCents: 3590 }).params, { content_type: "product", content_ids: ["x"], content_name: "X", value: 35.9, currency: "BRL" });
  assert.deepEqual(metaAddToCartEvent("x").params, { content_type: "product", content_ids: ["x"], currency: "BRL" });
  assert.deepEqual(metaInitiateCheckoutEvent({ valueCents: 7180, items: [{ slug: "a", qty: 2 }] }).params, { value: 71.8, currency: "BRL", content_type: "product", content_ids: ["a"], num_items: 2 });
  assert.equal(purchaseSentKey("meta", "abc"), "bio_purchase_meta_abc");
  assert.equal(safePageLocation("https://www.bioflorais.com.br/acompanhe/TOKEN123?b2b=segredo&x=1"), "https://www.bioflorais.com.br/acompanhe/[token]?x=1");
});

test("fiação: Google tag define o padrão negado ANTES de carregar; pixel da Meta só com aceite; compra nos 3 lugares; AddToCart/ViewContent/InitiateCheckout", () => {
  const google = read("src/components/measurement/GoogleTag.tsx");
  assert.ok(google.indexOf('gtag("consent", "default"') > 0 && google.indexOf('gtag("consent", "default"') < google.indexOf("loadScript("), "padrão negado antes do script");
  assert.ok(google.includes("GOOGLE_CONSENT_DEFAULT") && google.includes("wait_for_update") && google.includes('"update"') && google.includes("send_page_view: false"));
  assert.ok(google.includes("isPixelPath(pathname)") && google.includes("googleTagIds()"), "só nas páginas públicas e só com ID");

  const meta = read("src/components/measurement/MetaPixel.tsx");
  assert.ok(meta.includes("hasMarketingConsent(window.localStorage)") && meta.includes("installMetaPixel(pixelId)") && meta.includes('"revoke"'));
  assert.ok(meta.indexOf("hasMarketingConsent") < meta.indexOf("installMetaPixel(pixelId)"), "o pixel só instala depois de checar o aceite");

  const client = read("src/lib/measurement-client.ts");
  assert.ok(client.includes("!marketingAllowed()") && client.includes("eventID: eventId"), "Meta só com aceite; event_id para deduplicar");

  assert.ok(read("src/app/layout.tsx").includes("<GoogleTag />") && read("src/app/layout.tsx").includes("<MetaPixel />"));
  for (const file of ["src/app/checkout/page.tsx", "src/app/b2b/checkout/B2BCheckoutContent.tsx", "src/app/acompanhe/[token]/page.tsx"]) assert.ok(read(file).includes("<PurchaseMeasurement"), `${file}: compra`);
  assert.ok(read("src/components/cart/CartProvider.tsx").includes("metaAddToCartEvent"));
  assert.ok(read("src/app/produto/[slug]/page.tsx").includes("<ViewContentEvent"));
  assert.ok(read("src/app/checkout/page.tsx").includes("metaInitiateCheckoutEvent"));

  // o servidor decide se pagou: pago/aprovado, não boleto; resposta sem dado pessoal
  const server = read("src/lib/purchase-event-server.ts");
  assert.ok(server.includes("IN ('paid', 'approved')") && server.includes("DISTINCT FROM 'boleto'"));
  assert.ok(!/email|cpf|cnpj|phone|customer/i.test(server.replace(/\/\*[\s\S]*?\*\//g, "")), "consulta sem dado pessoal");
  assert.ok(read("src/components/measurement/PurchaseMeasurement.tsx").includes("purchaseSentKey("), "um evento por pedido e por serviço");
});

test("feeds: itens do catálogo, sem Rescue e sem Depressão, sem promessa de saúde, imagem limpa existente, preço em BRL, marca e links", () => {
  const items = loadFeedItems();
  assert.ok(items.length >= 150, `itens: ${items.length}`);
  assert.equal(new Set(items.map((item) => item.id)).size, items.length, "ids únicos");

  const everything = JSON.stringify(items);
  assert.ok(!/rescue/i.test(everything) && !/depress/i.test(everything), "nada de Rescue nem Depressão");

  for (const item of items) {
    assert.match(item.price, /^\d+\.\d{2} BRL$/);
    assert.equal(item.brand, "Bio Florais");
    assert.equal(item.availability, "in stock");
    assert.ok(item.link.endsWith(`/produto/${item.id}`), item.link);
    assert.ok(item.title.length > 8 && item.title.length <= 150, item.title);
    assert.ok(!/\b(trata|tratamento|cura|curar|elimina|acaba com|alivia|combate|previne|melhora|rem[eé]dio|medicamento)\b/i.test(item.description), `promessa de saúde: ${item.description}`);

    const file = decodeURI(new URL(item.imageLink).pathname);
    assert.ok(existsSync(new URL(`../public${file}`, import.meta.url)), `imagem: ${file}`);
    assert.ok(!file.startsWith("/products/floral-adulto/"), "Adulto usa o recorte limpo do frasco, não a cena com frases");
    assert.ok(!file.startsWith("/cardprodutos/"), "sem artes de marketing");
  }

  // linhas de fora: Snack (arte com frases) e Home Care
  assert.ok(!items.some((item) => /snack/i.test(item.id)) && !items.some((item) => item.id.startsWith("home-care")));
  assert.ok(items.some((item) => item.id === "adulto-floral-em-gotas-sono") && items.some((item) => item.id.startsWith("pet-floral")));
  assert.ok(!items.some((item) => item.id === "adulto-floral-em-gotas-rescue" || item.id === "adulto-floral-em-gotas-tristeza-estado-depressivo"));
});

test("feeds: XML do Google e CSV da Meta bem formados, com escape e as colunas necessárias", () => {
  const items = loadFeedItems();
  const xml = renderGoogleFeedXml(items, "https://www.bioflorais.com.br");

  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>') && xml.includes('xmlns:g="http://base.google.com/ns/1.0"'));
  assert.equal((xml.match(/<item>/g) ?? []).length, items.length);
  for (const tag of ["g:id", "g:title", "g:description", "g:link", "g:image_link", "g:availability", "g:price", "g:brand"]) assert.equal((xml.match(new RegExp(`<${tag}>`, "g")) ?? []).length, items.length, tag);
  assert.ok(!/&(?!amp;|lt;|gt;|quot;|apos;)/.test(xml), "& sempre escapado");
  assert.ok(xml.includes("<g:identifier_exists>no</g:identifier_exists>"), "sem GTIN: identifier_exists=no");

  const csv = renderMetaFeedCsv(items);
  const [header, ...rows] = csv.trim().split("\n");
  assert.equal(header, META_CSV_COLUMNS.join(","));
  assert.equal(rows.length, items.length);
  for (const column of ["id", "title", "description", "availability", "price", "link", "image_link", "brand"]) assert.ok(META_CSV_COLUMNS.includes(column), column);

  // escape de vírgula e aspas
  const odd = buildFeedItem({ ...bioProducts[0], name: 'Teste, "aspas"', slug: "teste-x", priceCents: 1000 }, "https://x.com", () => "/p.jpg");
  assert.ok(renderMetaFeedCsv([odd]).includes('""aspas""'));
  assert.ok(renderGoogleFeedXml([odd], "https://x.com").includes("&quot;aspas&quot;"));

  assert.equal(isFeedEligible({ ...bioProducts[0], name: "Rescue S.O.S." }), false);
  assert.equal(isFeedEligible({ ...bioProducts[0], name: "Tristeza e Depressão" }), false);
  assert.ok(feedDescription({ name: "Sono", category: "Floral em gotas", lineSlug: "adulto", content: "31 ml" }).includes("sem álcool"));
});

test("políticas de cookies e de privacidade citam Google e Meta, o consentimento e o que é enviado", () => {
  for (const file of ["src/app/cookies/page.tsx", "src/app/privacidade/page.tsx"]) {
    const page = read(file);
    assert.ok(page.includes('data-testid="google-meta-politica"'), file);
    for (const part of ["Google tag", "Consent Mode v2", "Pixel da Meta", "negados", "nem é carregado", "Não enviamos nome, e-mail, telefone nem documentos", "Configurar cookies", "25 de outubro de 2026"]) assert.ok(page.includes(part), `${file}: ${part}`);
  }
});
