/*
 * Rodada 19c — testes do Luis no fluxo real:
 *  1) lojista no link pessoal: tudo volta para a loja DELE; sacola restaurada substitui a anterior; descartar/converter limpa;
 *  2) "Continuar compra" para o próprio lojista (Meus pedidos);
 *  3) representante: salvar orçamento, retomar na ficha do cliente e "Enviar para o cliente pagar";
 *  4) acesso do lojista sem senha (/b2b/entrar): resposta neutra, e-mail só para o endereço cadastrado, limite de tentativas.
 * Mais a correção achada no fluxo real: a folha de impressão quebrava (constante exportada de módulo "use client").
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

process.env.ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "teste-segredo-rodada-19c";

const access = await import("../src/lib/b2b/access-link.ts");
const mail = await import("../src/lib/mail.ts");
const css = await import("../src/lib/b2b/print-css.ts");

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

test("impressão: o CSS vive fora de módulo 'use client' (constante de módulo cliente chega ao servidor como referência e quebra a página)", () => {
  const cssSource = read("src/lib/b2b/print-css.ts");
  assert.ok(!/^["']use client["']/m.test(cssSource));
  assert.ok(css.PRINT_CSS.includes("@page { size: A4") && css.PRINT_CSS.includes("body * { visibility: hidden"));
  assert.ok(css.PRINT_PAGE_CSS.includes(".order-print-page") && !css.PRINT_PAGE_CSS.includes(".order-print-root"));
  assert.equal(typeof css.PRINT_PAGE_CSS, "string");

  const button = read("src/components/b2b/PrintOrderButton.tsx");
  assert.ok(button.includes('"use client"') && button.includes('from "@/lib/b2b/print-css"') && !/export \{ PRINT_CSS \}/.test(button), "o botão não reexporta a constante");
  const view = read("src/components/b2b/OrderPrintView.tsx");
  assert.ok(!view.includes('"use client"'), "a página de impressão é de servidor");
  assert.ok(view.includes('import PrintOrderButton from "@/components/b2b/PrintOrderButton"'), "só o componente (default) vem do módulo cliente");
  assert.ok(view.includes("PRINT_PAGE_CSS") && !/\{[^}]*PRINT_CSS[^}]*\}\s*from "@\/components\/b2b\/PrintOrderButton"/.test(view));
});

test("1) lojista no link pessoal: o orçamento salvo na loja geral devolve o link PESSOAL e as ações usam esse link", () => {
  const route = read("src/app/api/b2b/orders/create/route.ts");
  const quoteBlock = route.slice(route.indexOf("if (asQuote) {\n      return NextResponse.json"));
  assert.ok(quoteBlock.slice(0, 900).includes("storeLink: storefront ? storefront.storeUrl : null"));

  const checkout = read("src/app/b2b/checkout/B2BCheckoutContent.tsx");
  assert.ok(checkout.includes('const linkToken = (storeLink ? tokenFromOfferUrl(storeLink) : "") || token;'));
  assert.ok(checkout.includes("continueQuotePath(linkToken, savedQuote.id, launched)") && checkout.includes("printQuotePath(savedQuote.id, linkToken)"));
  assert.ok(checkout.includes("/b2b/oferta/${encodeURIComponent(linkToken)}/pedidos") && checkout.includes("<ReorderLink token={linkToken} url={storeLink} />"));
  assert.ok(checkout.includes("setStoreLink(typeof data.storeLink"), "guarda o link pessoal ao salvar o orçamento");
});

test("1) sacola fantasma: a barra mostra só a sacola DESTE link, 'Esvaziar', e descartar o orçamento limpa a sacola", () => {
  const catalog = read("src/components/b2b/B2BOfferCatalog.tsx");
  assert.ok(catalog.includes("const mine = cart.state.offerToken === token;") && catalog.includes("const barItems = mine ? cart.itemCount : 0;"));
  assert.ok(catalog.includes('data-testid="esvaziar-sacola"') && catalog.includes("cart.clear();") && catalog.includes("clearQuoteDraft(window.sessionStorage, token)"));
  const restore = read("src/components/b2b/QuoteRestore.tsx");
  const discard = restore.slice(restore.indexOf("Descartar orçamento") - 900, restore.indexOf("Descartar orçamento"));
  assert.ok(discard.includes("clearQuoteDraft(window.sessionStorage, token)") && discard.includes("cart.clear()"));
  assert.ok(restore.includes("cart.setOfferToken(token);") && restore.includes("cart.load(data.lines"), "a sacola restaurada SUBSTITUI a anterior");
  assert.match(restore, /onde você paga por Pix ou cartão/);
  // converter / salvar de novo também limpam (sacola e rascunho)
  const checkout = read("src/app/b2b/checkout/B2BCheckoutContent.tsx");
  assert.equal((checkout.match(/clearQuoteDraft\(window\.sessionStorage, token\)/g) ?? []).length >= 2, true);
  assert.equal((checkout.match(/cart\.clear\(\)/g) ?? []).length >= 2, true);
});

test("2) Meus pedidos do link pessoal: orçamento com 'Continuar compra' como botão principal", () => {
  const mine = read("src/app/b2b/oferta/[token]/pedidos/page.tsx");
  assert.ok(mine.includes("<QuoteActions") && mine.includes("continueQuotePath(token, quote.orderId)") && mine.includes("listClientQuotes(run, resolution.context.clientId)"));
  assert.ok(read("src/components/b2b/QuoteActions.tsx").includes('data-testid="continuar-compra"'));
});

test("3) representante: 'Enviar para o cliente pagar' (WhatsApp e Copiar link) no após-salvar e na ficha do cliente", () => {
  const actions = read("src/components/b2b/QuoteActions.tsx");
  assert.ok(actions.includes("sendToClient") && actions.includes("Enviar para o cliente pagar") && actions.includes("paga por Pix ou cartão"));
  const checkout = read("src/app/b2b/checkout/B2BCheckoutContent.tsx");
  assert.ok(checkout.includes("sendToClient={launched}"), "no 'Lançar pedido' (representante)");
  const vendor = read("src/components/b2b/QuoteReopenButton.tsx");
  assert.ok(vendor.includes('data-testid="enviar-cliente-pagar"') && vendor.includes("Enviar para o cliente pagar") && vendor.includes("continueQuotePath(token, quoteId, true)"));
  // o link enviado é o do lojista (sem modo lançar)
  assert.ok(vendor.includes("continueQuotePath(token, quoteId, false)"));
  assert.ok(read("src/app/b2b/painel/cliente/[clientId]/page.tsx").includes("<QuoteReopenButton"));
});

test("4) identificador: e-mail ou CNPJ/CPF válidos; lixo vira null", () => {
  assert.deepEqual(access.parseIdentifier(" Loja@Flor.COM "), { kind: "email", value: "loja@flor.com" });
  assert.deepEqual(access.parseIdentifier("11.222.333/0001-81"), { kind: "document", value: "11222333000181" });
  assert.deepEqual(access.parseIdentifier("529.982.247-25"), { kind: "document", value: "52998224725" });
  for (const bad of ["", "   ", "11.222.333/0001-82", "123", "sem-arroba", "a@b", null, undefined, "x".repeat(300)]) assert.equal(access.parseIdentifier(bad), null, String(bad));
});

test("4) hashes (nunca o dado em claro), limites e e-mail com os links", () => {
  const h = access.hashValue("email:loja@x.com", "segredo");
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(h, access.hashValue("email:loja@x.com", "segredo"));
  assert.notEqual(h, access.hashValue("email:loja@x.com", "outro"));
  assert.ok(!h.includes("loja"));
  assert.equal(access.withinLimits({ identifier: 2, ip: 9 }), true);
  assert.equal(access.withinLimits({ identifier: 3, ip: 0 }), false);
  assert.equal(access.withinLimits({ identifier: 0, ip: 10 }), false);
  const message = access.buildAccessEmail([{ clientName: "Loja <A>", url: "https://x.com/b2b/oferta/t" }]);
  assert.equal(message.subject, "Seu link de compra Bio Florais");
  assert.ok(message.text.includes("https://x.com/b2b/oferta/t") && message.html.includes('<a href="https://x.com/b2b/oferta/t">'));
  assert.ok(message.html.includes("Loja &lt;A&gt;") && !message.html.includes("Loja <A>"), "HTML escapado");
});

test("4) e-mail: sem configuração não envia; com configuração chama o Resend com a chave; falha vira false", async () => {
  assert.equal(mail.mailConfigured({}), false);
  assert.equal(mail.mailConfigured({ RESEND_API_KEY: "k", MAIL_FROM: "Bio <a@b.com>" }), true);
  assert.equal(await mail.sendEmail({ to: "a@b.com", subject: "s", text: "t" }, async () => assert.fail("não deve chamar"), {}), false);
  const calls = [];
  const ok = await mail.sendEmail({ to: "a@b.com", subject: "s", text: "t", html: "<p>t</p>" }, async (url, init) => (calls.push([url, init]), { ok: true }), { RESEND_API_KEY: "chave", MAIL_FROM: "Bio <a@b.com>" });
  assert.equal(ok, true);
  assert.equal(calls[0][0], "https://api.resend.com/emails");
  assert.equal(calls[0][1].headers.Authorization, "Bearer chave");
  assert.deepEqual(JSON.parse(calls[0][1].body).to, ["a@b.com"]);
  assert.equal(await mail.sendEmail({ to: "a@b.com", subject: "s", text: "t" }, async () => ({ ok: false, status: 500 }), { RESEND_API_KEY: "k", MAIL_FROM: "f" }), false);
  assert.equal(await mail.sendEmail({ to: "a@b.com", subject: "s", text: "t" }, async () => { throw new Error("rede"); }, { RESEND_API_KEY: "k", MAIL_FROM: "f" }), false);
});

const C1 = "50000000-0000-4000-8000-000000000001";
const C2 = "50000000-0000-4000-8000-000000000002";
const C3 = "50000000-0000-4000-8000-000000000003";
const S1 = "40000000-0000-4000-8000-000000000001";
const S2 = "40000000-0000-4000-8000-000000000002";
const O1 = "60000000-0000-4000-8000-000000000001";
const O2 = "60000000-0000-4000-8000-000000000002";
const O3 = "60000000-0000-4000-8000-000000000003";
const O4 = "60000000-0000-4000-8000-000000000004";

async function seedAccess() {
  const pg = new PGlite();
  await pg.exec(`
    CREATE TABLE b2b_responsibles (id uuid PRIMARY KEY, status text, name text, is_demo boolean DEFAULT false);
    CREATE TABLE b2b_clients (id uuid PRIMARY KEY, display_name text, email text, active boolean DEFAULT true, document text, archived_at timestamp);
    CREATE TABLE b2b_client_relationships (id serial PRIMARY KEY, client_id uuid, responsible_id uuid, active boolean DEFAULT true, unlinked_at timestamp);
    CREATE TABLE b2b_offers (id uuid PRIMARY KEY, client_id uuid, responsible_id uuid, status text, revoked_at timestamp, created_at timestamp DEFAULT now(), is_storefront boolean DEFAULT false);
    CREATE TABLE b2b_offer_links (id serial PRIMARY KEY, offer_id uuid, revoked_at timestamp);
    INSERT INTO b2b_responsibles VALUES ('${S1}', 'active', 'Ana', false), ('${S2}', 'active', 'Demo', true);
    INSERT INTO b2b_clients (id, display_name, email, document) VALUES
      ('${C1}', 'Loja Flor de Lis', 'Loja@Flordelis.test', '11222333000181'),
      ('${C2}', 'Loja Demo', 'demo@x.test', '52998224725'),
      ('${C3}', 'Sem E-mail', NULL, '11444777000161');
    INSERT INTO b2b_client_relationships (client_id, responsible_id) VALUES ('${C1}', '${S1}'), ('${C2}', '${S2}'), ('${C3}', '${S1}');
    INSERT INTO b2b_offers (id, client_id, responsible_id, status, is_storefront) VALUES
      ('${O1}', '${C1}', '${S1}', 'active', false), ('${O2}', '${C2}', '${S2}', 'active', false), ('${O3}', '${C3}', '${S1}', 'active', false), ('${O4}', '${C1}', '${S1}', 'active', true);
    INSERT INTO b2b_offer_links (offer_id) VALUES ('${O1}'), ('${O2}'), ('${O3}'), ('${O4}');`);
  await pg.exec(read("sql/b2b/49b_acesso_lojista.sql"));
  const run = async (text, params = []) => (await pg.query(text, params)).rows;
  const sent = [];
  const deps = {
    readLink: async (offerId) => ({ url: `https://www.bioflorais.com.br/b2b/oferta/token-${offerId.slice(-1)}` }),
    sendEmail: async (message) => (sent.push(message), true),
  };

  return { pg, run, sent, deps };
}

test("4) /b2b/entrar: e-mail ou CNPJ -> link pessoal SÓ para o e-mail cadastrado; sem cadastro/sem e-mail/demonstração/vitrine nada é enviado", async () => {
  const { run, sent, deps } = await seedAccess();

  assert.equal(await access.requestAccessLink(run, { identifier: "loja@flordelis.test", ip: "1.1.1.1" }, deps), "sent");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "loja@flordelis.test");
  assert.ok(sent[0].text.includes("/b2b/oferta/token-1") && !sent[0].text.includes("token-4"), "só a oferta pessoal (nunca a vitrine)");

  // CNPJ: o e-mail vai para o endereço do CADASTRO, não para o que foi digitado
  assert.equal(await access.requestAccessLink(run, { identifier: "11.222.333/0001-81", ip: "1.1.1.2" }, deps), "sent");
  assert.equal(sent[1].to, "loja@flordelis.test");

  assert.equal(await access.requestAccessLink(run, { identifier: "naoexiste@x.test", ip: "1.1.1.3" }, deps), "not_found");
  assert.equal(await access.requestAccessLink(run, { identifier: "529.982.247-25", ip: "1.1.1.4" }, deps), "not_found", "representante de demonstração");
  assert.equal(await access.requestAccessLink(run, { identifier: "11.444.777/0001-61", ip: "1.1.1.5" }, deps), "not_found", "cadastro sem e-mail");
  assert.equal(await access.requestAccessLink(run, { identifier: "lixo", ip: "1.1.1.6" }, deps), "invalid");
  assert.equal(sent.length, 2, "nada além dos dois envios");

  const failing = { ...deps, sendEmail: async () => false };
  assert.equal(await access.requestAccessLink(run, { identifier: "loja@flordelis.test", ip: "9.9.9.9" }, failing), "send_failed", "e-mail indisponível: a resposta continua neutra");
});

test("4) limite de tentativas: por identificador (3/h) e por IP (10/h); registra só hashes", async () => {
  const { pg, run, sent, deps } = await seedAccess();

  const outcomes = [];
  for (let i = 0; i < 5; i += 1) outcomes.push(await access.requestAccessLink(run, { identifier: "loja@flordelis.test", ip: `2.2.2.${i}` }, deps));
  assert.deepEqual(outcomes, ["sent", "sent", "sent", "limited", "limited"]);
  assert.equal(sent.length, 3);

  // por IP: 10 pedidos de identificadores diferentes e o 11º é barrado
  const results = [];
  for (let i = 0; i < 12; i += 1) results.push(await access.requestAccessLink(run, { identifier: `pessoa${i}@x.test`, ip: "3.3.3.3" }, deps));
  assert.equal(results.filter((r) => r === "not_found").length, 10);
  assert.equal(results.filter((r) => r === "limited").length, 2);

  const stored = (await pg.query("SELECT identifier_hash, ip_hash FROM b2b_access_requests")).rows;
  assert.ok(stored.length >= 13);
  assert.ok(stored.every((row) => /^[0-9a-f]{64}$/.test(row.identifier_hash) && (row.ip_hash === null || /^[0-9a-f]{64}$/.test(row.ip_hash))));
  assert.ok(!JSON.stringify(stored).includes("flordelis") && !JSON.stringify(stored).includes("3.3.3.3"), "nenhum dado em claro");

  // janela de 1 hora: pedidos antigos não contam
  await pg.exec(`UPDATE b2b_access_requests SET created_at = now() - interval '2 hours'`);
  assert.equal(await access.requestAccessLink(run, { identifier: "loja@flordelis.test", ip: "4.4.4.4" }, deps), "sent");
});

test("4) sem a tabela do SQL 49b o fluxo continua neutro (sem limite persistido, nada quebra)", async () => {
  const pg = new PGlite();
  await pg.exec(`
    CREATE TABLE b2b_responsibles (id uuid PRIMARY KEY, status text);
    CREATE TABLE b2b_clients (id uuid PRIMARY KEY, display_name text, email text, active boolean DEFAULT true, document text, archived_at timestamp);
    CREATE TABLE b2b_client_relationships (id serial PRIMARY KEY, client_id uuid, responsible_id uuid, active boolean DEFAULT true, unlinked_at timestamp);
    CREATE TABLE b2b_offers (id uuid PRIMARY KEY, client_id uuid, responsible_id uuid, status text, revoked_at timestamp, created_at timestamp DEFAULT now());
    CREATE TABLE b2b_offer_links (id serial PRIMARY KEY, offer_id uuid, revoked_at timestamp);
    INSERT INTO b2b_responsibles VALUES ('${S1}', 'active');
    INSERT INTO b2b_clients (id, display_name, email) VALUES ('${C1}', 'Loja', 'loja@x.test');
    INSERT INTO b2b_client_relationships (client_id, responsible_id) VALUES ('${C1}', '${S1}');
    INSERT INTO b2b_offers (id, client_id, responsible_id, status) VALUES ('${O1}', '${C1}', '${S1}', 'active');
    INSERT INTO b2b_offer_links (offer_id) VALUES ('${O1}');`);
  const run = async (text, params = []) => (await pg.query(text, params)).rows;
  const sent = [];
  const deps = { readLink: async () => ({ url: "https://x/b2b/oferta/t" }), sendEmail: async (m) => (sent.push(m), true) };
  assert.equal(await access.requestAccessLink(run, { identifier: "loja@x.test", ip: "1.1.1.1" }, deps), "sent");
});

test("49a/49b: aditivo, idempotente, linha final ok; conferência antes e depois", async () => {
  const pg = new PGlite();
  await pg.exec(`CREATE TABLE b2b_clients (id uuid PRIMARY KEY, active boolean DEFAULT true, email text); INSERT INTO b2b_clients (id, email) VALUES ('${C1}', 'a@b.com');`);
  const conf = read("sql/b2b/49a_acesso_lojista_conferencia_one_shot.sql");
  const before = (await pg.query(conf)).rows[0].conferencia_acesso_lojista;
  assert.equal(before.tabela_acessos_existe, false);
  assert.equal(before.clientes_ativos_com_email, 1);
  const sql = read("sql/b2b/49b_acesso_lojista.sql");
  assert.ok(/BEGIN;/.test(sql) && /COMMIT;/.test(sql) && /SELECT 'ok' AS resultado;\s*$/.test(sql));
  assert.ok(!/\b(DROP|DELETE|TRUNCATE|UPDATE)\b/i.test(sql.replace(/--.*$/gm, "")));
  assert.equal((await pg.exec(sql)).at(-1).rows[0].resultado, "ok");
  await pg.exec(sql);
  assert.equal((await pg.query(conf)).rows[0].conferencia_acesso_lojista.tabela_acessos_existe, true);
  assert.ok(!/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\b/i.test(conf.replace(/--.*$/gm, "")), "conferência é só leitura");
});

test("4) ligações: rota sempre neutra, página, link 'Já sou cliente' na loja geral, em /parceiros e no rodapé do B2B; lojista sem login", () => {
  const route = read("src/app/api/b2b/entrar/route.ts");
  assert.ok(route.includes("ACCESS_NEUTRAL_MESSAGE") && route.includes("catch (error)") && route.includes("return NextResponse.json({ ok: true, message: ACCESS_NEUTRAL_MESSAGE })"));
  assert.ok(!/status:\s*4\d\d/.test(route), "nunca devolve erro que revele algo");
  const page = read("src/app/b2b/entrar/page.tsx");
  assert.ok(page.includes("Já sou cliente") && page.includes("E-mail ou CNPJ") && page.includes('"/api/b2b/entrar"'));
  assert.ok(read("src/app/b2b/oferta/[token]/page.tsx").includes('href="/b2b/entrar"'), "loja geral (vitrine)");
  assert.ok(read("src/app/parceiros/page.tsx").includes('href="/b2b/entrar"'));
  const layout = read("src/app/b2b/layout.tsx");
  assert.ok(layout.includes("<B2BPublicFooter />"));
  const footer = read("src/components/b2b/B2BPublicFooter.tsx");
  assert.ok(footer.includes('href="/b2b/entrar"') && footer.includes("/b2b/painel") && footer.includes("/b2b/login"));
  const lib = read("src/lib/b2b/access-link.ts");
  assert.ok(lib.includes("SÓ para o endereço cadastrado") && lib.includes("ACCESS_LIMITS"));
  assert.ok(!/localStorage|document\.cookie|Set-Cookie|createB2BResponsibleSession/.test(lib), "não cria sessão nem login");
});
