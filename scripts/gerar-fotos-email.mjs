/*
 * Gera src/lib/catalog/product-email-images.ts: a foto principal de cada produto (a mesma da sacola/checkout, getProductMainImage),
 * para os e-mails usarem SEM ler a pasta public/ no servidor (ela não vai para as funções da Vercel: 273 MB).
 * Rodar de novo quando mudar foto de produto: node --import ./scripts/register-ts-paths.mjs scripts/gerar-fotos-email.mjs
 * O teste scripts/lembrete-pagamento.test.mjs confere que a tabela bate com as fotos de public/products.
 */
import { writeFileSync } from "node:fs";

const { bioProducts } = await import("../src/lib/catalog/bio-products.ts");
const { getProductMainImage } = await import("../src/lib/catalog/product-images.server.ts");

const lines = [];
for (const product of bioProducts) {
  const image = getProductMainImage(product);
  if (image && image.startsWith("/products/")) lines.push(`  ${JSON.stringify(product.slug)}: ${JSON.stringify(image)},`);
}

writeFileSync(
  "src/lib/catalog/product-email-images.ts",
  `/**
 * Foto principal de cada produto para os e-mails (gerado por scripts/gerar-fotos-email.mjs; não editar à mão).
 * A mesma da sacola/checkout (getProductMainImage). Os e-mails pedem a versão pequena pelo otimizador de imagens do site.
 */
export const PRODUCT_EMAIL_IMAGES: Readonly<Record<string, string>> = {
${lines.join("\n")}
};
`
);
console.log("ok", lines.length);
