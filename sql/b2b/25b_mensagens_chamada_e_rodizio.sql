-- ============================================================================
-- BIO FLORAIS B2B — 25b: chamada curta e rodízio das mensagens ao lojista (A8)
-- Projeto Neon: bio-florais. Aditivo e idempotente, transação única.
--  * b2b_retailer_messages.short_call: chamada curta (até ~30 caracteres) do botão flutuante.
--  * b2b_settings: retailer_banner_seconds e retailer_button_seconds (padrão 60).
-- NÃO cria mensagens novas: o Luis cadastra as dele no admin.
-- Rodar ANTES de usar a "Chamada curta" no admin (sem a coluna o app usa o título).
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE b2b_retailer_messages ADD COLUMN IF NOT EXISTS short_call text;

INSERT INTO b2b_settings (key, value) VALUES ('retailer_banner_seconds', '60'), ('retailer_button_seconds', '60')
ON CONFLICT (key) DO NOTHING;

SELECT key, value FROM b2b_settings WHERE key LIKE 'retailer_%' ORDER BY key;
COMMIT;
