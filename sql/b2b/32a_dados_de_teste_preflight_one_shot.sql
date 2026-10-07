-- ============================================================================
-- BIO FLORAIS B2B — 32a: preflight da limpeza de dados de TESTE (V5)
-- Projeto Neon: bio-florais. SOMENTE LEITURA, uma consulta, uma linha JSON.
-- Lista o que SERIA arquivado (nada é alterado): vendedores e clientes com "teste" no nome/e-mail
-- ou @example.invalid, e pedidos com o cupom TESTEB2B95 ou ligados a esses vendedores/clientes.
-- "pago_de_verdade" = pedido pago sem o cupom de teste: nunca é arquivado sem confirmação linha a linha.
-- ============================================================================
WITH v AS (
  SELECT id, name, email, status FROM b2b_responsibles
   WHERE name ILIKE '%teste%' OR email ILIKE '%teste%' OR email ILIKE '%@example.invalid'
),
c AS (
  SELECT id, display_name, email FROM b2b_clients
   WHERE display_name ILIKE '%teste%' OR coalesce(email, '') ILIKE '%teste%' OR coalesce(email, '') ILIKE '%@example.invalid'
      OR coalesce(contact_name, '') ILIKE '%teste%'
),
o AS (
  SELECT id, status, total_cents, upper(coalesce(coupon_code, '')) = 'TESTEB2B95' AS cupom_teste,
         (b2b_responsible_id IN (SELECT id FROM v)) AS de_vendedor_teste,
         (b2b_client_id IN (SELECT id FROM c)) AS de_cliente_teste
    FROM orders
   WHERE upper(coalesce(coupon_code, '')) = 'TESTEB2B95'
      OR b2b_responsible_id IN (SELECT id FROM v)
      OR b2b_client_id IN (SELECT id FROM c)
)
SELECT json_build_object(
  'colunas_existem', (
    SELECT count(*) = 6 FROM information_schema.columns
     WHERE (table_name, column_name) IN (('b2b_responsibles','is_test'),('b2b_responsibles','archived_at'),('b2b_clients','is_test'),
                                         ('b2b_clients','archived_at'),('orders','is_test'),('orders','archived_at'))),
  'vendedores', (SELECT coalesce(json_agg(json_build_object('id', id, 'nome', name, 'email', email, 'status', status)), '[]'::json) FROM v),
  'clientes', (SELECT coalesce(json_agg(json_build_object('id', id, 'nome', display_name, 'email', email)), '[]'::json) FROM c),
  'pedidos_total', (SELECT count(*) FROM o),
  'pedidos_com_cupom_de_teste', (SELECT count(*) FROM o WHERE cupom_teste),
  'pedidos_pagos_de_verdade', (SELECT coalesce(json_agg(json_build_object('id', id, 'total_cents', total_cents)), '[]'::json)
                                 FROM o WHERE status = 'paid' AND NOT cupom_teste),
  'pode_prosseguir', true
) AS preflight_dados_de_teste;
