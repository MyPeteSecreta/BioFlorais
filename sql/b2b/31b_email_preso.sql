-- ============================================================================
-- BIO FLORAIS B2B — 31b: histórico do e-mail/login do vendedor (V2)
-- Projeto Neon: bio-florais. SOMENTE ADITIVO, idempotente, transação única. Rode o 31a antes.
-- email_original/login_original guardam o valor de antes de "Editar e-mail/login" ou
-- "Desativar e liberar e-mail"; released_at marca quando o e-mail foi liberado. Nada é apagado.
-- ============================================================================
BEGIN;

ALTER TABLE b2b_responsibles ADD COLUMN IF NOT EXISTS email_original text;
ALTER TABLE b2b_responsibles ADD COLUMN IF NOT EXISTS login_original text;
ALTER TABLE b2b_responsibles ADD COLUMN IF NOT EXISTS released_at timestamp;

COMMIT;
