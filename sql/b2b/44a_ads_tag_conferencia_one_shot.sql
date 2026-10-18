-- ============================================================================
-- BIO FLORAIS — 44a: CONFERÊNCIA da Image Tag do ChatGPT Ads (Rodada 12 v3). Projeto Neon: bio-florais.
-- SOMENTE LEITURA, uma linha JSON. Rode antes e depois do 44b.
-- ============================================================================
SELECT json_build_object(
  'tabela_orders_existe', to_regclass('public.orders') IS NOT NULL,
  'colunas_ads_existentes', (SELECT count(*) FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name IN ('oppref', 'ads_event_id', 'ads_tag_sent_at')),
  'colunas_ads_esperadas', 3,
  'pedidos_com_oppref', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'oppref')
    THEN (xpath('/row/c/text()', query_to_xml('SELECT count(*) AS c FROM orders WHERE oppref IS NOT NULL', false, true, '')))[1]::text::int
    ELSE 0 END,
  'tags_ja_enviadas', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'ads_tag_sent_at')
    THEN (xpath('/row/c/text()', query_to_xml('SELECT count(*) AS c FROM orders WHERE ads_tag_sent_at IS NOT NULL', false, true, '')))[1]::text::int
    ELSE 0 END,
  'pode_prosseguir', to_regclass('public.orders') IS NOT NULL
) AS conferencia_ads_tag;
