/*
 * Rodada 19b — Admin → Clientes: buscar e editar o cadastro (nome/razão social, CNPJ/CPF validado, e-mail, WhatsApp,
 * endereço), registrando quem alterou e quando, sem apagar (SQL 47a/47b).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const edit = await import("../src/lib/b2b/client-edit.ts");
const admin = await import("../src/lib/b2b/client-admin.ts");

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const CNPJ = "11222333000181"; // válido
const CPF = "52998224725"; // válido
const A = "30000000-0000-4000-8000-00000000000a";
const B = "30000000-0000-4000-8000-00000000000b";

const form = (over = {}) => ({
  changedBy: "Luis",
  displayName: "Loja Flor de Lis Ltda",
  contactName: "Maria",
  document: "11.222.333/0001-81",
  email: "Loja@Exemplo.com",
  phone: "(11) 91234-5678",
  postalCode: "01310-100",
  street: "Av. Paulista",
  addressNumber: "1000",
  addressComplement: "Sala 12",
  neighborhood: "Bela Vista",
  city: "São Paulo",
  state: "sp",
  ...over,
});

test("validação: nome, CNPJ/CPF com dígito verificador, e-mail, WhatsApp, CEP, UF e complemento; quem alterou é obrigatório", () => {
  const ok = edit.parseClientEdit(form());
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.values, {
    displayName: "Loja Flor de Lis Ltda",
    contactName: "Maria",
    document: CNPJ,
    email: "loja@exemplo.com",
    phone: "11912345678",
    postalCode: "01310100",
    street: "Av. Paulista",
    addressNumber: "1000",
    addressComplement: "Sala 12",
    neighborhood: "Bela Vista",
    city: "São Paulo",
    state: "SP",
  });
  assert.equal(edit.parseClientEdit(form({ document: "52998224725" })).values.document, CPF);
  assert.equal(edit.parseClientEdit(form({ document: "" })).values.document, null, "documento vazio é permitido (cadastro antigo)");

  const bad = (over, field) => {
    const result = edit.parseClientEdit(form(over));
    assert.equal(result.ok, false, JSON.stringify(over));
    assert.equal(result.field, field);
    return result.error;
  };
  bad({ changedBy: "" }, "changedBy");
  bad({ displayName: "A" }, "displayName");
  assert.match(bad({ document: "11.222.333/0001-82" }, "document"), /CNPJ inválido/);
  assert.match(bad({ document: "529.982.247-26" }, "document"), /CPF inválido/);
  bad({ document: "123" }, "document");
  bad({ email: "sem-arroba" }, "email");
  bad({ phone: "123" }, "phone");
  bad({ postalCode: "123" }, "postalCode");
  bad({ state: "SPP" }, "state");
  assert.match(
    bad({ addressComplement: "Deixar com o porteiro e ligar antes de chegar porque a campainha não funciona" }, "addressComplement"),
    /Observações/
  );
});

test("diff: só o que mudou, com antes e depois; nada mudou = vazio", () => {
  const current = { ...edit.parseClientEdit(form()).values };
  assert.deepEqual(edit.diffClient(current, current), {});
  const next = { ...current, email: "novo@exemplo.com", phone: null };
  const changes = edit.diffClient(current, next);
  assert.deepEqual(Object.keys(changes).sort(), ["email", "phone"]);
  assert.deepEqual(changes.email, { before: "loja@exemplo.com", after: "novo@exemplo.com" });
  assert.deepEqual(edit.describeChanges(changes).sort(), ["E-mail: loja@exemplo.com → novo@exemplo.com", "WhatsApp: 11912345678 → (vazio)"]);
  assert.equal(edit.diffClient({ city: "" }, { ...current, city: null }).city, undefined, "vazio e null são iguais");
});

async function seed() {
  const pg = new PGlite();
  await pg.exec(`
    CREATE TABLE b2b_responsibles (id uuid PRIMARY KEY, name text);
    CREATE TABLE b2b_clients (id uuid PRIMARY KEY, display_name text NOT NULL, contact_name text, email text, phone text, active boolean DEFAULT true,
      created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now(), archived_at timestamp);
    CREATE TABLE b2b_client_relationships (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_id uuid, responsible_id uuid, active boolean DEFAULT true, linked_at timestamp DEFAULT now(), unlinked_at timestamp);
    INSERT INTO b2b_responsibles VALUES ('40000000-0000-4000-8000-000000000001', 'Vendedora Ana');
    INSERT INTO b2b_clients (id, display_name, phone, email) VALUES ('${A}', 'Loja Flor de Lis', '11999990000', 'a@x.com'), ('${B}', 'Pet Shop Rex', '21988887777', 'b@x.com');
    INSERT INTO b2b_client_relationships (client_id, responsible_id) VALUES ('${A}', '40000000-0000-4000-8000-000000000001');`);
  const run = async (text, params = []) => (await pg.query(text, params)).rows;
  return { pg, run };
}

test("antes do 47b: a lista e a busca já funcionam (colunas opcionais por to_jsonb); editar pede o SQL 47b", async () => {
  const { run } = await seed();
  const all = await admin.searchClients(run, "");
  assert.equal(all.length, 2);
  assert.equal(all.find((c) => c.id === A).responsible, "Vendedora Ana");
  assert.equal((await admin.searchClients(run, "rex"))[0].displayName, "Pet Shop Rex");
  assert.equal((await admin.searchClients(run, "(21) 98888")).length, 1, "busca por WhatsApp (dígitos)");

  const result = await admin.updateClient(run, A, edit.parseClientEdit(form()).values, "Luis");
  assert.equal(result.ok, false);
  assert.match(result.error, /SQL 47b/);
});

test("47b + edição: grava só o que mudou, registra quem/quando/antes-depois, atômico; não apaga; recusa documento repetido", async () => {
  const { pg, run } = await seed();
  await pg.exec(read("sql/b2b/47b_clientes_edicao.sql"));
  await pg.exec(read("sql/b2b/47b_clientes_edicao.sql"));

  const values = edit.parseClientEdit(form()).values;
  const first = await admin.updateClient(run, A, values, "Luis");
  assert.equal(first.ok, true);
  assert.equal(first.changed, true);
  assert.equal(first.client.document, CNPJ);
  assert.equal(first.client.postalCode, "01310100");
  assert.equal(first.client.state, "SP");
  assert.equal(first.client.displayName, "Loja Flor de Lis Ltda");

  const edits = await admin.listClientEdits(run, A);
  assert.equal(edits.length, 1);
  assert.equal(edits[0].changedBy, "Luis");
  assert.ok(edits[0].changes.some((line) => line.startsWith("Nome / razão social: Loja Flor de Lis → Loja Flor de Lis Ltda")));
  assert.ok(edits[0].changes.some((line) => line.startsWith("CNPJ/CPF: (vazio) → 11222333000181")));
  assert.ok(Date.parse(edits[0].changedAt) > 0);

  // nada mudou: nenhum histórico novo
  const same = await admin.updateClient(run, A, values, "Luis");
  assert.equal(same.ok && same.changed, false);
  assert.equal((await admin.listClientEdits(run, A)).length, 1);

  // segunda edição por outra pessoa: só o e-mail
  const second = await admin.updateClient(run, A, { ...values, email: "novo@exemplo.com" }, "Maria (financeiro)");
  assert.equal(second.ok && second.changed, true);
  const history = await admin.listClientEdits(run, A);
  assert.equal(history.length, 2);
  assert.equal(history[0].changedBy, "Maria (financeiro)");
  assert.deepEqual(history[0].changes, ["E-mail: loja@exemplo.com → novo@exemplo.com"]);

  // documento do outro cliente é recusado (409) e nada é gravado
  const clash = await admin.updateClient(run, B, { ...edit.parseClientEdit(form({ displayName: "Pet Shop Rex" })).values }, "Luis");
  assert.equal(clash.ok, false);
  assert.equal(clash.status, 409);
  assert.match(clash.error, /já está no cadastro de “Loja Flor de Lis Ltda”/);
  assert.equal((await admin.listClientEdits(run, B)).length, 0);

  // busca pelo CNPJ e pela cidade; nunca apagou ninguém
  assert.equal((await admin.searchClients(run, "11.222.333/0001-81"))[0].id, A);
  assert.equal((await admin.searchClients(run, "São Paulo"))[0].id, A);
  assert.equal((await admin.searchClients(run, "")).length, 2);
  assert.equal((await admin.updateClient(run, "30000000-0000-4000-8000-0000000000ff", values, "Luis")).status, 404);
});

test("47a/47b: aditivo, idempotente, linha final ok; conferência antes e depois", async () => {
  const pg = new PGlite();
  await pg.exec(`CREATE TABLE b2b_clients (id uuid PRIMARY KEY, display_name text); INSERT INTO b2b_clients VALUES ('${A}', 'Loja');`);
  const conf = read("sql/b2b/47a_clientes_edicao_conferencia_one_shot.sql");
  const before = (await pg.query(conf)).rows[0].conferencia_clientes_edicao;
  assert.equal(before.colunas_cadastro_existentes, 0);
  assert.equal(before.tabela_historico_existe, false);
  assert.equal(before.clientes, 1);

  const sql = read("sql/b2b/47b_clientes_edicao.sql");
  assert.ok(/BEGIN;/.test(sql) && /COMMIT;/.test(sql) && /SELECT 'ok' AS resultado;\s*$/.test(sql));
  assert.ok(!/\b(DROP|DELETE|TRUNCATE|UPDATE)\b/i.test(sql.replace(/--.*$/gm, "")));
  assert.equal((await pg.exec(sql)).at(-1).rows[0].resultado, "ok");
  await pg.exec(sql);
  const after = (await pg.query(conf)).rows[0].conferencia_clientes_edicao;
  assert.equal(after.colunas_cadastro_existentes, after.colunas_cadastro_esperadas);
  assert.equal(after.tabela_historico_existe, true);
  assert.equal(after.clientes, 1);
  assert.ok(!/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\b/i.test(conf.replace(/--.*$/gm, "")), "conferência é só leitura");
});

test("ligações: aba Clientes no admin, rotas só para admin, sem apagar", () => {
  const tabs = read("src/components/admin/b2b/AdminB2BTabs.tsx");
  assert.ok(tabs.includes('{ id: "clients", label: "Clientes" }') && tabs.includes("<ClientsTab />"));
  for (const file of ["src/app/api/admin/b2b/clients/route.ts", "src/app/api/admin/b2b/clients/[id]/route.ts"]) {
    const source = read(file);
    assert.ok(source.includes("isAdminRequest(request)"), file);
    assert.ok(!/export async function (DELETE|POST)/.test(source), `${file}: sem apagar`);
  }
  const lib = read("src/lib/b2b/client-admin.ts");
  assert.ok(!/\bDELETE\b/.test(lib.replace(/\/\*[\s\S]*?\*\//g, "")), "nenhum DELETE no código");
  const tab = read("src/components/admin/b2b/ClientsTab.tsx");
  assert.ok(tab.includes("Histórico de alterações") && tab.includes("Quem está alterando"));
  assert.ok(!tab.includes("vendor-launch") && !tab.includes("b2b/client-edit"), "tela não importa código de servidor");
});
