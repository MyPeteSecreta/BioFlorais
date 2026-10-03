/*
 * Nome COMPLETO do produto no B2B: "<Tipo> <Nome> · <Linha> · <volume>".
 * O catálogo do B2C só é LIDO (nada é alterado).
 */
import test from "node:test";
import assert from "node:assert/strict";

const { b2bProductLabel } = await import("../src/lib/b2b/product-label.ts");

test("cosmético pet: tipo, nome, linha e volume (500 ml x 5 L se distinguem)", () => {
  const small = b2bProductLabel({ slug: "cosmeticos-pet-shampoo-agressividade", name: "Agressividade" });
  const big = b2bProductLabel({ slug: "cosmeticos-pet-shampoo-agressividade-5l", name: "Agressividade" });

  assert.equal(small.full, "Shampoo Agressividade · Cosméticos Pet · 500 ml");
  assert.equal(big.full, "Shampoo Agressividade · Cosméticos Pet · 5 L");
  assert.equal(small.type, "Shampoo");
  assert.equal(small.title, "Shampoo Agressividade");
});

test("floral e outros: 'Floral em gotas' vira 'Floral'; volume com espaço (300ml -> 300 ml)", () => {
  assert.equal(b2bProductLabel({ slug: "pet-floral-em-gotas-agressividade", name: "Agressividade" }).full, "Floral Agressividade · Pet · 31 ml");
  assert.equal(b2bProductLabel({ slug: "teen-floral-em-gotas-agressividade", name: "Agressividade" }).full, "Floral Agressividade · Teen · 31 ml");
  assert.equal(b2bProductLabel({ slug: "cosmeticos-shampoo-uso-diario", name: "Uso Diário" }).full, "Shampoo Uso Diário · Cosméticos · 300 ml");
  assert.equal(b2bProductLabel({ slug: "cosmeticos-condicionador-uso-diario", name: "Uso Diário" }).full, "Condicionador Uso Diário · Cosméticos · 300 ml");
});

test("não repete o tipo/linha quando o nome já o contém ou o tipo é a própria linha; produto fora do catálogo usa os dados do banco", () => {
  assert.equal(b2bProductLabel({ slug: "virtudes-divinas-virtudes-divinas-amor", name: "Amor" }).full, "Amor · Virtudes Divinas · 15 ml");
  assert.equal(
    b2bProductLabel({ slug: "nao-existe", name: "Shampoo Especial", category: "Shampoo", lineSlug: "cosmeticos" }).full,
    "Shampoo Especial · Cosméticos"
  );
});
