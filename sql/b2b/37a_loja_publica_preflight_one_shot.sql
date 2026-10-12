-- ============================================================================
-- BIO FLORAIS B2B — 37a: preflight da LOJA B2B PÚBLICA (/parceiros). Projeto Neon: bio-florais.
-- SOMENTE LEITURA, uma consulta, uma linha JSON.
-- ============================================================================
SELECT json_build_object(
  'colunas_existem', (
    SELECT count(*) = 3 FROM information_schema.columns
     WHERE (table_name, column_name) IN (('b2b_offers','is_storefront'), ('orders','origin'), ('orders','origin_code'))),
  'vendedores_ativos', (SELECT count(*) FROM b2b_responsibles WHERE status = 'active'),
  'vendedor_da_casa', (SELECT value FROM b2b_settings WHERE key = 'house_responsible_id'),
  'colunas_lead_existem', (
    SELECT count(*) = 3 FROM information_schema.columns
     WHERE (table_name, column_name) IN (('b2b_clients','document'), ('b2b_clients','lead_source'), ('b2b_responsibles','referral_code'))),
  'pode_prosseguir', to_regclass('public.b2b_offers') IS NOT NULL AND to_regclass('public.orders') IS NOT NULL
) AS preflight_loja_publica;
