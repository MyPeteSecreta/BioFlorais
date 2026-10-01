-- ============================================================================
-- BIO FLORAIS B2B — ADMIN ABAS 2/3/4: PREFLIGHT EM CONSULTA ÚNICA
-- ============================================================================
-- UM único SELECT, UMA linha, UMA coluna json. Somente leitura.
-- Rodar antes de 05b_admin_tabs_candidate_if_not_exists.sql.
-- ============================================================================

SELECT json_build_object(

  'generated_at', now(),

  -- Tabela nova de "linha aberta fora da oferta".
  'line_views_table_exists', to_regclass('public.b2b_offer_line_views') IS NOT NULL,

  -- Linhas comerciais: slugs duplicados quebrariam a validação do admin
  -- (esperado: []) e quantas estão ativas/visíveis.
  'groups_duplicate_slugs', (
    SELECT coalesce(json_agg(x), '[]'::json)
      FROM (SELECT slug, count(*) AS total FROM b2b_commercial_groups
             GROUP BY slug HAVING count(*) > 1) x
  ),
  'groups_summary', (
    SELECT json_build_object(
             'total', count(*),
             'active_visible', count(*) FILTER (WHERE active AND b2b_visible))
      FROM b2b_commercial_groups
  ),

  -- Promoções por tipo/escopo: o admin cria só "buy_x_get_y_auto_same_sku"
  -- com scope 'b2b'; outros tipos aparecem só para consulta.
  'promotions_by_type_scope', (
    SELECT coalesce(json_agg(x), '[]'::json)
      FROM (SELECT type, scope, active, seller_selectable, count(*) AS total
              FROM b2b_promotions
             GROUP BY type, scope, active, seller_selectable
             ORDER BY type, scope) x
  ),

  -- Colunas obrigatórias de b2b_promotions sem default (o admin preenche
  -- name, scope, type; conferir se não há outra NOT NULL sem default).
  'promotions_not_null_without_default', (
    SELECT coalesce(json_agg(column_name ORDER BY ordinal_position), '[]'::json)
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'b2b_promotions'
       AND is_nullable = 'NO'
       AND column_default IS NULL
  ),
  'groups_not_null_without_default', (
    SELECT coalesce(json_agg(column_name ORDER BY ordinal_position), '[]'::json)
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'b2b_commercial_groups'
       AND is_nullable = 'NO'
       AND column_default IS NULL
  )

) AS preflight_admin_tabs;
