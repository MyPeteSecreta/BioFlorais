/*
 * B2C P1 — sacola/checkout: NOME COMPLETO (tipo + nome + linha + volume) e foto real; hoje só "Filhotes".
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const { cartItemDisplay } = await import("../src/lib/cart-display.ts");
const { getProduct } = await import("../src/lib/catalog/bio-products.ts");
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

test("nome completo no lugar do nome curto, por slug do catálogo", () => {
  assert.equal(cartItemDisplay({ slug: "cosmeticos-pet-condicionador-filhotes", name: "Filhotes" }).name, "Condicionador Filhotes · Cosméticos Pet · 500 ml");
  assert.equal(cartItemDisplay({ slug: "pet-floral-em-gotas-filhotes", name: "Filhotes" }).name, "Floral Filhotes · Pet · 31 ml");
  assert.equal(cartItemDisplay({ slug: "cosmeticos-pet-shampoo-filhotes", name: "Filhotes" }).name, "Shampoo Filhotes · Cosméticos Pet · 500 ml");
  assert.equal(cartItemDisplay({ slug: "nao-existe", name: "Reserva" }).name, "Reserva");
  assert.equal(cartItemDisplay({ slug: "nao-existe", name: "Reserva", image: "/x.png" }).image, "/x.png");
  assert.ok(getProduct("pet-floral-em-gotas-filhotes"));
});

test("telas: sacola e resumo do checkout usam o nome completo e a foto da API (catálogo aponta para arquivos inexistentes)", () => {
  for (const f of ["src/app/carrinho/page.tsx", "src/app/checkout/page.tsx"]) {
    const src = read(f);
    assert.ok(src.includes("cartItemDisplay(") && src.includes("useCartImages("), f);
  }
  const route = read("src/app/api/catalog/images/route.ts");
  assert.ok(route.includes("getProductMainImage") && route.includes('startsWith("/products/")'));
  // o motivo da API: o caminho de imagem do catálogo não existe em public/
  assert.equal(existsSync(new URL("../public/assets/products", import.meta.url)), false);
});
