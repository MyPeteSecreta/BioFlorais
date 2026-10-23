/*
 * Rodada 20 (a) — cupom GPT10: 10%, só B2C, 1 uso por cliente (e-mail), válido até 30/11/2026 23:59:59 BRT, sem acumular com
 * outro cupom comercial; SQL aditivo (ON CONFLICT DO NOTHING) com conferência antes e depois.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

const COUPONS_TABLE = `
  CREATE TABLE coupons (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE, discount_type text NOT NULL, discount_value integer NOT NULL,
    coupon_type text NOT NULL DEFAULT 'normal', partner_id uuid, scope text NOT NULL DEFAULT 'b2c', discounts_shipping boolean NOT NULL DEFAULT false,
    commission_percent integer NOT NULL DEFAULT 0, min_subtotal_cents integer NOT NULL DEFAULT 0, starts_at timestamp, expires_at timestamp, max_uses integer,
    used_count integer NOT NULL DEFAULT 0, one_per_customer boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT true, created_at timestamp DEFAULT now());
  CREATE TABLE coupon_redemptions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), coupon_id uuid NOT NULL, customer_email text NOT NULL, order_id uuid, discount_cents integer, redeemed_at timestamp DEFAULT now());`;

test("validade: 30/11/2026 23:59:59 em Brasília é 2026-12-01 02:59:59 UTC (coupons.expires_at é timestamp sem fuso em UTC)", () => {
  const expires = new Date("2026-12-01T02:59:59Z");
  const brt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "medium" }).format(expires);
  assert.match(brt, /30\/11\/2026,? 23:59:59/);
  assert.ok(read("sql/b2b/50b_cupom_gpt10.sql").includes("timestamp '2026-12-01 02:59:59'"));
});

test("50a/50b: antes sem cupom; INSERT conforme; idempotente (ON CONFLICT DO NOTHING) e nunca altera um GPT10 existente; linha final ok", async () => {
  const pg = new PGlite();
  await pg.exec(COUPONS_TABLE);
  const conf = read("sql/b2b/50a_cupom_gpt10_conferencia_one_shot.sql");
  const before = (await pg.query(conf)).rows[0].conferencia_cupom_gpt10;
  assert.equal(before.colunas_necessarias_existem, true);
  assert.equal(before.gpt10_existe, false);
  assert.equal(before.gpt10_conforme, false);

  const sql = read("sql/b2b/50b_cupom_gpt10.sql");
  assert.ok(/BEGIN;/.test(sql) && /COMMIT;/.test(sql) && /SELECT 'ok' AS resultado;\s*$/.test(sql));
  assert.ok(/ON CONFLICT \(code\) DO NOTHING/.test(sql));
  assert.ok(!/\b(DROP|DELETE|TRUNCATE|UPDATE|ALTER)\b/i.test(sql.replace(/--.*$/gm, "")), "só INSERT");
  assert.equal((await pg.exec(sql)).at(-1).rows[0].resultado, "ok");

  const after = (await pg.query(conf)).rows[0].conferencia_cupom_gpt10;
  assert.equal(after.gpt10_existe, true);
  assert.equal(after.gpt10_conforme, true);
  assert.equal(after.gpt10.discount_type, "percentage");
  assert.equal(after.gpt10.discount_value, 10);
  assert.equal(after.gpt10.scope, "b2c");
  assert.equal(after.gpt10.coupon_type, "normal");
  assert.equal(after.gpt10.one_per_customer, true);
  assert.equal(after.gpt10.min_subtotal_cents, 0);
  assert.equal(after.gpt10.max_uses, null);
  assert.equal(after.gpt10.expira_em_utc, "2026-12-01 02:59:59");
  assert.equal(after.gpt10.expira_em_brasilia, "30/11/2026 23:59:59");
  assert.equal(after.usos_gpt10, 0);

  // rodar de novo não duplica nem muda
  await pg.exec(sql);
  assert.equal((await pg.query("SELECT count(*)::int AS c FROM coupons WHERE code = 'GPT10'")).rows[0].c, 1);

  // um GPT10 já existente (ex.: editado à mão) NÃO é alterado
  await pg.exec("UPDATE coupons SET discount_value = 15 WHERE code = 'GPT10'");
  await pg.exec(sql);
  assert.equal((await pg.query("SELECT discount_value FROM coupons WHERE code = 'GPT10'")).rows[0].discount_value, 15);
  assert.ok(!/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\b/i.test(conf.replace(/--.*$/gm, "")), "conferência é só leitura");
});

test("regras no código: só B2C, 1 uso por e-mail, validade e um único cupom comercial por pedido; o B2B não aceita o GPT10", () => {
  const b2c = read("src/app/api/orders/create/route.ts");
  assert.ok(b2c.includes('eq(coupons.scope, "b2c")'), "cupom B2C só vale no B2C");
  assert.ok(b2c.includes("coupon.onePerCustomer") && b2c.includes("couponRedemptions.customerEmail"), "1 uso por cliente (e-mail)");
  assert.ok(b2c.includes("coupon.expiresAt < now") && b2c.includes("coupon.startsAt > now"), "validade");
  assert.ok(b2c.includes("coupon.maxUses !== null"));
  const validate = read("src/app/api/coupons/validate/route.ts");
  assert.ok(validate.includes('eq(coupons.scope, "b2c")') && validate.includes("coupon.expiresAt"));
  const checkout = read("src/app/checkout/page.tsx");
  assert.ok(checkout.includes("Já existe um cupom comercial aplicado.") || checkout.includes("J\\u00e1 existe um cupom comercial aplicado."), "um cupom comercial por vez");
  const b2b = read("src/lib/b2b/coupon-resolver.ts");
  assert.ok(/scope/.test(b2b) && /b2b/.test(b2b), "o B2B só aceita cupom de escopo b2b");
});
