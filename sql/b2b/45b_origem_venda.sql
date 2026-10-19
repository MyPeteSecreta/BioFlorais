-- ============================================================================
-- BIO FLORAIS — 45b: origem da venda em todo pedido (Rodada 17). Projeto Neon: bio-florais.
-- SOMENTE ADITIVO, idempotente, transação única, linha final "ok". Rode o 45a antes e depois.
--  * orders.utm_source / utm_medium / utm_campaign   da primeira visita (cookie bio_origem, first-touch, 30 dias)
--  * orders.referrer_domain                          só o domínio do site de origem (ex.: google.com)
-- Nenhum dado pessoal. Sem estas colunas a origem fica inerte (nada quebra). Nenhum dado existente é alterado.
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

DO $$
DECLARE
  col text;
BEGIN
  FOREACH col IN ARRAY ARRAY['utm_source', 'utm_medium', 'utm_campaign', 'referrer_domain'] LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = col) THEN
      EXECUTE format('ALTER TABLE orders ADD COLUMN %I text', col);
    END IF;
  END LOOP;
END $$;

COMMIT;

SELECT 'ok' AS resultado;
