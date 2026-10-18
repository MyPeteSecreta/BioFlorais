-- ============================================================================
-- BIO FLORAIS B2B — 41b: DISPLAYS e KIT PROVADOR no MOSTRUÁRIO (Rodada 11). Projeto Neon: bio-florais.
-- SOMENTE ADITIVO, idempotente, transação única. Rode o 41a antes (conferência) e depois o 41a de novo (conferência final).
-- Pré-requisitos já aplicados: 39b/40b (mostruário) e 37b. NADA é apagado, nenhum produto/grupo existente é alterado.
--  * b2b_showcase_groups: 3 colunas novas (ADD COLUMN IF NOT EXISTS): window_days (janela própria do grupo),
--    fixed_price_cents (preço fixo, fora do %) e highlight ("Destaque" no topo da loja).
--  * 14 PRODUTOS INTERNOS (não visíveis no B2C: o B2C lê o catálogo do site, não esta tabela; ficam fora de qualquer
--    linha comercial/oferta B2B). Servem só para o pedido de mostruário do vendedor:
--      12 displays VAZIOS (200 g, 30 x 30 x 3 cm)  BIO-DISP-*   (slug em minúsculas: bio-disp-*)
--       2 Kit Provador (8 g, 6 x 2 x 2 cm): BIO-PROV-ITSBLOSSOM (Aromatizador It's Blossom, Home Care) e BIO-PROV-AMBPET (floral de ambiente Pet)
--  * 2 grupos do mostruário (só se o nome ainda não existe): "Displays" (R$ 3,00, 1 por linha a cada 180 dias) e
--    "Kit Provador (florais de ambiente)" (R$ 2,00 fixo, destaque).
-- O kit com display do LOJISTA não usa produto: o display é brinde na sacola, vai ao Omie só como observação.
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF to_regclass('public.b2b_showcase_groups') IS NULL THEN
    RAISE EXCEPTION 'Rode antes o SQL 39b (mostruario): b2b_showcase_groups nao existe.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'b2b_showcase_groups' AND column_name = 'window_days') THEN
    ALTER TABLE b2b_showcase_groups ADD COLUMN window_days integer;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'b2b_showcase_groups' AND column_name = 'fixed_price_cents') THEN
    ALTER TABLE b2b_showcase_groups ADD COLUMN fixed_price_cents integer;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'b2b_showcase_groups' AND column_name = 'highlight') THEN
    ALTER TABLE b2b_showcase_groups ADD COLUMN highlight boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Displays vazios (preço de loja simbólico R$ 3,00; o preço do mostruário é fixo no grupo).
INSERT INTO products (slug, name, line_slug, category, price_cents, weight_grams, length_cm, width_cm, height_cm, active)
SELECT v.slug, v.name, v.line_slug, 'Display', 300, 200, 30, 30, 3, true
  FROM (VALUES
    ('bio-disp-adulto-compacto',  'Display compacto Florais Adulto (vazio) · BIO-DISP-ADULTO-COMPACTO',  'adulto'),
    ('bio-disp-adulto-medio',     'Display médio Florais Adulto (vazio) · BIO-DISP-ADULTO-MEDIO',        'adulto'),
    ('bio-disp-adulto-grande',    'Display grande Florais Adulto (vazio) · BIO-DISP-ADULTO-GRANDE',      'adulto'),
    ('bio-disp-pet-12',           'Display 12 Florais Pet (vazio) · BIO-DISP-PET-12',                    'pet'),
    ('bio-disp-pet-30',           'Display 30 Florais Pet (vazio) · BIO-DISP-PET-30',                    'pet'),
    ('bio-disp-pet-44',           'Display 44 Florais Pet (vazio) · BIO-DISP-PET-44',                    'pet'),
    ('bio-disp-baby',             'Display Florais Baby (vazio) · BIO-DISP-BABY',                        'baby'),
    ('bio-disp-kids',             'Display Florais Kids (vazio) · BIO-DISP-KIDS',                        'kids'),
    ('bio-disp-teen',             'Display Florais Teen (vazio) · BIO-DISP-TEEN',                        'teen'),
    ('bio-disp-infantil',         'Display Florais Infantil (vazio) · BIO-DISP-INFANTIL',                'infantil'),
    ('bio-disp-virtudes-divinas', 'Display Virtudes Divinas (vazio) · BIO-DISP-VIRTUDES-DIVINAS',        'virtudes-divinas'),
    ('bio-disp-dose-unica',       'Display Dose Única (vazio) · BIO-DISP-DOSE-UNICA',                    'dose-unica')
  ) AS v(slug, name, line_slug)
 WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.slug = v.slug);

-- Kit Provador: aromatizador It's Blossom (Home Care) e floral de ambiente Pet (Cosméticos Pet).
INSERT INTO products (slug, name, line_slug, category, price_cents, weight_grams, length_cm, width_cm, height_cm, active)
SELECT v.slug, v.name, v.line_slug, 'Kit Provador', 200, 8, 6, 2, 2, true
  FROM (VALUES
    ('bio-prov-itsblossom', 'Kit Provador Aromatizador It''s Blossom · BIO-PROV-ITSBLOSSOM', 'home-care'),
    ('bio-prov-ambpet',     'Kit Provador floral de ambiente Pet · BIO-PROV-AMBPET',               'cosmeticos-pet')
  ) AS v(slug, name, line_slug)
 WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.slug = v.slug);

-- Grupo "Kit Provador": 1 de cada (por linha), R$ 2,00 fixo, em destaque, janela geral do mostruário.
INSERT INTO b2b_showcase_groups
  (name, line_slugs, categories, name_includes, name_excludes, limit_qty, per_line, lowest_volume_only, active, sort_order,
   window_days, fixed_price_cents, highlight)
SELECT 'Kit Provador (florais de ambiente)', ARRAY['home-care','cosmeticos-pet'], ARRAY['Kit Provador'], ARRAY[]::text[], ARRAY[]::text[],
       1, true, false, true, 1, NULL, 200, true
 WHERE NOT EXISTS (SELECT 1 FROM b2b_showcase_groups WHERE name = 'Kit Provador (florais de ambiente)');

-- Grupo "Displays": o vendedor pede o display VAZIO por R$ 3,00; 1 por linha a cada 180 dias (janela própria).
INSERT INTO b2b_showcase_groups
  (name, line_slugs, categories, name_includes, name_excludes, limit_qty, per_line, lowest_volume_only, active, sort_order,
   window_days, fixed_price_cents, highlight)
SELECT 'Displays', ARRAY['adulto','pet','baby','kids','teen','infantil','virtudes-divinas','dose-unica'], ARRAY['Display'],
       ARRAY[]::text[], ARRAY[]::text[], 1, true, false, true, 5, 180, 300, false
 WHERE NOT EXISTS (SELECT 1 FROM b2b_showcase_groups WHERE name = 'Displays');

COMMIT;

SELECT 'ok' AS resultado;
