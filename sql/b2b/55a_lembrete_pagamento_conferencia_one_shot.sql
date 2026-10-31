-- ============================================================================
-- BIO FLORAIS — 55a: CONFERÊNCIA do lembrete de pedido não pago (somente leitura, uma linha JSON). Projeto Neon: bio-florais.
-- Não altera nada. Mostra: se a coluna orders.payment_reminder_sent_at já existe e, no momento, quantos pedidos B2C o lembrete
-- atingiria (pending/checkout_pending, criados há mais de 1 h e menos de 48 h, com e-mail, sem pagamento aprovado, sem B2B e não
-- arquivados). Rode ANTES do 55b para saber o tamanho da primeira rodada.
-- ============================================================================
SELECT jsonb_build_object(
  'coluna_payment_reminder_sent_at_existe', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_reminder_sent_at'),
  'pedidos_pendentes_total', (SELECT count(*) FROM orders WHERE status IN ('pending', 'checkout_pending')),
  'pedidos_pendentes_b2c_na_janela_1h_a_48h', (
    SELECT count(*) FROM orders o JOIN customers c ON c.id = o.customer_id
     WHERE o.status IN ('pending', 'checkout_pending')
       AND o.created_at < (now() AT TIME ZONE 'UTC') - interval '1 hour' AND o.created_at > (now() AT TIME ZONE 'UTC') - interval '48 hours'
       AND o.b2b_offer_id IS NULL AND o.b2b_client_id IS NULL
       AND COALESCE(btrim(c.email), '') <> ''
       AND COALESCE(to_jsonb(o) ->> 'archived_at', '') = ''
       AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id AND p.status IN ('paid', 'approved', 'authorized'))
  ),
  'por_status', (SELECT coalesce(jsonb_object_agg(status, n), '{}'::jsonb) FROM (SELECT status, count(*) AS n FROM orders WHERE status IN ('pending', 'checkout_pending') GROUP BY status) s)
) AS conferencia_lembrete_pagamento;
