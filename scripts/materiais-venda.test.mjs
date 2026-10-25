/*
 * Fase 2 dos PDFs: aba "Materiais de venda" no painel do vendedor. Lista os PDFs da Bio (LOJISTA para encaminhar e REPRESENTANTE
 * "uso interno"); ao baixar a LOJISTA o servidor carimba, na página "Como pedir", nome, WhatsApp e QR do link pessoal do vendedor.
 * Os PDFs-base ficam no repositório (fora de /public).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { PDFDocument, PDFName } from "pdf-lib";
import QRCode from "qrcode";

import { buildSalesMaterial } from "../src/lib/b2b/sales-material-server.ts";
import { STAMP_GEOMETRY, stampRects, stampSellerOnLastPage } from "../src/lib/b2b/sales-material-stamp.ts";
import { MATERIALS_DIR, SALES_MATERIALS, downloadFileName, findMaterial, formatWhatsApp, parseAudience } from "../src/lib/b2b/sales-materials.ts";
import { QR_OPTIONS } from "../src/lib/b2b/qr-options.ts";

const root = new URL("../", import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), "utf8").replace(/\r\n/g, "\n");
const bytes = (rel) => new Uint8Array(readFileSync(new URL(rel, root)));

async function xobjectCount(pdfBytes) {
  const doc = await PDFDocument.load(pdfBytes);
  const pages = doc.getPages();
  const last = pages[pages.length - 1];
  const resources = last.node.Resources();
  const xo = resources?.lookup(PDFName.of("XObject"));

  return { pages: pages.length, xobjects: xo ? xo.keys().length : 0 };
}

test("catálogo: 8 linhas, cada uma com LOJISTA e REPRESENTANTE existentes no repositório, e nada disso em /public", () => {
  assert.equal(SALES_MATERIALS.length, 8);
  assert.equal(new Set(SALES_MATERIALS.map((m) => m.id)).size, 8);

  for (const material of SALES_MATERIALS) {
    assert.match(material.files.lojista, /_LOJISTA\.pdf$/);
    assert.match(material.files.representante, /_REPRESENTANTE\.pdf$/);

    for (const file of Object.values(material.files)) assert.ok(existsSync(new URL(`${MATERIALS_DIR}/${file}`, root)), file);
  }

  assert.equal(readdirSync(new URL(`${MATERIALS_DIR}/`, root)).filter((f) => f.endsWith(".pdf")).length, 16);
  assert.ok(!existsSync(new URL("public/materiais-vendas", root)), "os PDFs não ficam em /public");
  assert.equal(findMaterial("floral-pet").title, "Floral Pet");
  assert.equal(findMaterial("nao-existe"), null);
  assert.equal(parseAudience("lojista"), "lojista");
  assert.equal(parseAudience("x"), null);
});

test("formatação: WhatsApp em (DDD) número e nome de arquivo seguro", () => {
  assert.equal(formatWhatsApp("11999998888"), "(11) 99999-8888");
  assert.equal(formatWhatsApp("+55 (11) 99999-8888"), "(11) 99999-8888");
  assert.equal(formatWhatsApp("1133334444"), "(11) 3333-4444");
  assert.equal(formatWhatsApp("123"), null);
  assert.equal(formatWhatsApp(null), null);
  assert.equal(downloadFileName("Bio_Floral_Adulto_LOJISTA.pdf", "Ana Souza Ávila"), "Bio_Floral_Adulto_LOJISTA_Ana-Souza-Avila.pdf");
  assert.equal(downloadFileName("Bio_Floral_Adulto_LOJISTA.pdf", ""), "Bio_Floral_Adulto_LOJISTA.pdf");
});

test("carimbo: nos 8 PDFs LOJISTA reais, mesma quantidade de páginas e a última ganha o QR do vendedor", async () => {
  const qr = new Uint8Array(await QRCode.toBuffer("https://www.bioflorais.com.br/parceiros?v=ANA123", { ...QR_OPTIONS, type: "png" }));

  for (const material of SALES_MATERIALS) {
    const base = bytes(`${MATERIALS_DIR}/${material.files.lojista}`);
    const before = await xobjectCount(base);
    const stamped = await stampSellerOnLastPage(base, { name: "Ana Souza de Oliveira Lima", whatsapp: "(11) 99999-8888", qrPng: qr });
    const after = await xobjectCount(stamped);

    assert.equal(after.pages, before.pages, material.id);
    assert.equal(after.xobjects, before.xobjects + 1, `${material.id}: o QR do vendedor entra como imagem na última página`);
  }
});

test("carimbo: geometria do espaço reservado (QR à direita, do mesmo tamanho do QR da loja; linha Nome · WhatsApp logo abaixo)", () => {
  const { qr, label } = stampRects(STAMP_GEOMETRY.pageWidthIn * 72);

  assert.ok(Math.abs(qr.size - 2.1 * 72) < 0.01);
  assert.ok(Math.abs(qr.x + qr.size - (8.27 - 0.55) * 72) < 0.01, "alinhado à margem direita");
  assert.ok(label.y > qr.y + qr.size, "a linha do nome fica abaixo do QR");
  assert.ok(Math.abs(label.right - (qr.x + qr.size)) < 0.01);
});

test("download: LOJISTA exige vendedor ativo e link pessoal; sem WhatsApp sai só com nome e QR; demonstração não recebe a lojista; REPRESENTANTE sai sem carimbo", async () => {
  const seller = (phone, isDemo = false) => async (sql) => {
    if (sql.includes("to_jsonb(r) ->> 'is_demo'")) return [{ is_demo: isDemo ? "true" : "false", demo_expires_at: null }];
    if (sql.includes("FROM b2b_responsibles WHERE id = $1::uuid AND status = 'active'")) return [{ id: "x", name: "Ana Souza", phone }];
    if (sql.includes("referral_code")) return [{ referral_code: "ANA123" }];
    return [];
  };

  const ok = await buildSalesMaterial(seller("11999998888"), { responsibleId: "00000000-0000-0000-0000-000000000001", materialId: "floral-adulto", audience: "lojista" });
  assert.ok(ok.ok);
  assert.equal(ok.fileName, "Bio_Floral_Adulto_LOJISTA_Ana-Souza.pdf");
  assert.equal((await xobjectCount(ok.bytes)).pages, 6);

  const noPhone = await buildSalesMaterial(seller(null), { responsibleId: "00000000-0000-0000-0000-000000000001", materialId: "floral-pet", audience: "lojista" });
  assert.ok(noPhone.ok);
  assert.equal((await xobjectCount(noPhone.bytes)).pages, 7, "Floral Pet tem 7 páginas (com o Snack Floral)");

  const demo = await buildSalesMaterial(seller("11999998888", true), { responsibleId: "00000000-0000-0000-0000-000000000001", materialId: "floral-adulto", audience: "lojista" });
  assert.ok(!demo.ok && demo.status === 403);

  const inactive = await buildSalesMaterial(async () => [], { responsibleId: "00000000-0000-0000-0000-000000000001", materialId: "floral-adulto", audience: "lojista" });
  assert.ok(!inactive.ok && inactive.status === 403);

  const missing = await buildSalesMaterial(seller("11999998888"), { responsibleId: "x", materialId: "nao-existe", audience: "lojista" });
  assert.ok(!missing.ok && missing.status === 404);

  // representante: uso interno, exatamente o arquivo-base, sem consultar o banco
  const rep = await buildSalesMaterial(async () => { throw new Error("não deve consultar o banco"); }, { responsibleId: "x", materialId: "floral-adulto", audience: "representante" });
  assert.ok(rep.ok);
  assert.deepEqual(Buffer.from(rep.bytes), readFileSync(new URL(`${MATERIALS_DIR}/Bio_Floral_Adulto_REPRESENTANTE.pdf`, root)));
  assert.equal(rep.fileName, "Bio_Floral_Adulto_REPRESENTANTE.pdf");
});

test("rota e painel: só com sessão do vendedor, versão validada, sem cache; aba no menu; REPRESENTANTE marcada como uso interno", () => {
  const route = read("src/app/api/b2b/materiais/[id]/route.ts");
  assert.ok(route.includes("readB2BResponsibleSession(request.cookies.get(B2B_SESSION_COOKIE)?.value)") && route.includes("status: 401"));
  assert.ok(route.includes('parseAudience(request.nextUrl.searchParams.get("versao"))') && route.includes("status: 400"));
  assert.ok(route.includes('"Cache-Control": "private, no-store"') && route.includes("attachment"));
  assert.ok(route.includes("responsibleId: session.responsibleId"), "o carimbo usa o vendedor da SESSÃO, nunca um id vindo da URL");

  const page = read("src/app/b2b/painel/materiais/page.tsx");
  assert.ok(page.includes("requireResponsiblePage()"));
  assert.ok(page.includes("Baixar versão LOJISTA (para encaminhar)") && page.includes("Baixar versão REPRESENTANTE · uso interno"));
  assert.ok(page.includes("sem WhatsApp") && page.includes("materiais-demo"));
  assert.ok(read("src/app/b2b/painel/layout.tsx").includes('href="/b2b/painel/materiais"') && read("src/app/b2b/painel/layout.tsx").includes("Materiais de venda"));

  // os PDFs-base entram no pacote da função (leitura em tempo de execução)
  assert.ok(read("next.config.ts").includes('"/api/b2b/materiais/[id]": ["./materiais-vendas/**/*"]'));
  // o link pessoal é o de captação do vendedor
  const server = read("src/lib/b2b/sales-material-server.ts");
  assert.ok(server.includes("ensureReferralCode(") && server.includes("partnersPath(code)"));
});
