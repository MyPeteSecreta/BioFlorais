/*
 * Gera public/feeds/meta/<slug>.jpg (800×800, fundo branco, produto centralizado, sem distorção) para os produtos cuja imagem
 * do feed é menor que 500×500 — o mínimo do catálogo da Meta (Luis, 16/11). Só para o meta.csv: as fotos do site e o feed do
 * Google não mudam. Fonte: a mesma foto do feed (a maior disponível no projeto); sem IA.
 * Rodar: node --import ./scripts/register-ts-paths.mjs scripts/gerar-fotos-feed-meta.mjs
 * Imprime a lista das que precisaram ampliar mais de 1,5× (qualidade menor: recriar a foto quando possível).
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

import { bioProducts } from "../src/lib/catalog/bio-products.ts";
import { feedImageFor } from "../src/lib/feeds/items.server.ts";
import { buildFeedItem } from "../src/lib/feeds/products.ts";

const MIN = 500;
const SIZE = 800;
const INNER = 720; // margem branca de 40 px
const MAX_SCALE = 2; // ampliar mais que 2× borra: o produto fica menor no quadro, mas nítido
const OUT_DIR = path.join(process.cwd(), "public", "feeds", "meta");

fs.mkdirSync(OUT_DIR, { recursive: true });

const report = [];

for (const product of bioProducts) {
  const image = feedImageFor(product);
  if (!image || image.startsWith("/feeds/meta/")) continue;
  // Só o que vai ao feed (Rescue, Depressão etc. ficam de fora pelas regras do feed).
  if (!buildFeedItem(product, "https://www.bioflorais.com.br", () => image)) continue;

  const source = path.join(process.cwd(), "public", decodeURI(image));
  const meta = await sharp(source).metadata();
  const out = path.join(OUT_DIR, `${product.slug}.jpg`);

  if (meta.width >= MIN && meta.height >= MIN) {
    if (fs.existsSync(out)) fs.rmSync(out); // a foto do site cresceu: não precisa mais da versão do feed
    continue;
  }

  // Fundo branco e corte das bordas brancas, para o produto ocupar o quadro; se o corte falhar, usa a imagem inteira.
  const flat = await sharp(source).flatten({ background: "#ffffff" }).toBuffer();
  let body = flat;
  try {
    const trimmed = await sharp(flat).trim({ background: "#ffffff", threshold: 12 }).toBuffer();
    const t = await sharp(trimmed).metadata();
    // aceita o corte se sobrou um produto de verdade (não um risco), mesmo estreito
    if (t.width >= 40 && t.height >= 40 && t.width * t.height >= meta.width * meta.height * 0.04) body = trimmed;
  } catch {
    body = flat;
  }

  const b = await sharp(body).metadata();
  const scale = Math.min(INNER / b.width, INNER / b.height, MAX_SCALE);
  const resized = await sharp(body)
    .resize({ width: Math.round(b.width * scale), height: Math.round(b.height * scale), fit: "fill", kernel: "lanczos3" })
    .toBuffer();
  const r = await sharp(resized).metadata();

  await sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: "#ffffff" } })
    .composite([{ input: resized, left: Math.round((SIZE - r.width) / 2), top: Math.round((SIZE - r.height) / 2) }])
    .jpeg({ quality: 84, mozjpeg: true })
    .toFile(out);

  report.push({ slug: product.slug, source: image, original: `${meta.width}x${meta.height} (produto ${b.width}x${b.height})`, scale: Math.round(scale * 100) / 100 });
}

console.log(`geradas: ${report.length}`);
const blurry = report.filter((item) => item.scale > 1.5);
console.log(`ampliadas mais de 1,5× (recriar a foto quando possível; ×2 = limite, o produto fica menor no quadro): ${blurry.length}`);
for (const item of blurry) console.log(`  ${item.slug}  ${item.original}  ×${item.scale}  ${item.source}`);
