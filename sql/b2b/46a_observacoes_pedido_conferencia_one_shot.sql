-- ============================================================================
-- BIO FLORAIS — 46a: CONFERÊNCIA das observações do pedido (Rodada 19a). Projeto Neon: bio-florais.
-- SOMENTE LEITURA, uma linha JSON. Rode antes e depois do 46b.
-- ============================================================================
SELECT json_build_object(
  'tabela_orders_existe', to_regclass('public.orders') IS NOT NULL,
  'coluna_customer_note_existe', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_note'),
  'pedidos_com_observacao', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_note')
    THEN (xpath('/row/c/text()', query_to_xml('SELECT count(*) AS c FROM orders WHERE customer_note IS NOT NULL', false, true, '')))[1]::text::int
    ELSE 0 END,
  'complementos_acima_de_60', (SELECT count(*) FROM addresses WHERE char_length(complement) > 60),
  'pode_prosseguir', to_regclass('public.orders') IS NOT NULL
) AS conferencia_observacoes_pedido;
