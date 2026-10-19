-- ============================================================================
-- BIO FLORAIS — 45a: CONFERÊNCIA da origem da venda (Rodada 17). Projeto Neon: bio-florais.
-- SOMENTE LEITURA, uma linha JSON. Rode antes e depois do 45b.
-- Conferência pelo slug adulto-%: pedidos que têm item de produto da linha Adulto (products.slug LIKE 'adulto-%')
-- e quantos já têm origem gravada (utm_source/referrer_domain), para validar o fluxo com um pedido real da linha.
-- ============================================================================
SELECT json_build_object(
  'tabela_orders_existe', to_regclass('public.orders') IS NOT NULL,
  'colunas_origem_existentes', (SELECT count(*) FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name IN ('utm_source', 'utm_medium', 'utm_campaign', 'referrer_domain')),
  'colunas_origem_esperadas', 4,
  'produtos_slug_adulto', (SELECT count(*) FROM products WHERE slug LIKE 'adulto-%'),
  'pedidos_com_item_adulto', (SELECT count(DISTINCT oi.order_id) FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE p.slug LIKE 'adulto-%'),
  'pedidos_com_origem', CASE WHEN (SELECT count(*) FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name IN ('utm_source', 'referrer_domain')) = 2
    THEN (xpath('/row/c/text()', query_to_xml('SELECT count(*) AS c FROM orders WHERE utm_source IS NOT NULL OR referrer_domain IS NOT NULL', false, true, '')))[1]::text::int
    ELSE 0 END,
  'pedidos_adulto_com_origem', CASE WHEN (SELECT count(*) FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name IN ('utm_source', 'referrer_domain')) = 2
    THEN (xpath('/row/c/text()', query_to_xml(
      'SELECT count(DISTINCT o.id) AS c FROM orders o JOIN order_items oi ON oi.order_id = o.id JOIN products p ON p.id = oi.product_id WHERE p.slug LIKE ''adulto-%'' AND (o.utm_source IS NOT NULL OR o.referrer_domain IS NOT NULL)', false, true, '')))[1]::text::int
    ELSE 0 END,
  'pode_prosseguir', to_regclass('public.orders') IS NOT NULL
) AS conferencia_origem_venda;
