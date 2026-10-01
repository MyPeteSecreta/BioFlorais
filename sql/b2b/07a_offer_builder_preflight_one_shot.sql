-- ============================================================================
-- BIO FLORAIS B2B — OFFER BUILDER: PREFLIGHT EM CONSULTA ÚNICA
-- ============================================================================
-- UM único SELECT, UMA linha, UMA coluna json. Somente leitura.
-- Rodar antes de 07b_offer_builder_candidate_if_not_exists.sql.
-- ============================================================================

SELECT json_build_object(

  'generated_at', now(),

  -- Colunas que o Offer Builder e o snapshot do pedido usam.
  'columns', (
    SELECT json_agg(json_build_object(
             'table_name', e.table_name,
             'column_name', e.column_name,
             'data_type', c.data_type,
             'status', CASE WHEN c.column_name IS NULL THEN 'FALTANDO' ELSE 'ok' END
           ) ORDER BY e.table_name, e.column_name)
      FROM (VALUES
        ('b2b_offer_promotions', 'commercial_group_id'),
        ('b2b_offer_promotions', 'eligibility_mode'),
        ('b2b_offer_promotions', 'duration_days'),
        ('b2b_offer_promotions', 'max_uses'),
        ('b2b_offer_promotions', 'uses_count'),
        ('b2b_offer_promotions', 'valid_from'),
        ('b2b_offer_promotions', 'valid_until'),
        ('order_items', 'paid_qty'),
        ('order_items', 'bonus_qty'),
        ('order_items', 'physical_qty'),
        ('order_items', 'promotion_id'),
        ('order_items', 'promotion_name'),
        ('order_items', 'promotion_buy_quantity'),
        ('order_items', 'promotion_free_quantity'),
        ('order_items', 'commission_base_percent'),
        ('order_items', 'commission_extra_percent'),
        ('order_items', 'commission_total_percent'),
        ('b2b_commission_rules', 'eligibility_mode'),
        ('b2b_commission_rules', 'max_uses'),
        ('b2b_commission_rules', 'duration_days')
      ) AS e(table_name, column_name)
      LEFT JOIN information_schema.columns c
        ON c.table_schema = 'public'
       AND c.table_name = e.table_name
       AND c.column_name = e.column_name
  ),

  -- Ofertas por status (as antigas, criadas já "active" pelo painel
  -- anterior, continuam valendo; novas nascem "draft").
  'offers_by_status', (
    SELECT coalesce(json_object_agg(status, total), '{}'::json)
      FROM (SELECT status, count(*) AS total FROM b2b_offers GROUP BY status) x
  ),

  -- Promoções já ligadas a ofertas (sem linha/elegibilidade gravadas
  -- quando vieram do painel antigo).
  'offer_promotions_total', (SELECT count(*) FROM b2b_offer_promotions)

) AS preflight_offer_builder;
