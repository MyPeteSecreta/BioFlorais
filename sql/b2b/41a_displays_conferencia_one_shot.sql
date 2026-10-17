-- ============================================================================
-- BIO FLORAIS B2B — 41a: CONFERÊNCIA dos displays/kits (Rodada 11). Projeto Neon: bio-florais.
-- SOMENTE LEITURA, uma consulta, uma linha JSON. Rode ANTES do 41b (pre-requisitos) e DEPOIS (conferencia final).
-- Confere pelo slug que os produtos da composicao fixa existem (adulto-%, pet-%, baby-%, ...), que o kit compacto
-- tem os 8 SKUs, e que o 41b criou as colunas, os 14 produtos internos e os 2 grupos.
-- ============================================================================
SELECT json_build_object(
  'mostruario_39b_existe', to_regclass('public.b2b_showcase_groups') IS NOT NULL,

  -- Florais por linha (a composicao dos displays le a ordem do catalogo do site e cruza com estes slugs)
  'florais_adulto',            (SELECT count(*) FROM products WHERE slug LIKE 'adulto-%'),
  'florais_pet',               (SELECT count(*) FROM products WHERE slug LIKE 'pet-floral-em-gotas-%'),
  'florais_baby',              (SELECT count(*) FROM products WHERE slug LIKE 'baby-%'),
  'florais_kids',              (SELECT count(*) FROM products WHERE slug LIKE 'kids-%'),
  'florais_teen',              (SELECT count(*) FROM products WHERE slug LIKE 'teen-%'),
  'florais_infantil',          (SELECT count(*) FROM products WHERE slug LIKE 'infantil-%'),
  'virtudes_divinas',          (SELECT count(*) FROM products WHERE slug LIKE 'virtudes-divinas-%'),
  'dose_unica',                (SELECT count(*) FROM products WHERE slug LIKE 'dose-unica-%'),

  -- Kit compacto Adulto: 8 SKUs / 13 unidades (Ansiedade 3, Rescue 2, Sono 2, Tristeza 2, Medo, Menopausa, Reducao de Peso, Stress)
  'kit_compacto_skus_encontrados', (SELECT count(*) FROM products WHERE slug IN (
      'adulto-floral-em-gotas-sensacao-de-ansiedade', 'adulto-floral-em-gotas-rescue', 'adulto-floral-em-gotas-sono',
      'adulto-floral-em-gotas-tristeza-estado-depressivo', 'adulto-floral-em-gotas-medo', 'adulto-floral-em-gotas-fase-da-menopausa',
      'adulto-floral-em-gotas-reducao-de-peso', 'adulto-floral-em-gotas-stress')),
  'kit_compacto_skus_esperados', 8,
  'kit_pet_12_skus_encontrados', (SELECT count(*) FROM products WHERE slug IN (
      'pet-floral-em-gotas-ansiedade', 'pet-floral-em-gotas-lambedura-e-automutilacao', 'pet-floral-em-gotas-stress',
      'pet-floral-em-gotas-agressividade', 'pet-floral-em-gotas-coprofagia', 'pet-floral-em-gotas-hiperatividade',
      'pet-floral-em-gotas-latido-excessivo', 'pet-floral-em-gotas-medo', 'pet-floral-em-gotas-s-o-s')),
  'kit_pet_12_skus_esperados', 9,

  -- Depois do 41b
  'colunas_grupos_ok', (SELECT count(*) = 3 FROM information_schema.columns
      WHERE table_name = 'b2b_showcase_groups' AND column_name IN ('window_days', 'fixed_price_cents', 'highlight')),
  'produtos_internos_displays', (SELECT count(*) FROM products WHERE slug LIKE 'bio-disp-%'),
  'produtos_internos_displays_esperados', 12,
  'produtos_internos_provador', (SELECT count(*) FROM products WHERE slug IN ('bio-prov-itsblossom', 'bio-prov-ambpet')),
  'produtos_internos_provador_esperados', 2,
  'grupos_displays_e_provador', CASE WHEN to_regclass('public.b2b_showcase_groups') IS NOT NULL
    THEN (xpath('/row/c/text()', query_to_xml($q$SELECT count(*) AS c FROM b2b_showcase_groups
        WHERE name IN ('Displays', 'Kit Provador (florais de ambiente)')$q$, false, true, '')))[1]::text::int
    ELSE 0 END,
  'grupos_displays_e_provador_esperados', 2
) AS conferencia_displays;
