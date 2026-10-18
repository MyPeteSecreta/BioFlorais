-- ============================================================================
-- BIO FLORAIS B2B — 42a: CONFERÊNCIA do ajuste da Rodada 11 (Pet 13 un., Dose Única 12, Baby 22, Kit Provador
-- Aromatizador It's Blossom). Projeto Neon: bio-florais. SOMENTE LEITURA, uma linha JSON. Rode antes e depois do 42b.
-- Conferência pelo slug: florais adulto-% (kit compacto = 8 SKUs), Pet 12 (9 SKUs), Baby 11 SKUs, Dose Única 6 SKUs e os
-- aromatizadores Home Care (o Kit Provador It's Blossom é do aromatizador).
-- ============================================================================
SELECT json_build_object(
  'florais_adulto_slug_adulto', (SELECT count(*) FROM products WHERE slug LIKE 'adulto-%'),
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
  'baby_skus_encontrados', (SELECT count(*) FROM products WHERE slug LIKE 'baby-%'),
  'baby_skus_esperados', 11,
  'dose_unica_skus_encontrados', (SELECT count(*) FROM products WHERE slug LIKE 'dose-unica-%'),
  'dose_unica_skus_esperados', 6,
  'aromatizadores_home_care', (SELECT count(*) FROM products WHERE slug LIKE 'home-care-aromatizador-%'),
  'kit_provador_itsblossom_nome', (SELECT name FROM products WHERE slug = 'bio-prov-itsblossom'),
  'kit_provador_itsblossom_ok', COALESCE((SELECT name LIKE 'Kit Provador Aromatizador It''s Blossom%' FROM products WHERE slug = 'bio-prov-itsblossom'), false)
) AS conferencia_ajuste_displays;
