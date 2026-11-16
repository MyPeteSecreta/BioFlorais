-- ============================================================================
-- BIO FLORAIS — 57b: FLORMED Bio Florais Adulto e Baby no catálogo (B2C e B2B). Projeto Neon: bio-florais.
-- SOMENTE ADITIVO, idempotente, transação única, sem UPDATE/DELETE. Rode o 57a antes.
--  * 6 produtos (os que têm foto real da embalagem): Adulto Ansiedade, Sono, Stress; Baby "Primeiros Sentires" Ninar, Ninnì Chorim, Kolin K.
--  * Preço B2C R$ 32,90 (igual ao Flormed Pet da My Pet). Categoria "Floral em gotas": no B2B vale o preço fixo dos florais (R$ 19,90).
--  * PESO E MEDIDAS [CONFERIR]: bisnaga de 31 g no cartucho; valores provisórios (60 g, 4 x 4 x 13 cm). Se o 57a mostrar outros valores
--    para os florais, ajuste os números ABAIXO antes de rodar (o frete usa estes campos).
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

INSERT INTO products (slug, name, line_slug, category, price_cents, weight_grams, length_cm, width_cm, height_cm, active)
SELECT v.slug, v.name, v.line_slug, 'Floral em gotas', 3290, 60, 4, 4, 13, true
  FROM (VALUES
    ('adulto-flormed-ansiedade',  'Flormed Ansiedade',     'adulto'),
    ('adulto-flormed-sono',       'Flormed Sono',          'adulto'),
    ('adulto-flormed-stress',     'Flormed Stress',        'adulto'),
    ('baby-flormed-ninar',        'Flormed Ninar',         'baby'),
    ('baby-flormed-ninni-chorim', 'Flormed Ninnì Chorim',  'baby'),
    ('baby-flormed-kolin-k',      'Flormed Kolin K',       'baby')
  ) AS v(slug, name, line_slug)
 WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.slug = v.slug);

SELECT count(*) AS flormed_no_banco FROM products WHERE slug LIKE '%-flormed-%';

COMMIT;
