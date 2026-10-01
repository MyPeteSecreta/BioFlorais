-- ============================================================================
-- BIO FLORAIS B2B — VENCIMENTOS DO BOLETO: SQL CANDIDATO (aditivo)
-- ============================================================================
-- Transação única, só ADD COLUMN IF NOT EXISTS. Sem DROP/UPDATE.
-- Necessário antes do deploy: a rota /api/b2b/payments/boleto grava
-- b2b_boleto_requests.schedule = [{ installment, dueDate "AAAA-MM-DD",
-- amountCents }] (28/42/56 dias da data do pedido, calendário de SP).
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE b2b_boleto_requests ADD COLUMN IF NOT EXISTS schedule jsonb;

COMMIT;
