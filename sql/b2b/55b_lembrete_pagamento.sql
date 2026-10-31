-- ============================================================================
-- BIO FLORAIS — 55b: LEMBRETE DE PEDIDO NÃO PAGO. Projeto Neon: bio-florais.
-- SOMENTE ADITIVO, idempotente, transação única, sem UPDATE/DELETE. Rode o 55a antes (mostra o tamanho da primeira rodada).
--  * orders.payment_reminder_sent_at: quando o e-mail "Seu pedido está separado" foi enviado (uma vez por pedido).
--  * índice parcial para a tarefa a cada 15 min achar rápido os pendentes sem lembrete.
-- Atenção: pedidos pendentes criados nas últimas 48 h (e há mais de 1 h) recebem o lembrete na primeira rodada depois do deploy. Para NÃO
-- avisar os que já existem hoje, rode (separado, só se quiser):
--   UPDATE orders SET payment_reminder_sent_at = now() WHERE payment_reminder_sent_at IS NULL AND status IN ('pending','checkout_pending');
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_reminder_sent_at') THEN
    ALTER TABLE orders ADD COLUMN payment_reminder_sent_at timestamp;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS orders_payment_reminder_idx ON orders (created_at)
  WHERE payment_reminder_sent_at IS NULL AND status IN ('pending', 'checkout_pending');

SELECT 'ok' AS resultado;

COMMIT;
