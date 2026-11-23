-- ============================================================================
-- BIO FLORAIS — 59a: CONFERENCIA da origem completa (utm_content, utm_term, gclid, fbclid). Projeto Neon: bio-florais.
-- SOMENTE LEITURA, uma linha JSON. Rode ANTES e DEPOIS do 59b.
-- ============================================================================
SELECT json_build_object(
  'tabela_orders_existe', to_regclass('public.orders') IS NOT NULL,
  'colunas_origem_basica', (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'orders' AND column_name IN ('utm_source', 'utm_medium', 'utm_campaign', 'referrer_domain')),
  'colunas_origem_basica_esperadas', 4,
  'colunas_origem_extra', (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'orders' AND column_name IN ('utm_content', 'utm_term', 'gclid', 'fbclid')),
  'colunas_origem_extra_esperadas', 4,
  'total_pedidos', (SELECT count(*) FROM orders),
  'pode_prosseguir', to_regclass('public.orders') IS NOT NULL
) AS conferencia_origem_extra;
