-- ============================================================================
-- BIO FLORAIS B2B — 32b: dados de TESTE (V5) — marcar e ARQUIVAR, sem apagar
-- Projeto Neon: bio-florais. SOMENTE ADITIVO, idempotente, transação única. Rode o 32a antes.
-- is_test marca o que é teste; archived_at some com o registro de listas, painéis, comissões,
-- Central/Omie e acompanhamento. b2b_archive_log guarda o lote (para DESFAZER).
-- Nada é apagado e nenhum dado existente muda ao aplicar este SQL.
-- ============================================================================
BEGIN;

ALTER TABLE b2b_responsibles ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE b2b_responsibles ADD COLUMN IF NOT EXISTS archived_at timestamp;
ALTER TABLE b2b_clients ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE b2b_clients ADD COLUMN IF NOT EXISTS archived_at timestamp;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS archived_at timestamp;

CREATE TABLE IF NOT EXISTS b2b_archive_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  previous_status text,
  created_at timestamp NOT NULL DEFAULT now(),
  restored_at timestamp
);
CREATE INDEX IF NOT EXISTS b2b_archive_log_batch_idx ON b2b_archive_log (batch_id);

COMMIT;
