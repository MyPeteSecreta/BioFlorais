-- ============================================================================
-- BIO FLORAIS B2B — 14a: preflight do tipo de promoção (Rodada 2)
-- Projeto Neon: bio-florais. SOMENTE LEITURA, uma consulta, uma linha JSON.
-- Confere o que o 14b vai criar e o que a nova lógica lê.
-- ============================================================================
SELECT json_build_object(
  'b2b_promotions_promo_type_existe', EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'b2b_promotions' AND column_name = 'promo_type'),
  'b2b_settings_existe', to_regclass('public.b2b_settings') IS NOT NULL,
  'orders_colunas_ok', (
    SELECT json_object_agg(column_name, true) FROM information_schema.columns
     WHERE table_name = 'orders' AND column_name IN ('b2b_client_id', 'b2b_offer_id', 'payment_method', 'status', 'created_at')),
  'order_items_colunas_ok', (
    SELECT json_object_agg(column_name, data_type) FROM information_schema.columns
     WHERE table_name = 'order_items' AND column_name IN ('promotion_id', 'bonus_qty', 'unit_price_cents')),
  'b2b_boleto_requests_existe', to_regclass('public.b2b_boleto_requests') IS NOT NULL,
  'promocoes_atuais', (
    SELECT coalesce(json_agg(json_build_object('id', id, 'name', name, 'active', active) ORDER BY name), '[]'::json)
      FROM b2b_promotions),
  'status_de_pedidos_b2b', (
    SELECT coalesce(json_object_agg(status, total), '{}'::json)
      FROM (SELECT status, count(*) AS total FROM orders WHERE b2b_offer_id IS NOT NULL GROUP BY status) x)
) AS preflight_promocoes_tipo;
