-- ============================================================================
-- BIO FLORAIS B2B — 11b: guarda o token do link cifrado para "Copiar link"
-- Projeto Neon: bio-florais. Aditivo e idempotente, transação única.
-- b2b_offer_links.token_ciphertext (AES-256-GCM, chave derivada de
-- ADMIN_SESSION_SECRET). Links já gerados ficam sem cópia (NULL): para esses o
-- vendedor usa "Gerar novo link". Pode rodar antes ou depois do deploy: sem a
-- coluna o app grava o link normalmente, só sem a cópia.
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE b2b_offer_links ADD COLUMN IF NOT EXISTS token_ciphertext text;
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_name = 'b2b_offer_links' AND column_name = 'token_ciphertext';
COMMIT;
