/*
 * Rodada 12 v3 — Image Tag do ChatGPT Ads (substitui o Pixel JS): sem SDK, oppref em cookie próprio só com aceite
 * de marketing, tag <img> uma vez por pedido PAGO com event_id aleatório e valor em centavos, nada pessoal na URL.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";

const ads = await import("../src/lib/ads-tag.ts");
const server = await import("../src/lib/ads-tag-server.ts");
const consent = await import("../src/lib/consent.ts");

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

function memory() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => void map.set(k, String(v)), removeItem: (k) => void map.delete(k), map };
}
function fakeEnv({ search = "", storage = memory(), session = memory(), secure = true } = {}) {
  const writes = [];
  const doc = { set cookie(v) { writes.push(v); }, get cookie() { return ""; } };
  return { env: { search, storage, session, doc, secure }, writes };
}

const UUID = "5b0c1d2e-3f40-4a51-8b62-7c8d9e0f1a2b";

test("3.1) sem consentimento nada é gravado; com aceite grava bio_oppref (Lax, Secure, 30 dias) exatamente como veio", () => {
  // sem escolha: só guarda na sessão, nenhum cookie
  const undecided = fakeEnv({ search: "?oppref=teste123&utm_source=chatgpt" });
  assert.equal(ads.consentChoiceOf(undecided.env.storage), "undecided");
  assert.equal(ads.syncOppref(undecided.env, "undecided"), "pending");
  assert.deepEqual(undecided.writes, []);
  assert.equal(undecided.env.session.getItem(ads.OPPREF_PENDING_KEY), "teste123");

  // recusou: nada, e descarta o pendente
  consent.writeConsent(undecided.env.storage, false);
  assert.equal(ads.consentChoiceOf(undecided.env.storage), "denied");
  assert.equal(ads.syncOppref(undecided.env, "denied"), "cleared");
  assert.equal(undecided.env.session.getItem(ads.OPPREF_PENDING_KEY), null);
  assert.ok(undecided.writes.every((w) => w.startsWith("bio_oppref=;") && w.includes("Max-Age=0")), "só apaga, nunca grava valor");

  // aceitou, entrando com o oppref na URL
  const granted = fakeEnv({ search: "?oppref=teste123&utm_source=chatgpt" });
  consent.writeConsent(granted.env.storage, true);
  assert.equal(ads.syncOppref(granted.env, ads.consentChoiceOf(granted.env.storage)), "cookie-set");
  assert.equal(granted.writes[0], "bio_oppref=teste123; Max-Age=2592000; Path=/; SameSite=Lax; Secure");
  assert.equal(ads.OPPREF_MAX_AGE_SECONDS, 30 * 24 * 60 * 60);

  // nova chegada com outro oppref substitui e renova
  const again = fakeEnv({ search: "?oppref=outro-valor_9", storage: granted.env.storage });
  ads.syncOppref(again.env, "granted");
  assert.ok(again.writes[0].startsWith("bio_oppref=outro-valor_9;"));
  // sem oppref na URL e nada pendente: não mexe no cookie
  const quiet = fakeEnv({ search: "?utm_source=x", storage: granted.env.storage });
  assert.equal(ads.syncOppref(quiet.env, "granted"), "none");
  assert.deepEqual(quiet.writes, []);
  // http local: sem Secure
  const plain = fakeEnv({ search: "?oppref=abc", secure: false });
  ads.syncOppref(plain.env, "granted");
  assert.ok(!plain.writes[0].includes("Secure"));
});

test("3.1) aceite DEPOIS (banner na mesma visita) captura o oppref da entrada; retirar apaga o cookie", () => {
  const env = fakeEnv({ search: "?oppref=ENTRADA-77" });
  assert.equal(ads.syncOppref(env.env, "undecided"), "pending");
  // o visitante navega para outra página (sem oppref) e aceita
  const later = { ...env.env, search: "" };
  consent.writeConsent(later.storage, true);
  assert.equal(ads.syncOppref(later, "granted"), "cookie-set");
  assert.ok(env.writes[0].startsWith("bio_oppref=ENTRADA-77;"));
  assert.equal(later.session.getItem(ads.OPPREF_PENDING_KEY), null, "pendente consumido");

  // retirar o consentimento: cookie apagado
  consent.writeConsent(later.storage, false);
  assert.equal(ads.syncOppref(later, "denied"), "cleared");
  assert.ok(env.writes.at(-1).startsWith("bio_oppref=; Max-Age=0"));
});

test("oppref: valores estranhos são recusados; cookie codifica e lê de volta igual; query nunca é reescrita", () => {
  assert.equal(ads.parseOppref("?oppref="), null);
  assert.equal(ads.parseOppref("?oppref=" + "a".repeat(513)), null);
  assert.equal(ads.parseOppref("?oppref=a%0Ab"), null, "caractere de controle");
  assert.equal(ads.parseOppref("?utm_source=x"), null);
  assert.equal(ads.parseOppref(""), null);
  const odd = "a b;c=d/é+1";
  assert.equal(ads.parseOppref(`?oppref=${encodeURIComponent(odd)}`), odd);
  const cookie = ads.buildOppRefCookie(odd, true);
  assert.ok(!/[ ;]/.test(cookie.split(";")[0].split("=")[1]), "valor do cookie sem separadores");
  assert.equal(ads.readOppRefCookie(cookie.split(";")[0]), odd);
  assert.equal(ads.readOppRefCookie("a=1; bio_oppref=abc123; b=2"), "abc123");
  assert.equal(ads.readOppRefCookie("a=1"), null);
  assert.equal(ads.readOppRefCookie("%E0%A4%A", false), null, "lixo não quebra");
  // nada na captura toca em history/location
  const source = read("src/lib/ads-tag.ts") + read("src/components/consent/OppRefCapture.tsx");
  assert.ok(!/history\.|replaceState|pushState|location\.(replace|assign|href\s*=)/.test(source));
});

test("3.2) URL da Image Tag: só campos aceitos, centavos inteiros, UUID aleatório, valores codificados, sem dado pessoal", () => {
  const url = ads.buildAdsTagUrl({ eventId: UUID, amountCents: 25870, oppref: "teste123" });
  assert.equal(
    url,
    `https://bzr.openai.com/v1/sdk/events?pid=C43h1qwNBKW7o7E9hgXwh9&event=order_created&event_id=${UUID}&oppref=teste123&data[type]=contents&data[amount]=25870&data[currency]=BRL`
  );
  // sem oppref: o parâmetro some
  const semOppref = ads.buildAdsTagUrl({ eventId: UUID, amountCents: 25870, oppref: null });
  assert.ok(!semOppref.includes("oppref="));
  // oppref é URL-encoded
  assert.ok(ads.buildAdsTagUrl({ eventId: UUID, amountCents: 100, oppref: "a b&c=d" }).includes("oppref=a%20b%26c%3Dd"));
  // centavos sempre inteiros; inválidos recusados
  assert.ok(ads.buildAdsTagUrl({ eventId: UUID, amountCents: 258.7 }).includes("data[amount]=259"));
  assert.equal(ads.buildAdsTagUrl({ eventId: UUID, amountCents: 0 }), null);
  assert.equal(ads.buildAdsTagUrl({ eventId: "pedido-123", amountCents: 100 }), null, "event_id tem de ser UUID (não o número do pedido)");
  // nenhum parâmetro fora da lista (a plataforma rejeita campos desconhecidos) e sem produtos
  const keys = [...url.split("?")[1].split("&")].map((part) => part.split("=")[0]);
  assert.deepEqual(keys, ["pid", "event", "event_id", "oppref", "data[type]", "data[amount]", "data[currency]"]);
  assert.ok(!/contents%5B|data\[contents\]|email|phone|cpf|cnpj|nome|name=/i.test(url));
});

test("3.2) servidor: tag do pedido PAGO (event_id aleatório salvo no pedido, nunca o número), marcada como enviada SÓ no onLoad; boleto/pendente/arquivado não", async () => {
  const pg = new PGlite();
  await pg.exec(`CREATE TABLE orders (id uuid PRIMARY KEY, status text, payment_method text, total_cents int, archived_at timestamp,
      oppref text, ads_event_id uuid, ads_tag_sent_at timestamptz);
    INSERT INTO orders (id, status, payment_method, total_cents, archived_at) VALUES
      ('10000000-0000-4000-8000-000000000001', 'paid', 'pix', 25870, NULL),
      ('10000000-0000-4000-8000-000000000002', 'paid', 'card', 12345, NULL),
      ('10000000-0000-4000-8000-000000000003', 'pending', 'pix', 9990, NULL),
      ('10000000-0000-4000-8000-000000000004', 'paid', 'boleto', 9990, NULL),
      ('10000000-0000-4000-8000-000000000005', 'paid', 'pix', 9990, now());`);
  const run = async (text, params = []) => (await pg.query(text, params)).rows;

  // oppref gravado na criação (só preenche se vazio)
  assert.equal(await server.attachOppref(run, "10000000-0000-4000-8000-000000000001", "teste123"), true);
  assert.equal(await server.attachOppref(run, "10000000-0000-4000-8000-000000000001", "outro"), false, "não sobrescreve");
  assert.equal(await server.attachOppref(run, "10000000-0000-4000-8000-000000000001", ""), false);

  const first = await server.claimAdsTag(run, "10000000-0000-4000-8000-000000000001", "do-cookie");
  assert.ok(first);
  const params = new URLSearchParams(first.split("?")[1].replace(/data\[(\w+)\]/g, "data_$1"));
  assert.equal(params.get("event"), "order_created");
  assert.equal(params.get("data_amount"), "25870");
  assert.equal(params.get("data_currency"), "BRL");
  assert.equal(params.get("oppref"), "teste123", "valor salvo no pedido tem prioridade sobre o cookie");
  assert.match(params.get("event_id"), /^[0-9a-f-]{36}$/);
  assert.ok(!first.includes("10000000-0000-4000-8000-000000000001"), "número/ID do pedido NUNCA na URL");
  const saved = (await run("SELECT ads_event_id::text AS e, ads_tag_sent_at FROM orders WHERE id = '10000000-0000-4000-8000-000000000001'"))[0];
  assert.equal(saved.e, params.get("event_id"), "o mesmo UUID fica no pedido (deduplicação da fase 2)");
  assert.equal(saved.ads_tag_sent_at, null, "oferecer a tag NÃO marca como enviada (a imagem pode ser bloqueada)");

  // imagem bloqueada (onError): nada foi confirmado; a próxima visita reoferece a MESMA URL (mesmo event_id: sem duplicar)
  assert.equal(await server.claimAdsTag(run, "10000000-0000-4000-8000-000000000001", "x"), first);

  // onLoad: só agora marca "tag enviada" (uma vez); depois disso recarregar/outro aparelho não renderiza de novo
  assert.equal(await server.confirmAdsTagSent(run, "10000000-0000-4000-8000-000000000001"), true);
  assert.equal(await server.confirmAdsTagSent(run, "10000000-0000-4000-8000-000000000001"), false, "marca uma vez só");
  assert.ok((await run("SELECT ads_tag_sent_at FROM orders WHERE id = '10000000-0000-4000-8000-000000000001'"))[0].ads_tag_sent_at);
  assert.equal(await server.claimAdsTag(run, "10000000-0000-4000-8000-000000000001", "x"), null);
  // não confirma o que nunca foi oferecido, nem pedido pendente/boleto/arquivado/id inválido
  assert.equal(await server.confirmAdsTagSent(run, "10000000-0000-4000-8000-000000000003"), false);
  assert.equal(await server.confirmAdsTagSent(run, "10000000-0000-4000-8000-000000000004"), false);
  assert.equal(await server.confirmAdsTagSent(run, "nao-uuid"), false);

  // sem oppref no pedido: usa o do cookie; sem nenhum, remove o parâmetro (mesmo event_id enquanto não confirmada)
  const withCookie = await server.claimAdsTag(run, "10000000-0000-4000-8000-000000000002", "so-cookie");
  assert.ok(withCookie.includes("oppref=so-cookie"));
  const noCookie = await server.claimAdsTag(run, "10000000-0000-4000-8000-000000000002", null);
  assert.ok(!noCookie.includes("oppref="));
  assert.equal(new URLSearchParams(noCookie.split("?")[1]).get("event_id"), new URLSearchParams(withCookie.split("?")[1]).get("event_id"));

  assert.equal(await server.claimAdsTag(run, "10000000-0000-4000-8000-000000000003", null), null, "pendente");
  assert.equal(await server.claimAdsTag(run, "10000000-0000-4000-8000-000000000004", null), null, "boleto: fase 2");
  assert.equal(await server.claimAdsTag(run, "10000000-0000-4000-8000-000000000005", null), null, "arquivado/teste");
  assert.equal(await server.claimAdsTag(run, "nao-uuid", null), null);

  // SQL 44b ausente: inerte, sem quebrar
  const old = new PGlite();
  await old.exec(`CREATE TABLE orders (id uuid PRIMARY KEY, status text, payment_method text, total_cents int);
    INSERT INTO orders VALUES ('10000000-0000-4000-8000-000000000001', 'paid', 'pix', 25870);`);
  const oldRun = async (text, params = []) => (await old.query(text, params)).rows;
  assert.equal(await server.claimAdsTag(oldRun, "10000000-0000-4000-8000-000000000001", null), null);
  assert.equal(await server.attachOppref(oldRun, "10000000-0000-4000-8000-000000000001", "x"), false);
});

test("44a/44b: aditivo, idempotente, linha final ok; conferência antes e depois", async () => {
  const pg = new PGlite();
  await pg.exec(`CREATE TABLE orders (id uuid PRIMARY KEY, status text);`);
  const before = (await pg.query(read("sql/b2b/44a_ads_tag_conferencia_one_shot.sql"))).rows;
  assert.equal(before.length, 1);
  assert.equal(before[0].conferencia_ads_tag.colunas_ads_existentes, 0);

  const sql = read("sql/b2b/44b_ads_tag.sql");
  assert.ok(/BEGIN;/.test(sql) && /COMMIT;/.test(sql) && /SELECT 'ok' AS resultado;\s*$/.test(sql));
  assert.ok(!/\b(DROP|DELETE|TRUNCATE|UPDATE)\b/i.test(sql.replace(/--.*$/gm, "")));
  const first = await pg.exec(sql);
  assert.equal(first.at(-1).rows[0].resultado, "ok");
  await pg.exec(sql);
  const after = (await pg.query(read("sql/b2b/44a_ads_tag_conferencia_one_shot.sql"))).rows[0].conferencia_ads_tag;
  assert.equal(after.colunas_ads_existentes, 3);
  assert.equal(after.colunas_ads_existentes, after.colunas_ads_esperadas);
});

test("2) sem Pixel JS: SDK oaiq removido; nada de user/sha256/oaiq; sem CSP a liberar", () => {
  assert.ok(!existsSync(new URL("../src/lib/pixel.ts", import.meta.url)));
  assert.ok(!existsSync(new URL("../src/components/consent/ChatGptAdsPixel.tsx", import.meta.url)));
  for (const file of ["src/lib/ads-tag.ts", "src/lib/ads-tag-server.ts", "src/components/consent/OppRefCapture.tsx", "src/components/consent/AdsPurchaseTag.tsx", "src/app/layout.tsx", "src/app/api/orders/ads-tag/route.ts"]) {
    const source = read(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.ok(!/oaiq|oaiq\.min\.js|bzrcdn|sha256|email_|phone_number|external_id|opt_out/i.test(source), file);
  }
  assert.ok(!/<script|createElement\("script"\)|next\/script/.test(read("src/components/consent/AdsPurchaseTag.tsx")));
  for (const file of ["next.config.ts", "src/middleware.ts", "vercel.json"]) {
    assert.ok(!/Content-Security-Policy/i.test(read(file)) && !/unsafe-inline/.test(read(file)), file);
  }
});

test("3.2/4) fiação: <img> 1x1 oculto só com consentimento; onde carrega; banner e políticas v3", () => {
  const tag = read("src/components/consent/AdsPurchaseTag.tsx");
  assert.ok(tag.includes("hasMarketingConsent(window.localStorage)") && tag.indexOf("hasMarketingConsent") < tag.indexOf("fetch("), "sem consentimento nem consulta o servidor");
  assert.ok(/width=\{1\}\s+height=\{1\}/.test(tag) && tag.includes('display: "none"') && tag.includes('alt=""'));
  // marca "enviada" só no onLoad; onError não marca e libera nova tentativa (imagem bloqueada por extensão/rede)
  assert.ok(tag.includes("onLoad={") && tag.includes("sent: true"), "onLoad confirma no servidor");
  assert.ok(tag.includes("onError={") && tag.includes("setRetry"), "onError libera nova tentativa");
  assert.ok(tag.indexOf("onError={") > tag.indexOf("onLoad={"));
  const onError = tag.slice(tag.indexOf("onError={"));
  assert.ok(!onError.includes("sent: true"), "onError nunca marca como enviada");
  const route = read("src/app/api/orders/ads-tag/route.ts");
  assert.ok(route.includes("body.sent === true") && route.includes("confirmAdsTagSent("));
  assert.ok(read("src/app/layout.tsx").includes("<OppRefCapture />") && read("src/app/layout.tsx").includes("<CookieBanner />"));
  assert.ok(read("src/app/acompanhe/[token]/page.tsx").includes("<AdsPurchaseTag orderId={view.orderId} />"));
  assert.ok(read("src/app/checkout/page.tsx").includes('<AdsPurchaseTag orderId={pendingOrderId} active={pendingOrderStatus === "paid"} />'));
  assert.ok(read("src/app/b2b/checkout/B2BCheckoutContent.tsx").includes("<AdsPurchaseTag orderId={order.id} />"));
  // oppref associado ao pedido na criação (B2C e B2B do lojista)
  assert.ok(read("src/app/api/orders/create/route.ts").includes("attachOppref("));
  const b2b = read("src/app/api/b2b/orders/create/route.ts");
  assert.ok(b2b.includes("if (!launched)") && b2b.includes("attachOppref("));
  // onde NÃO: admin, área do vendedor, internas
  for (const path of ["/admin", "/admin/login", "/b2b/painel", "/b2b/painel/mostruario", "/b2b/login", "/b2b/convite/x", "/api/orders/ads-tag"]) assert.equal(ads.isPixelPath(path), false, path);
  for (const path of ["/", "/linha/adulto", "/checkout", "/acompanhe/x", "/parceiros", "/b2b/oferta/t", "/b2b/carrinho", "/b2b/checkout", "/b2b/pagar"]) assert.equal(ads.isPixelPath(path), true, path);
  // banner: 3 botões com o mesmo destaque; categorias; padrão recusado
  const banner = read("src/components/consent/CookieBanner.tsx");
  assert.ok((banner.match(/<button type="button" className=\{button\}/g) ?? []).length >= 6);
  for (const label of ["Aceitar", "Recusar", "Configurar", "Necessários", "Análise", "Marketing"]) assert.ok(banner.includes(label), label);
  // políticas: texto da v3
  for (const file of ["src/app/privacidade/page.tsx", "src/app/cookies/page.tsx"]) {
    const page = read(file).replace(/\s+/g, " ");
    for (const part of [
      "medimos se os nossos anúncios no ChatGPT (Plataforma de Anúncios da OpenAI) geram compras",
      "guardamos por até 30 dias, no cookie <code>bio_oppref</code>, um código de atribuição fornecido pelo anúncio",
      "informamos à plataforma apenas que houve uma compra, com o valor e um identificador aleatório",
      "Não enviamos nome, e-mail, telefone, documentos nem o número do seu pedido",
      "retirar o consentimento a qualquer momento em &quot;Configurar cookies&quot;",
    ]) {
      assert.ok(page.includes(part), `${file}: ${part}`);
    }
    assert.ok(!/oaiq|__oppref|__obref|pixel de medição/i.test(page), `${file}: sem a redação do pixel JS`);
  }
});

test("5) query string preservada nos redirecionamentos (oppref/utm)", async () => {
  const { forwardQuery } = await import("../src/lib/forward-query.ts");
  assert.equal(forwardQuery("/b2b/oferta/t", { oppref: "teste123", utm_source: "chatgpt" }, ["v"]), "/b2b/oferta/t?oppref=teste123&utm_source=chatgpt");
  assert.ok(read("src/app/parceiros/page.tsx").includes("withForwardedParams(storePath, query)"));
  assert.equal((read("src/app/produto/[slug]/page.tsx").match(/forwardQuery\(/g) ?? []).length, 2);
  assert.ok(read("src/middleware.ts").includes("withLegacyQuery(destination, search)"));
});
