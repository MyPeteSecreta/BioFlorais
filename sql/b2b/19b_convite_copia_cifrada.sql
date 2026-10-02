-- ============================================================================
-- BIO FLORAIS B2B — 19b: convite do vendedor com token cifrado (C8)
-- Projeto Neon: bio-florais. Aditivo e idempotente, transação única.
-- b2b_responsible_invites.token_ciphertext (AES-256-GCM, chave derivada de
-- ADMIN_SESSION_SECRET). Convites já gerados ficam sem cópia (NULL): para esses,
-- "Gerar novo link". OBRIGATÓRIO ANTES do deploy desta rodada (o app lê a coluna em selects completos de convites).
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE b2b_responsible_invites ADD COLUMN IF NOT EXISTS token_ciphertext text;
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_name = 'b2b_responsible_invites' AND column_name = 'token_ciphertext';
COMMIT;
