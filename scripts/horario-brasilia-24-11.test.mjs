/*
 * 24/11 — HORA DE BRASÍLIA no admin: orders.created_at é `timestamp` sem fuso gravado em UTC; as telas formatavam sem fuso (servidor
 * em UTC) e mostravam 3 h a mais. Agora: telas em America/Sao_Paulo, corte de dia (Vendas por origem, CSV) pelo dia de Brasília.
 * Caso-chave: 23:30 de Brasília = 02:30 UTC do dia seguinte. Nada do que está gravado muda.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

import { formatCsvDateTimeBR, formatDateTimeBR, localTimestampSql, todayBR } from "../src/lib/time-br.ts";
import { loadSalesByOrigin, resolvePeriod } from "../src/lib/sales-by-origin.ts";
import { buildOrdersOriginCsv } from "../src/lib/attribution-server.ts";

const ROOT = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const ORDER = "30000000-0000-4000-8000-000000000001";
const TABLE = `CREATE TABLE orders (id uuid PRIMARY KEY, created_at timestamp NOT NULL DEFAULT now(), status text, payment_method text, total_cents int,
  archived_at timestamp, b2b_offer_id uuid, b2b_client_id uuid, origin text, utm_source text, utm_medium text, utm_campaign text, referrer_domain text,
  utm_content text, utm_term text, gclid text, fbclid text);`;

test("23:30 de Brasília (= 02:30 UTC do dia seguinte): hora, dia e CSV em Brasília", () => {
  const instant = new Date("2026-11-25T02:30:00Z");

  assert.equal(formatCsvDateTimeBR(instant), "2026-11-24 23:30:00");
  assert.equal(formatCsvDateTimeBR("2026-11-25 02:30:00"), "2026-11-24 23:30:00", "texto do banco (timestamp sem fuso) é UTC");
  assert.equal(formatCsvDateTimeBR("2026-11-25T02:30:00.000Z"), "2026-11-24 23:30:00");
  assert.equal(formatCsvDateTimeBR(null), "");
  assert.match(formatDateTimeBR(instant), /24\/11\/2026,? 23:30/);
  assert.equal(todayBR(instant), "2026-11-24", "ainda é dia 24 em Brasília");
  assert.equal(todayBR(new Date("2026-11-25T03:00:00Z")), "2026-11-25", "03:00 UTC = meia-noite de Brasília");
  assert.equal(todayBR(new Date("2026-11-24T02:59:59Z")), "2026-11-23");
  assert.match(localTimestampSql("o.created_at"), /AT TIME ZONE 'UTC'\) AT TIME ZONE 'America\/Sao_Paulo'/);
});

test("Vendas por origem e CSV: o pedido de 23:30 de Brasília entra no dia 24/11 (não no 25/11) e o CSV mostra 23:30", async () => {
  const pg = new PGlite();
  await pg.exec(TABLE);
  // gravado como o banco grava: UTC, sem fuso (23:30 BRT do dia 24 = 02:30 UTC do dia 25)
  await pg.exec(`INSERT INTO orders (id, created_at, status, total_cents, utm_source) VALUES ('${ORDER}', '2026-11-25 02:30:00', 'paid', 5000, 'meta')`);
  await pg.exec(`INSERT INTO orders (id, created_at, status, total_cents) VALUES ('30000000-0000-4000-8000-000000000002', '2026-11-24 02:59:59', 'paid', 1000)`); // 23:59:59 do dia 23 em Brasília
  const run = async (text, params = []) => (await pg.query(text, params)).rows;

  const day24 = await loadSalesByOrigin(run, { from: "2026-11-24", to: "2026-11-24" });
  const day25 = await loadSalesByOrigin(run, { from: "2026-11-25", to: "2026-11-25" });
  const day23 = await loadSalesByOrigin(run, { from: "2026-11-23", to: "2026-11-23" });

  assert.equal(day24.b2c.totals.pedidos, 1);
  assert.equal(day24.b2c.totals.valorPagoCents, 5000);
  assert.equal(day25.b2c.totals.pedidos, 0, "não vaza para o dia seguinte (UTC)");
  assert.equal(day23.b2c.totals.valorPagoCents, 1000, "02:59:59 UTC ainda é dia 23 em Brasília");

  const csv24 = await buildOrdersOriginCsv(run, { from: "2026-11-24", to: "2026-11-24" });
  const csv25 = await buildOrdersOriginCsv(run, { from: "2026-11-25", to: "2026-11-25" });

  assert.ok(csv24.includes(ORDER) && csv24.includes('"2026-11-24 23:30:00"'));
  assert.ok(!csv25.includes(ORDER));

  // período padrão (últimos 30 dias) conta pelo dia de Brasília
  assert.deepEqual(resolvePeriod(null, null, new Date("2026-11-25T02:30:00Z")), { from: "2026-10-26", to: "2026-11-24" });
});

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const file = join(dir, name);
    if (statSync(file).isDirectory()) {
      if (name !== "node_modules" && name !== ".next") walk(file, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.|test-support/.test(file)) out.push(file);
  }
  return out;
}

test("guarda: nenhuma tela formata HORA (hour/minute/timeStyle) sem timeZone", () => {
  const offenders = [];

  for (const file of walk(join(ROOT, "src"))) {
    const text = readFileSync(file, "utf8");
    const re = /(Intl\.DateTimeFormat\(|\.toLocale(?:Date|Time)?String\()/g;
    let match;

    while ((match = re.exec(text))) {
      let depth = 0;
      let end = text.indexOf("(", match.index);

      for (; end < text.length; end++) {
        if (text[end] === "(") depth++;
        else if (text[end] === ")" && --depth === 0) break;
      }

      const call = text.slice(match.index, end + 1);

      if (/timeStyle|hour|minute/.test(call) && !/currency|minimumFractionDigits|maximumFractionDigits/.test(call) && !/timeZone/.test(call)) {
        offenders.push(`${file.slice(ROOT.length)}:${text.slice(0, match.index).split("\n").length}`);
      }
    }
  }

  assert.deepEqual(offenders, []);
});
