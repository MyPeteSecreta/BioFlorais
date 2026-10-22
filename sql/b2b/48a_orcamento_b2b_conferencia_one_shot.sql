-- ============================================================================
-- BIO FLORAIS — 48a: CONFERÊNCIA do orçamento B2B (Rodada 19d). Projeto Neon: bio-florais.
-- SOMENTE LEITURA, uma linha JSON. Rode antes e depois do 48b.
-- ============================================================================
SELECT json_build_object(
  'tabela_orders_existe', to_regclass('public.orders') IS NOT NULL,
  'coluna_quote_expires_at_existe', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'quote_expires_at'),
  'orcamentos_pendentes', (SELECT count(*) FROM orders WHERE status = 'quote'),
  'orcamentos_convertidos', (SELECT count(*) FROM orders WHERE status = 'quote_converted'),
  'orcamentos_substituidos', (SELECT count(*) FROM orders WHERE status = 'quote_replaced'),
  'orcamentos_com_pagamento', (SELECT count(*) FROM orders WHERE status = 'quote' AND payment_method IS NOT NULL),
  'pode_prosseguir', to_regclass('public.orders') IS NOT NULL
) AS conferencia_orcamento_b2b;
