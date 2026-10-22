-- ============================================================================
-- BIO FLORAIS — 46b: observações do pedido (Rodada 19a). Projeto Neon: bio-florais.
-- SOMENTE ADITIVO, idempotente, transação única, linha final "ok". Rode o 46a antes e depois.
--  * orders.customer_note   texto livre do cliente (até 500 caracteres, validado no servidor)
-- Sem esta coluna o pedido é criado normalmente, sem a observação. Nenhum dado existente é alterado.
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_note') THEN
    ALTER TABLE orders ADD COLUMN customer_note text;
  END IF;
END $$;

COMMIT;

SELECT 'ok' AS resultado;
