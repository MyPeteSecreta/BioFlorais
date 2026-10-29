-- ============================================================================
-- BIO FLORAIS — 54a: CONFERÊNCIA (somente leitura) dos 3 cremes para mãos e do nome "Rescue SOS" no banco. Projeto Neon: bio-florais.
-- Não altera nada. O catálogo do código passou de "140g" para "50g" nos 3 cremes para mãos, mas o FRETE não lê o catálogo: o peso
-- e as medidas que entram na cotação vêm de products.weight_grams / length_cm / width_cm / height_cm. Confira abaixo se o peso
-- dos 3 cremes para mãos é o de um creme de 50 g (e não o de 140 g) e quais produtos ainda se chamam "Rescue SOS" no banco.
-- ============================================================================
SELECT slug, name, price_cents, weight_grams, length_cm, width_cm, height_cm, active
  FROM products
 WHERE slug LIKE 'cosmeticos-creme-maos-%'
 ORDER BY slug;

SELECT slug, name FROM products WHERE name ILIKE 'Rescue SOS' ORDER BY slug;
