-- ============================================================================
-- BIO FLORAIS — 59b: ORIGEM COMPLETA da venda (23/11). SOMENTE ADITIVO, idempotente, transacao unica, termina em "ok".
-- Neon: projeto bio-florais. Ordem: backup -> 59a (antes) -> 59b -> 59a (depois) -> publicar o codigo.
--   orders.utm_content / utm_term   qual anuncio/criativo/termo (do link)
--   orders.gclid / fbclid           identificadores de clique do Google e da Meta (so letras, numeros, _ - .)
-- Repete as 4 colunas da origem basica com IF NOT EXISTS (inofensivo se o 45b ja rodou). Nenhum dado existente muda.
-- O codigo tolera a ausencia destas colunas (grava so a origem basica).
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "utm_source" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "utm_medium" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "utm_campaign" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "referrer_domain" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "utm_content" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "utm_term" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "gclid" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "fbclid" text;

COMMIT;

SELECT 'ok' AS resultado;
