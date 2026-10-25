/*
 * Gera public/feeds/adulto/<slug>.jpg: recorte do frasco das fotos do Floral Adulto (as fotos originais são cenas com molduras e
 * frases de benefício nos adereços; o recorte só mostra o frasco), sobre fundo branco quadrado. Uso: node scripts/feeds/gerar-imagens-adulto.cjs
 * Mesma geometria do recorte das páginas /para/* (largura 40%, altura 66%, topo 13%), com ajuste de centro em 3 produtos.
 */

const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..", "..");
const SRC = path.join(ROOT, "public", "products", "floral-adulto");
const OUT = path.join(ROOT, "public", "feeds", "adulto");
const CENTER_X = { "fase-da-menopausa": 0.68, lideranca: 0.62, "reducao-de-peso": 0.53 };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  let count = 0;

  for (const folder of fs.readdirSync(SRC).filter((name) => fs.statSync(path.join(SRC, name)).isDirectory())) {
    // fora dos feeds: Rescue (o rótulo da foto traz RESCUE) e Tristeza/Depressão (termo de saúde)
    if (/rescue|depress|tristeza/i.test(folder)) continue;

    const file = fs.readdirSync(path.join(SRC, folder)).filter((name) => /\.(png|jpg|jpeg|webp)$/i.test(name)).sort()[0];
    if (!file) continue;

    const input = path.join(SRC, folder, file);
    const { width: W, height: H } = await sharp(input).metadata();
    const cw = Math.round(W * 0.4);
    const ch = Math.round(H * 0.66);
    const left = Math.max(0, Math.min(W - cw, Math.round(W * (CENTER_X[folder] ?? 0.48) - cw / 2)));
    const top = Math.round(H * 0.13);

    await sharp(input)
      .extract({ left, top, width: cw, height: ch })
      .resize({ height: 900, fit: "inside" })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer()
      .then((crop) => sharp({ create: { width: 1000, height: 1000, channels: 3, background: "#ffffff" } }).composite([{ input: crop, gravity: "center" }]).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(OUT, `${folder}.jpg`)));

    count += 1;
  }

  console.log(`${count} imagens em ${OUT}`);
})();
