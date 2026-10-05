/*
 * Período de teste do vendedor (7 dias): cadastro rápido, banner, bloqueio no 8º dia,
 * links dos clientes seguem funcionando, comissão retida e liberada ao completar,
 * SQL 26a/26b. Mesmas funções e consultas do app (PGlite = Postgres real em memória).
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";

const {
  TRIAL_DAYS,
  accessState,
  adminSituation,
  bannerText,
  loadCompletedVendorIds,
  loadVendorAccess,
  parseCompleteProfile,
  parseQuickSignup,
  trialEndsFrom,
} = await import("../src/lib/b2b/vendor-profile.ts");
const { loadCommissionRows, totalsFor } = await import("../src/lib/b2b/commissions.ts");

const UUID = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const V_TRIAL = UUID(1);
const V_DONE = UUID(2);
const V_LEGACY = UUID(3);
const V_INCOMPLETE_OLD = UUID(4);
const CLIENT = UUID(10);
const OFFER = UUID(11);
const PRODUCT = UUID(12);

let pg;
const run = async (text, params = []) => (await pg.query(text, params)).rows;
const sqlFile = (name) => readFileSync(new URL(`../sql/b2b/${name}`, import.meta.url), "utf8");
const src = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), "utf8");
const DAY = 24 * 60 * 60 * 1000;

before(async () => {
  pg = new PGlite();
  await pg.exec(`
    CREATE TABLE b2b_responsibles (id uuid PRIMARY KEY, name text, status text DEFAULT 'active', cpf text, cnpj text, postal_code text, pix_key text,
      onboarding_completed_at timestamp, company_approved_at timestamp, rca_terms_accepted_at timestamp, created_at timestamp DEFAULT now());
    CREATE TABLE b2b_clients (id uuid PRIMARY KEY, display_name text);
    CREATE TABLE products (id uuid PRIMARY KEY, slug text, name text, category text, line_slug text);
    CREATE TABLE orders (id uuid PRIMARY KEY, status text, payment_method text, total_cents int, shipping_cents int,
      b2b_responsible_id uuid, b2b_responsible_name text, b2b_client_id uuid, b2b_offer_id uuid, created_at timestamp DEFAULT now());
    CREATE TABLE order_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid, product_id uuid, qty int, unit_price_cents int,
      commission_base_percent numeric, commission_extra_percent numeric, commission_total_percent numeric, commission_basis text);
    CREATE TABLE payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid, status text, created_at timestamp DEFAULT now());
    INSERT INTO products VALUES ('${PRODUCT}', 'cosmeticos-pet-shampoo-agressividade', 'Agressividade', 'Shampoo', 'cosmeticos-pet');
    INSERT INTO b2b_clients VALUES ('${CLIENT}', 'Cliente');
    -- V_DONE: cadastro antigo completo; V_LEGACY: idem; V_INCOMPLETE_OLD: sem Pix (não pode ser marcado)
    INSERT INTO b2b_responsibles (id, name, cpf, postal_code, pix_key, onboarding_completed_at) VALUES
      ('${V_DONE}', 'Completo', '123', '22041001', 'chave', '2026-09-01 10:00:00'),
      ('${V_LEGACY}', 'Legado PJ', NULL, '22041001', 'chave', '2026-08-01 10:00:00'),
      ('${V_INCOMPLETE_OLD}', 'Sem Pix', '123', '22041001', NULL, NULL);
    UPDATE b2b_responsibles SET cnpj = '12345678000190' WHERE id = '${V_LEGACY}';
    INSERT INTO b2b_responsibles (id, name) VALUES ('${V_TRIAL}', 'Em teste');
  `);
});

after(async () => {
  await pg?.close();
});

test("cadastro RÁPIDO: só nome, WhatsApp, e-mail e senha (mínimos validados)", () => {
  const ok = parseQuickSignup({ name: "Maria Silva", phone: "(21) 99999-1234", email: "Maria@Exemplo.com", password: "12345678" }, "convite@x.com");
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.value, { name: "Maria Silva", phone: "21999991234", email: "maria@exemplo.com", password: "12345678" });

  assert.equal(parseQuickSignup({ name: "Ma", phone: "21999991234", email: "a@b.com", password: "12345678" }, "").ok, false);
  assert.equal(parseQuickSignup({ name: "Maria", phone: "123", email: "a@b.com", password: "12345678" }, "").ok, false);
  assert.equal(parseQuickSignup({ name: "Maria", phone: "21999991234", email: "sem-arroba", password: "12345678" }, "").ok, false);
  assert.equal(parseQuickSignup({ name: "Maria", phone: "21999991234", email: "a@b.com", password: "curta" }, "").ok, false);
  // E-mail em branco usa o do convite.
  assert.equal(parseQuickSignup({ name: "Maria", phone: "21999991234", password: "12345678" }, "convite@x.com").value.email, "convite@x.com");
});

test("teste de 7 dias: banner com os dias que faltam; no 8º dia o acesso vence; completar remove o banner", () => {
  const signup = new Date("2026-10-05T15:00:00Z");
  const trialEndsAt = trialEndsFrom(signup);
  assert.equal(TRIAL_DAYS, 7);
  assert.equal(trialEndsAt.getTime() - signup.getTime(), 7 * DAY);

  const day0 = accessState({ trialEndsAt, profileCompletedAt: null }, signup);
  assert.equal(day0.state, "trial");
  assert.equal(day0.daysLeft, 7);
  assert.match(bannerText(day0), /^Período de teste: faltam 7 dias \(até 12\/10\/2026\)\. Complete seu cadastro para continuar e receber suas comissões\.$/);

  const day6 = accessState({ trialEndsAt, profileCompletedAt: null }, new Date(signup.getTime() + 6.5 * DAY));
  assert.equal(day6.daysLeft, 1);
  assert.match(bannerText(day6), /falta 1 dia/);

  // Bloqueio: logo depois do fim do 7º dia (8º dia).
  assert.equal(accessState({ trialEndsAt, profileCompletedAt: null }, new Date(trialEndsAt.getTime())).state, "trial"); // exatamente no fim ainda vale
  assert.equal(accessState({ trialEndsAt, profileCompletedAt: null }, new Date(trialEndsAt.getTime() + 1000)).state, "expired");
  assert.equal(bannerText({ state: "expired", endsAt: trialEndsAt }), null);

  // Completar: sem banner e sem bloqueio, mesmo depois do prazo.
  const later = new Date(signup.getTime() + 30 * DAY);
  assert.equal(accessState({ trialEndsAt, profileCompletedAt: later }, later).state, "complete");
  assert.equal(accessState({ trialEndsAt: null, profileCompletedAt: null }, later).state, "complete"); // cadastro antigo
});

test("cadastro COMPLETO: documento, endereço, Pix OU banco e termo RCA (só RCA)", () => {
  const base = { personType: "pf", cpf: "123.456.789-09", postalCode: "22041-001", street: "Rua A", addressNumber: "10", neighborhood: "Copa", city: "Rio", state: "rj", pixKey: "a@b.com", rcaTermsAccepted: true };

  const ok = parseCompleteProfile(base, "rca");
  assert.equal(ok.ok, true);
  assert.equal(ok.value.cpf, "12345678909");
  assert.equal(ok.value.state, "RJ");

  assert.equal(parseCompleteProfile({ ...base, cpf: "123" }, "rca").ok, false);
  assert.equal(parseCompleteProfile({ ...base, personType: "pj", cnpj: "123" }, "rca").ok, false);
  assert.equal(parseCompleteProfile({ ...base, postalCode: "123" }, "rca").ok, false);
  assert.equal(parseCompleteProfile({ ...base, pixKey: "" }, "rca").ok, false); // sem Pix nem banco
  assert.equal(parseCompleteProfile({ ...base, pixKey: "", bankName: "Itaú", bankAgency: "1", bankAccount: "2" }, "rca").ok, true); // banco completo vale
  assert.equal(parseCompleteProfile({ ...base, pixKey: "", bankName: "Itaú" }, "rca").ok, false); // banco incompleto não
  assert.equal(parseCompleteProfile({ ...base, rcaTermsAccepted: false }, "rca").ok, false); // termo obrigatório no RCA
  assert.equal(parseCompleteProfile({ ...base, rcaTermsAccepted: false }, "clt").ok, true); // vendedor CLT não precisa do termo
});

test("26a/26b: preflight em uma linha JSON; 26b marca como completos só os cadastros com dados, é idempotente e não altera dados existentes", async () => {
  const [pre] = await run(sqlFile("26a_trial_vendedor_preflight_one_shot.sql"));
  assert.equal(pre.preflight_trial_vendedor.vendedores_total, 4);
  assert.equal(pre.preflight_trial_vendedor.seriam_marcados_completos, 2);
  assert.deepEqual(pre.preflight_trial_vendedor.colunas_ja_existem, {});

  const before = await run(`SELECT id, name, cpf, cnpj, pix_key, postal_code FROM b2b_responsibles ORDER BY id`);

  await pg.exec(sqlFile("26b_trial_vendedor.sql"));
  await pg.exec(sqlFile("26b_trial_vendedor.sql"));

  const after = await run(`SELECT id, name, cpf, cnpj, pix_key, postal_code FROM b2b_responsibles ORDER BY id`);
  assert.deepEqual(after, before); // nenhum dado existente mudou

  const completed = await run(`SELECT id FROM b2b_responsibles WHERE profile_completed_at IS NOT NULL ORDER BY id`);
  assert.deepEqual(completed.map((row) => row.id), [V_DONE, V_LEGACY]); // o sem Pix e o de teste ficam de fora
  assert.equal((await run(`SELECT count(*)::int AS total FROM b2b_responsibles WHERE trial_ends_at IS NOT NULL`))[0].total, 0);
});

test("acesso no banco: em teste, vencido, completo e cadastro antigo; sem as colunas ninguém é bloqueado", async () => {
  const signup = new Date("2026-10-05T15:00:00Z");
  await run(`UPDATE b2b_responsibles SET trial_ends_at = $2 WHERE id = $1`, [V_TRIAL, trialEndsFrom(signup).toISOString()]);

  assert.equal((await loadVendorAccess(run, V_TRIAL, new Date(signup.getTime() + 2 * DAY))).state, "trial");
  assert.equal((await loadVendorAccess(run, V_TRIAL, new Date(signup.getTime() + 8 * DAY))).state, "expired"); // 8º dia
  assert.equal((await loadVendorAccess(run, V_DONE, new Date(signup.getTime() + 30 * DAY))).state, "complete");
  assert.equal((await loadVendorAccess(run, V_LEGACY)).state, "complete");

  const empty = new PGlite();
  const emptyRun = async (text, params = []) => (await empty.query(text, params)).rows;
  assert.equal((await loadVendorAccess(emptyRun, V_TRIAL)).state, "complete");
  await empty.close();

  assert.equal(adminSituation({ trialEndsAt: trialEndsFrom(signup), profileCompletedAt: null }, signup), "Em teste até 12/10");
  assert.equal(adminSituation({ trialEndsAt: trialEndsFrom(signup), profileCompletedAt: null }, new Date(signup.getTime() + 9 * DAY)), "Teste vencido");
  assert.equal(adminSituation({ trialEndsAt: null, profileCompletedAt: signup }, signup), "Cadastro completo");
});

test("estender o teste (+7 dias): só em teste, a partir do maior entre hoje e o fim; cadastro completo recusa", async () => {
  const extend = `UPDATE b2b_responsibles
      SET trial_ends_at = greatest((now() AT TIME ZONE 'UTC'), coalesce(trial_ends_at, (now() AT TIME ZONE 'UTC'))) + interval '7 days'
    WHERE id = $1 AND profile_completed_at IS NULL AND trial_ends_at IS NOT NULL
    RETURNING trial_ends_at`;

  await run(`UPDATE b2b_responsibles SET trial_ends_at = (now() AT TIME ZONE 'UTC') - interval '3 days' WHERE id = $1`, [V_TRIAL]); // vencido
  const [extended] = await run(extend, [V_TRIAL]);
  assert.ok(extended.trial_ends_at.getTime() > Date.now()); // voltou a valer
  assert.equal((await run(extend, [V_DONE])).length, 0); // completo: nada a estender
  // O código do admin usa exatamente esta regra.
  assert.match(src("app/api/admin/b2b/responsibles/[id]/route.ts"), /profile_completed_at IS NULL AND trial_ends_at IS NOT NULL/);
});

let seq = 100;
async function paidOrder(vendor) {
  const id = UUID(++seq);
  await run(
    `INSERT INTO orders (id, status, payment_method, total_cents, shipping_cents, b2b_responsible_id, b2b_responsible_name, b2b_client_id, b2b_offer_id, created_at)
     VALUES ($1,'paid','pix',10000,0,$2,'V',$3,$4,'2026-10-05 12:00:00')`,
    [id, vendor, CLIENT, OFFER]
  );
  await run(`INSERT INTO order_items (order_id, product_id, qty, unit_price_cents, commission_base_percent, commission_extra_percent, commission_total_percent) VALUES ($1,$2,1,10000,10,15,25)`, [id, PRODUCT]);
  await run(`INSERT INTO payments (order_id, status, created_at) VALUES ($1,'paid','2026-10-05 12:10:00')`, [id]);
  return id;
}

test("COMISSÃO: acumula normalmente mas fica RETIDA até completar o cadastro; ao completar, libera", async () => {
  await run(`UPDATE b2b_responsibles SET trial_ends_at = (now() AT TIME ZONE 'UTC') + interval '3 days', profile_completed_at = NULL WHERE id = $1`, [V_TRIAL]);
  const retained = await paidOrder(V_TRIAL);
  const free = await paidOrder(V_DONE);

  let rows = await loadCommissionRows(run, {});
  assert.equal(rows.find((row) => row.orderId === retained).state, "retida"); // acumulou (2.500), mas retida
  assert.equal(rows.find((row) => row.orderId === retained).commissionCents, 2500);
  assert.equal(rows.find((row) => row.orderId === free).state, "a_receber"); // vendedor completo: normal

  const totals = totalsFor(rows.filter((row) => row.responsibleId === V_TRIAL), new Date("2026-10-20T12:00:00Z"));
  assert.equal(totals.heldCents, 2500);
  assert.equal(totals.nextTenthCents, 0);

  assert.deepEqual([...(await loadCompletedVendorIds(run, [V_TRIAL, V_DONE]))], [V_DONE]);

  // Completa o cadastro: libera na hora (mesma comissão, agora "a receber").
  await run(`UPDATE b2b_responsibles SET profile_completed_at = now() WHERE id = $1`, [V_TRIAL]);
  rows = await loadCommissionRows(run, {});
  const released = rows.find((row) => row.orderId === retained);
  assert.equal(released.state, "a_receber");
  assert.equal(released.commissionCents, 2500);
  assert.equal(released.payableOn.toISOString().slice(0, 10), "2026-11-10");
});

test("o admin NÃO consegue marcar como paga a comissão de vendedor sem cadastro completo", () => {
  const route = src("app/api/admin/b2b/commissions/route.ts");
  assert.match(route, /loadCompletedVendorIds/);
  assert.match(route, /Comissão retida: o vendedor ainda não completou o cadastro/);
  // A checagem vem ANTES de gravar o pagamento.
  assert.ok(route.indexOf("Comissão retida") < route.indexOf("INSERT INTO b2b_commission_payouts"));
});

test("depois do bloqueio: painel só mostra o cadastro, mas links dos clientes e pedidos seguem funcionando", () => {
  // Painel: rotas e páginas do vendedor passam por requireResponsible (nega no teste vencido).
  const guard = src("lib/b2b/require-responsible.ts");
  assert.match(guard, /access\.state === "expired" \? null : responsible/);
  assert.match(guard, /export async function requireResponsibleAnyState/);
  // Cadastro completo usa o guard que NÃO bloqueia (senão ninguém sairia do bloqueio).
  assert.match(src("app/api/b2b/profile/complete/route.ts"), /requireResponsibleAnyState/);
  // Layout: no teste vencido renderiza só o formulário, sem os children.
  assert.match(src("app/b2b/painel/layout.tsx"), /access\.state === "expired" \? \(\s*<CompleteProfileForm[\s\S]*?\) : \(\s*children/);

  // Link do cliente e pedidos: só exigem vendedor ativo (status), nunca o teste/cadastro.
  for (const rel of ["lib/b2b/public-offer-context.ts", "app/api/b2b/orders/create/route.ts", "lib/b2b/quote.ts", "lib/order-tracking.ts"]) {
    const source = src(rel);
    assert.equal(/vendor-profile|trial_ends_at|trialEndsAt|profile_completed|requireResponsible/.test(source), false, rel);
  }
  assert.match(src("lib/b2b/public-offer-context.ts"), /responsible\.status !== "active"/);
});

test("cadastro rápido já entra: cria a sessão, define trial_ends_at e o convite vira 'aceito' (API)", () => {
  const accept = src("app/api/b2b/invites/accept/route.ts");
  assert.match(accept, /trialEndsAt: trialEndsFrom\(now\)/);
  assert.match(accept, /createB2BResponsibleSession\(created\.id\)/);
  assert.match(accept, /parseQuickSignup/);
  // O formulário do convite só tem os 4 campos.
  const form = src("app/b2b/convite/[token]/InviteForm.tsx");
  for (const field of ['placeholder="Nome"', 'placeholder="WhatsApp com DDD"', 'placeholder="E-mail"', "Senha (mínimo 8 caracteres)"]) {
    assert.ok(form.includes(field), field);
  }
  assert.equal(/CPF|CNPJ|Chave Pix|Termo/.test(form), false); // nada do cadastro completo no convite
});

test("27a/27b: vendedor ANTIGO incompleto ganha teste de 7 dias (data do SQL); completos e quem já tem prazo não mudam; idempotente", async () => {
  await pg.exec(`ALTER TABLE b2b_responsibles ADD COLUMN IF NOT EXISTS type text`);
  await run(`UPDATE b2b_responsibles SET trial_ends_at = NULL, profile_completed_at = NULL WHERE id = $1`, [V_INCOMPLETE_OLD]);
  const snapshot = await run(`SELECT id, trial_ends_at, profile_completed_at FROM b2b_responsibles WHERE id <> $1 ORDER BY id`, [V_INCOMPLETE_OLD]);

  const [pre] = await run(sqlFile("27a_trial_vendedores_antigos_preflight_one_shot.sql"));
  assert.deepEqual(pre.preflight_trial_antigos.receberiam_prazo.map((row) => row.id), [V_INCOMPLETE_OLD]);
  assert.equal(pre.preflight_trial_antigos.receberiam_prazo[0].tem_pix, false);

  await pg.exec(sqlFile("27b_trial_vendedores_antigos.sql"));
  const [first] = await run(`SELECT trial_ends_at FROM b2b_responsibles WHERE id = $1`, [V_INCOMPLETE_OLD]);
  const [{ d }] = await run(`SELECT extract(epoch FROM (trial_ends_at - (now() AT TIME ZONE 'UTC'))) / 86400 AS d FROM b2b_responsibles WHERE id = $1`, [V_INCOMPLETE_OLD]);
  const days = Number(d);
  assert.ok(days > 6.9 && days < 7.1, `esperado ~7 dias, veio ${days}`);

  await new Promise((resolve) => setTimeout(resolve, 20));
  await pg.exec(sqlFile("27b_trial_vendedores_antigos.sql")); // idempotente: não renova o prazo
  const [second] = await run(`SELECT trial_ends_at FROM b2b_responsibles WHERE id = $1`, [V_INCOMPLETE_OLD]);
  assert.equal(second.trial_ends_at.getTime(), first.trial_ends_at.getTime());

  const others = await run(`SELECT id, trial_ends_at, profile_completed_at FROM b2b_responsibles WHERE id <> $1 ORDER BY id`, [V_INCOMPLETE_OLD]);
  assert.deepEqual(others, snapshot); // completos e quem já tinha prazo ficaram iguais

  // Agora o antigo incompleto está em teste e a comissão dele fica retida.
  assert.equal((await loadVendorAccess(run, V_INCOMPLETE_OLD)).state, "trial");
  const orderId = await paidOrder(V_INCOMPLETE_OLD);
  const rows = await loadCommissionRows(run, {});
  assert.equal(rows.find((row) => row.orderId === orderId).state, "retida");
});

test("Termo RCA: texto das seções 1 a 10 num quadro rolável só para RCA; versão rca-2026-10 em um único arquivo", async () => {
  const terms = await import("../src/lib/b2b/rca-terms.ts");

  assert.equal(terms.RCA_TERMS_VERSION, "rca-2026-10");
  assert.deepEqual(terms.RCA_TERMS_SECTIONS.map((section) => section.title.split(".")[0]), ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);

  const all = JSON.stringify(terms.RCA_TERMS_SECTIONS);
  for (const trecho of ["Pharma e Natural Distribuidora Ltda.", "Lei nº 4.886/1965", "Lei nº 13.709/2018 (LGPD)", "Pedido mínimo", "R$ 250,00", "28/42/56 dias", "chargeback", "Aceite eletrônico"]) {
    assert.ok(all.includes(trecho), trecho);
  }
  assert.equal(terms.RCA_TERMS_ACCEPT_LABEL, "Li e aceito os termos de representação");

  // Versão em UM lugar: nenhum outro arquivo define o literal, e o aceite grava a mesma constante.
  const files = ["lib/b2b/vendor-profile.ts", "app/api/b2b/profile/complete/route.ts", "app/api/b2b/invites/accept/route.ts", "components/b2b/CompleteProfileForm.tsx", "components/b2b/RcaTermsBox.tsx"];
  for (const rel of files) assert.equal(src(rel).includes('"rca-2026-10"'), false, rel);
  assert.match(src("lib/b2b/vendor-profile.ts"), /export \{ RCA_TERMS_VERSION \} from "@\/lib\/b2b\/rca-terms"/);
  assert.match(src("app/api/b2b/profile/complete/route.ts"), /rcaTermsVersion: RCA_TERMS_VERSION/);

  // Só para RCA, acima da caixa de aceite.
  const form = src("components/b2b/CompleteProfileForm.tsx");
  assert.match(form, /requiresRcaTerms && \(/);
  assert.ok(form.indexOf("<RcaTermsBox />") < form.indexOf("RCA_TERMS_ACCEPT_LABEL}"));
  assert.match(src("components/b2b/RcaTermsBox.tsx"), /max-h-72 overflow-y-auto/);
});

// ---------------------------------------------------------------------------
// Bug do cadastro rápido: "e-mail já em uso ou o SQL 26b não foi aplicado" mascarava a causa real
// ---------------------------------------------------------------------------
const { describeSignupError, findVendorByEmail, insertWithNotNullFallback, pgErrorInfo } = await import("../src/lib/b2b/signup-errors.ts");

const pgError = (fields) => Object.assign(new Error(fields.message ?? "erro"), fields);

test("erro REAL do Postgres vira mensagem com a causa (inclusive embrulhado pelo drizzle em `cause`)", () => {
  const unique = pgErrorInfo(new Error("Failed query", { cause: pgError({ code: "23505", constraint: "b2b_responsibles_email_unique", detail: "Key (email)=(a@b.com) already exists." }) }));
  assert.equal(unique.code, "23505");
  assert.match(describeSignupError(unique), /e-mail já está cadastrado para outro vendedor/);

  const notNull = pgErrorInfo(pgError({ code: "23502", column: "pix_key", message: 'null value in column "pix_key"' }));
  assert.match(describeSignupError(notNull), /exige o campo "pix_key".*SQL 28b/);

  assert.match(describeSignupError(pgErrorInfo(pgError({ code: "42703", message: 'column "trial_ends_at" does not exist' }))), /SQL 26b/);
  assert.match(describeSignupError(pgErrorInfo(pgError({ code: "23505", constraint: "b2b_responsibles_invite_id_unique" }))), /convite já foi usado/);
  assert.match(describeSignupError(pgErrorInfo(new Error("timeout"))), /registrado/); // erro desconhecido: não inventa causa
});

test("coluna legada NOT NULL: o cadastro repete preenchendo só o que o banco exige (e registra cada tentativa)", async () => {
  const calls = [];
  const seen = [];
  const insert = async (values) => {
    calls.push({ ...values });
    for (const column of ["cpf", "pix_key"]) {
      const key = column === "cpf" ? "cpf" : "pixKey";
      if (!(key in values)) throw pgError({ code: "23502", column });
    }
    return [{ id: "novo" }];
  };

  const result = await insertWithNotNullFallback(insert, { name: "Maria" }, new Map([["cpf", "cpf"], ["pix_key", "pixKey"]]), (info) => seen.push(info.column));
  assert.deepEqual(result, [{ id: "novo" }]);
  assert.deepEqual(seen, ["cpf", "pix_key"]);
  assert.equal(calls.at(-1).cpf, "");
  assert.equal(calls.at(-1).name, "Maria");

  // Erro que não é NOT NULL passa direto (sem repetir).
  let attempts = 0;
  await assert.rejects(insertWithNotNullFallback(async () => { attempts++; throw pgError({ code: "23505", constraint: "x" }); }, {}, new Map()));
  assert.equal(attempts, 1);
});

test("banco com colunas legadas NOT NULL: 28a mostra quais, o cadastro rápido falha antes do 28b e funciona depois (idempotente)", async () => {
  const legacy = new PGlite();
  const legacyRun = async (text, params = []) => (await legacy.query(text, params)).rows;
  await legacy.exec(`
    CREATE TABLE b2b_responsibles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invite_id uuid UNIQUE, type text NOT NULL, status text NOT NULL DEFAULT 'pending',
      name text NOT NULL, email text NOT NULL UNIQUE, phone text, login text, password_hash text,
      cpf text NOT NULL, pix_key text NOT NULL, postal_code text NOT NULL, company_approved_at timestamp,
      trial_ends_at timestamp, profile_completed_at timestamp, created_at timestamp DEFAULT now());
  `);

  const quick = `INSERT INTO b2b_responsibles (type, status, name, email, phone, login, password_hash, company_approved_at, trial_ends_at)
                 VALUES ('rca', 'active', 'Maria', $1, '21999991234', $1, 'hash', now(), (now() AT TIME ZONE 'UTC') + interval '7 days')`;

  await assert.rejects(legacyRun(quick, ["maria@teste.com"]), (error) => pgErrorInfo(error).code === "23502");

  const [diag] = await legacyRun(sqlFile("28a_diagnostico_cadastro_rapido_one_shot.sql"));
  assert.deepEqual(diag.diagnostico_cadastro_rapido.colunas_not_null_sem_default_que_o_cadastro_rapido_nao_envia, ["cpf", "pix_key", "postal_code"]);

  await legacy.exec(sqlFile("28b_vendedor_colunas_opcionais.sql"));
  await legacy.exec(sqlFile("28b_vendedor_colunas_opcionais.sql")); // idempotente

  const [after] = await legacyRun(sqlFile("28a_diagnostico_cadastro_rapido_one_shot.sql"));
  assert.deepEqual(after.diagnostico_cadastro_rapido.colunas_not_null_sem_default_que_o_cadastro_rapido_nao_envia, []);

  // Convite novo → cadastro rápido → entra com o banner de 7 dias.
  await legacyRun(quick, ["maria@teste.com"]);
  const access = await loadVendorAccess(legacyRun, (await legacyRun(`SELECT id FROM b2b_responsibles WHERE email = 'maria@teste.com'`))[0].id);
  assert.equal(access.state, "trial");
  assert.equal(access.daysLeft, 7);
  assert.match(bannerText(access), /^Período de teste: faltam 7 dias/);

  // Convite com e-mail de OUTRO vendedor → mensagem clara (a checagem acha o dono do e-mail).
  const owner = await findVendorByEmail(legacyRun, "Maria@Teste.com");
  assert.equal(owner.name, "Maria");
  assert.equal(await findVendorByEmail(legacyRun, "livre@teste.com"), null);
  await legacy.close();
});

test("a rota de cadastro rápido: não cria vendedor no convite, avisa e-mail de outro vendedor e registra o erro real", () => {
  const accept = src("app/api/b2b/invites/accept/route.ts");
  assert.match(accept, /findVendorByEmail/);
  assert.match(accept, /Este e-mail já está cadastrado para outro vendedor/);
  assert.match(accept, /describeSignupError\(info\)/);
  assert.match(accept, /console\.error\("\[b2b\/invites\/accept\] insert rápido falhou", \{ inviteId: invite\.id, \.\.\.info \}/);
  assert.equal(accept.includes("SQL 26b não foi aplicado)."), false); // a mensagem genérica que escondia a causa saiu

  // O convite só cria o convite: nenhum insert em b2b_responsibles fora do cadastro.
  assert.equal(/insert\(b2bResponsibles\)/.test(src("lib/b2b/invites.ts")), false);
  assert.equal(/INSERT INTO b2b_responsibles/i.test(src("app/api/admin/b2b/invites/route.ts")), false);
});
