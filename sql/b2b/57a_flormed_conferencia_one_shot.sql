-- ============================================================================
-- BIO FLORAIS — 57a: CONFERÊNCIA (one-shot, SÓ LEITURA) antes do 57b (Flormed Bio Florais Adulto e Baby). Projeto Neon: bio-florais.
-- Mostra se os 6 Flormed já existem e, para comparar, o peso e as medidas de um floral de 31 ml que já vende.
-- ============================================================================
SELECT slug, name, line_slug, category, price_cents, weight_grams, length_cm, width_cm, height_cm, active
  FROM products
 WHERE slug IN ('adulto-flormed-ansiedade', 'adulto-flormed-sono', 'adulto-flormed-stress',
                'baby-flormed-ninar', 'baby-flormed-ninni-chorim', 'baby-flormed-kolin-k',
                'adulto-floral-em-gotas-sono')
 ORDER BY slug;
