/*
 * Rodada 5 / V2: e-mail "preso". Convite revogado/expirado não reserva; editar e-mail/login com
 * checagem de duplicidade; "Desativar e liberar e-mail" sem apagar; mensagem com o nome do dono.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";

const { changeIdentity, describeIdentityConflict, findIdentityConflict, parseIdentityInput, releaseIdentity, releasedMarker, isReleasedEmail } =
  await import("../src/lib/b2b/vendor-identity.ts");

const UUID = (n) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
let pg;
const run = async (text, params = []) => (await pg.query(text, params)).rows;

async function fresh() {
  pg = new PGlite();
  await pg.exec(`
    CREATE TABLE b2b_responsibles (id uuid PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE, login text, status text, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());
    CREATE TABLE b2b_responsible_invites (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text, status text, expires_at timestamp, revoked_at timestamp);
    CREATE TABLE orders (id uuid PRIMARY KEY, b2b_responsible_id uuid);
    INSERT INTO b2b_responsibles (id, name, email, login, status) VALUES
      ('${UUID(1)}', 'Pessoa Errada', 'certa@exemplo.com', 'certa@exemplo.com', 'active'),
      ('${UUID(2)}', 'Beto Ativo', 'beto@exemplo.com', 'beto', 'active'),
      ('${UUID(3)}', 'Carla Inativa', 'carla@exemplo.com', 'carla', 'inactive');
    INSERT INTO orders VALUES ('${UUID(91)}', '${UUID(1)}');
    INSERT INTO b2b_responsible_invites (email, status, expires_at, revoked_at) VALUES
      ('livre@exemplo.com', 'revoked', now(), now()), ('vencido@exemplo.com', 'pending', now() - interval '3 days', NULL);
  `);
  await pg.exec(read("sql/b2b/31b_email_preso.sql"));
}

test("31a/31b: preflight em uma linha JSON, 31b aditivo e idempotente", async () => {
  pg = new PGlite();
  await pg.exec(`CREATE TABLE b2b_responsibles (id uuid PRIMARY KEY, name text, email text, status text, created_at timestamp DEFAULT now());
    CREATE TABLE b2b_responsible_invites (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text, status text, expires_at timestamp);
    INSERT INTO b2b_responsibles (id, name, email, status) VALUES ('${UUID(3)}', 'Carla', 'carla@exemplo.com', 'inactive');`);
  const pre = async () => (await pg.query(read("sql/b2b/31a_email_preso_preflight_one_shot.sql"))).rows;
  const before = await pre();
  assert.equal(before.length, 1);
  assert.equal(before[0].preflight_email_preso.colunas_existem, false);
  assert.equal(before[0].preflight_email_preso.inativos_segurando_email.length, 1);
  const sql = read("sql/b2b/31b_email_preso.sql");
  assert.ok(/BEGIN;/.test(sql) && /COMMIT;/.test(sql) && !/\b(DROP|DELETE|TRUNCATE)\b/i.test(sql.replace(/--.*$/gm, "")));
  await pg.exec(sql);
  await pg.exec(sql);
  assert.equal((await pre())[0].preflight_email_preso.colunas_existem, true);
});

test("convite revogado ou expirado NUNCA reserva e-mail; só vendedor existente ocupa", async () => {
  await fresh();
  assert.equal(await findIdentityConflict(run, { email: "livre@exemplo.com" }), null);
  assert.equal(await findIdentityConflict(run, { email: "vencido@exemplo.com" }), null);
  const c = await findIdentityConflict(run, { email: "BETO@exemplo.com" });
  assert.equal(c.name, "Beto Ativo");
  assert.match(describeIdentityConflict(c), /vendedor ativo Beto Ativo/);
  const inactive = await findIdentityConflict(run, { email: "carla@exemplo.com" });
  assert.match(describeIdentityConflict(inactive), /Carla Inativa \(inativo\).*liberar/);
});

test("editar e-mail/login: valida duplicidade (e-mail ou login de outro), guarda o original e mantém o id", async () => {
  await fresh();
  const bad = await changeIdentity(run, UUID(1), { email: "beto@exemplo.com", login: "novo.login" });
  assert.equal(bad.ok, false);
  assert.equal(bad.conflict.name, "Beto Ativo");
  const badLogin = await changeIdentity(run, UUID(1), { email: "outra@exemplo.com", login: "beto" });
  assert.equal(badLogin.conflict.field, "login");
  // o próprio registro pode manter o mesmo valor
  assert.equal((await changeIdentity(run, UUID(1), { email: "certa@exemplo.com", login: "certa@exemplo.com" })).ok, true);

  const ok = await changeIdentity(run, UUID(1), { email: "correta@exemplo.com", login: "correta" });
  assert.equal(ok.ok, true);
  const [row] = await run(`SELECT email, login, email_original, login_original FROM b2b_responsibles WHERE id = $1`, [UUID(1)]);
  assert.deepEqual(row, { email: "correta@exemplo.com", login: "correta", email_original: "certa@exemplo.com", login_original: "certa@exemplo.com" });
  assert.equal((await changeIdentity(run, UUID(99), { email: "x@exemplo.com", login: "xxx" })).notFound, true);
});

test("desativar e liberar e-mail: marcador único, original guardado, nada apagado, e-mail volta a ficar livre", async () => {
  await fresh();
  const result = await releaseIdentity(run, UUID(1));
  assert.deepEqual(result, { ok: true, originalEmail: "certa@exemplo.com" });
  const [row] = await run(`SELECT email, login, status, email_original, released_at IS NOT NULL AS released FROM b2b_responsibles WHERE id = $1`, [UUID(1)]);
  assert.equal(row.email, releasedMarker(UUID(1)));
  assert.equal(row.login, releasedMarker(UUID(1)));
  assert.equal(row.status, "inactive");
  assert.equal(row.email_original, "certa@exemplo.com");
  assert.equal(row.released, true);
  assert.ok(isReleasedEmail(row.email));
  assert.equal((await run(`SELECT count(*)::int AS n FROM b2b_responsibles`))[0].n, 3, "nada apagado");
  assert.equal((await run(`SELECT b2b_responsible_id AS r FROM orders`))[0].r, UUID(1), "pedido segue ligado ao id");
  // a pessoa certa agora pode ser cadastrada com o e-mail
  assert.equal(await findIdentityConflict(run, { email: "certa@exemplo.com" }), null);
  await run(`INSERT INTO b2b_responsibles (id, name, email, login, status) VALUES ($1, 'Pessoa Certa', 'certa@exemplo.com', 'certa@exemplo.com', 'active')`, [UUID(7)]);
  // liberar de novo não perde o original
  await releaseIdentity(run, UUID(1));
  assert.equal((await run(`SELECT email_original FROM b2b_responsibles WHERE id = $1`, [UUID(1)]))[0].email_original, "certa@exemplo.com");
});

test("convite pendente do e-mail liberado é revogado; entrada inválida é recusada", async () => {
  await fresh();
  await run(`INSERT INTO b2b_responsible_invites (email, status, expires_at) VALUES ('certa@exemplo.com', 'pending', now() + interval '3 days')`);
  await releaseIdentity(run, UUID(1));
  assert.equal((await run(`SELECT status FROM b2b_responsible_invites WHERE email = 'certa@exemplo.com'`))[0].status, "revoked");
  assert.equal(parseIdentityInput({ email: "sem-arroba", login: "abc" }).ok, false);
  assert.equal(parseIdentityInput({ email: "a@b.co", login: "x" }).ok, false);
  assert.equal(parseIdentityInput({ email: " A@B.co ", login: "Abc" }).value.email, "a@b.co");
});

test("admin: ações e botões ligados; convite usa a mensagem com o nome do dono", () => {
  const route = read("src/app/api/admin/b2b/responsibles/[id]/route.ts");
  assert.ok(route.includes('case "edit_identity"') && route.includes('case "release_email"'));
  assert.ok(route.indexOf("isAdminRequest") < route.indexOf('case "edit_identity"'));
  const tab = read("src/components/admin/b2b/ResponsiblesTab.tsx");
  assert.ok(tab.includes("Editar e-mail/login") && tab.includes("Desativar e liberar e-mail"));
  const invites = read("src/app/api/admin/b2b/invites/route.ts");
  assert.ok(invites.includes("findIdentityConflict") && invites.includes("describeIdentityConflict"));
});
