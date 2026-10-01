-- ============================================================================
-- BIO FLORAIS B2B — SEED DE PROMOÇÕES DE TESTE: PREFLIGHT EM CONSULTA ÚNICA
-- ============================================================================
-- UM único SELECT, UMA linha, UMA coluna json. Somente leitura.
-- Rodar ANTES de 06b_seed_promocoes_teste.sql e conferir:
--   * products_by_line: Adulto/Pet/Infantil/Baby com produtos ativos;
--   * baby_sono_candidates: EXATAMENTE 1 produto (o 06b aborta se não for);
--   * commercial_groups_slug_unique: true (ou nenhum slug duplicado);
--   * commission_rules: se a tabela já existe e com quais colunas.
-- Usa to_jsonb(linha) onde a coluna pode ainda não existir.
-- ============================================================================

SELECT json_build_object(

  'generated_at', now(),

  -- Produtos ativos por linha (products.line_slug) das 4 linhas do seed.
  'products_by_line', (
    SELECT coalesce(json_object_agg(line_slug, total), '{}'::json)
      FROM (SELECT line_slug, count(*) AS total
              FROM products
             WHERE active AND line_slug IN ('adulto', 'pet', 'infantil', 'baby')
             GROUP BY line_slug) x
  ),
  'products_missing_dimensions_by_line', (
    SELECT coalesce(json_object_agg(line_slug, total), '{}'::json)
      FROM (SELECT line_slug, count(*) AS total
              FROM products
             WHERE active AND line_slug IN ('adulto', 'pet', 'infantil', 'baby')
               AND (weight_grams IS NULL OR length_cm IS NULL OR width_cm IS NULL OR height_cm IS NULL)
             GROUP BY line_slug) x
  ),

  -- Produto Sono da linha Baby (promoção pontual por SKU). Esperado: 1.
  'baby_sono_candidates', (
    SELECT coalesce(json_agg(json_build_object(
             'id', id, 'slug', slug, 'name', name, 'active', active,
             'sku', to_jsonb(p) ->> 'sku')), '[]'::json)
      FROM products p
     WHERE slug = 'baby-floral-em-gotas-sono'
  ),

  -- Grupos comerciais existentes (inclui o "BIO-B2B TEST GROUP").
  'commercial_groups', (
    SELECT coalesce(json_agg(json_build_object(
             'slug', g.slug, 'name', g.name, 'active', g.active, 'b2b_visible', g.b2b_visible,
             'products', (SELECT count(*) FROM b2b_commercial_group_products gp
                           WHERE gp.commercial_group_id = g.id))
             ORDER BY g.sort_order, g.name), '[]'::json)
      FROM b2b_commercial_groups g
  ),
  'commercial_groups_slug_unique', EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public' AND tablename = 'b2b_commercial_groups'
       AND indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%(slug)%'
  ),
  'commercial_groups_duplicate_slugs', (
    SELECT coalesce(json_agg(slug), '[]'::json)
      FROM (SELECT slug FROM b2b_commercial_groups GROUP BY slug HAVING count(*) > 1) x
  ),

  -- Promoções que o seed criaria e que já existem (pelo nome).
  'seed_promotions_already_present', (
    SELECT coalesce(json_agg(json_build_object('name', name, 'type', type, 'buy', buy_quantity,
                                               'free', free_quantity, 'active', active)), '[]'::json)
      FROM b2b_promotions
     WHERE name LIKE '3 por 2 - %' OR name LIKE '4 por 2 - %'
  ),
  'promotions_scope_values', (
    SELECT coalesce(json_object_agg(scope, total), '{}'::json)
      FROM (SELECT scope, count(*) AS total FROM b2b_promotions GROUP BY scope) x
  ),
  'promotions_not_null_without_default', (
    SELECT coalesce(json_agg(column_name ORDER BY ordinal_position), '[]'::json)
      FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'b2b_promotions'
       AND is_nullable = 'NO' AND column_default IS NULL
  ),

  -- Regras de comissão: a tabela existe? colunas? regras atuais.
  'commission_rules_table_exists', to_regclass('public.b2b_commission_rules') IS NOT NULL,
  'commission_rules_columns', (
    SELECT coalesce(json_agg(json_build_object(
             'column', column_name, 'type', data_type, 'nullable', is_nullable,
             'default', column_default) ORDER BY ordinal_position), '[]'::json)
      FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'b2b_commission_rules'
  ),
  -- query_to_xml só executa (e só referencia a tabela) quando ela existe;
  -- assim a consulta não quebra se b2b_commission_rules ainda não existir.
  'commission_rules_by_scope_xml', CASE
    WHEN to_regclass('public.b2b_commission_rules') IS NOT NULL THEN
      query_to_xml(
        'SELECT scope, count(*) AS total FROM b2b_commission_rules GROUP BY scope ORDER BY scope',
        false, false, ''
      )::text
    ELSE 'tabela b2b_commission_rules não existe (o 06b cria)'
  END

) AS preflight_seed_promocoes;
