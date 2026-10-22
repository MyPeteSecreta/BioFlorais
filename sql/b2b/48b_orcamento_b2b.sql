-- ============================================================================
-- BIO FLORAIS — 48b: orçamento B2B (Rodada 19d). Projeto Neon: bio-florais.
-- SOMENTE ADITIVO, idempotente, transação única, linha final "ok". Rode o 48a antes e depois.
--  * orders.quote_expires_at   validade do orçamento (15 dias por padrão; configurável no app por B2B_QUOTE_VALIDITY_DAYS)
-- O orçamento é um pedido com status 'quote' ("Orçamento (pendente)"), sem forma de pagamento: não reserva estoque, não vai
-- ao Omie/Central (que só leem pedidos pagos), não conta como compra nem gera comissão. Ao virar pedido o orçamento passa a
-- 'quote_converted'; ao ser salvo de novo, o anterior passa a 'quote_replaced'. Nenhum dado existente é alterado.
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'quote_expires_at') THEN
    ALTER TABLE orders ADD COLUMN quote_expires_at timestamptz;
  END IF;
END $$;

COMMIT;

SELECT 'ok' AS resultado;
