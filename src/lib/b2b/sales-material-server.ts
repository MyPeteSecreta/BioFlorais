/**
 * Geração, no servidor, do PDF de venda do vendedor logado. A versão LOJISTA sai carimbada com nome, WhatsApp e QR do link pessoal
 * (link de captação /parceiros?v=<código>); a REPRESENTANTE (uso interno) sai como está. Os PDFs-base são lidos de
 * `src/lib/b2b/materiais/bio/` (fora de /public).
 */

import fs from "node:fs";
import path from "node:path";

import QRCode from "qrcode";

import { loadDemoState } from "@/lib/b2b/demo";
import type { SqlRunner } from "@/lib/b2b/ownership";
import { ensureReferralCode, partnersPath } from "@/lib/b2b/partners";
import { QR_OPTIONS } from "@/lib/b2b/qr-options";
import { stampSellerOnLastPage } from "@/lib/b2b/sales-material-stamp";
import { MATERIALS_DIR, downloadFileName, findMaterial, formatWhatsApp, type MaterialAudience } from "@/lib/b2b/sales-materials";
import { getSiteUrl } from "@/lib/seo/site-url";

export type SalesMaterialResult =
  | { ok: true; bytes: Uint8Array; fileName: string }
  | { ok: false; status: number; error: string };

export async function buildSalesMaterial(run: SqlRunner, input: { responsibleId: string; materialId: string; audience: MaterialAudience }): Promise<SalesMaterialResult> {
  const material = findMaterial(input.materialId);

  if (!material) return { ok: false, status: 404, error: "Material não encontrado." };

  const baseFile = material.files[input.audience];

  if (!baseFile) return { ok: false, status: 404, error: "Este material é só de uso interno (versão representante)." };

  // turbopackIgnore: o caminho é dinâmico; os PDFs entram no pacote por outputFileTracingIncludes (next.config.ts).
  const absolute = path.join(/*turbopackIgnore: true*/ process.cwd(), MATERIALS_DIR, baseFile);

  if (!fs.existsSync(absolute)) return { ok: false, status: 404, error: "Arquivo do material indisponível." };

  const base = new Uint8Array(fs.readFileSync(absolute));

  // Versão REPRESENTANTE: uso interno, sem carimbo.
  if (input.audience === "representante") return { ok: true, bytes: base, fileName: baseFile };

  const [seller] = await run(`SELECT id, name, phone FROM b2b_responsibles WHERE id = $1::uuid AND status = 'active' LIMIT 1`, [input.responsibleId]);

  if (!seller) return { ok: false, status: 403, error: "Vendedor não encontrado." };

  // Demonstração não tem link de captação (não recebe lojistas reais): o PDF carimbado só existe para vendedor real.
  const demo = await loadDemoState(run, input.responsibleId);

  if (demo.isDemo) return { ok: false, status: 403, error: "Na demonstração não há link pessoal: o PDF para encaminhar fica disponível depois do cadastro." };

  const code = await ensureReferralCode(run, input.responsibleId);

  if (!code) return { ok: false, status: 503, error: "Não foi possível gerar o seu link pessoal agora. Tente novamente em instantes." };

  const url = `${getSiteUrl()}${partnersPath(code)}`;
  const qrPng = await QRCode.toBuffer(url, { ...QR_OPTIONS, type: "png" });
  const name = String(seller.name ?? "").replace(/\s+/g, " ").trim();
  const bytes = await stampSellerOnLastPage(base, { name, whatsapp: formatWhatsApp(seller.phone), qrPng: new Uint8Array(qrPng) });

  return { ok: true, bytes, fileName: downloadFileName(baseFile, name) };
}
