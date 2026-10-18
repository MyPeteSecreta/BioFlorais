-- ============================================================================
-- BIO FLORAIS — 44b: colunas da Image Tag do ChatGPT Ads (Rodada 12 v3). Projeto Neon: bio-florais.
-- SOMENTE ADITIVO, idempotente, transação única, linha final "ok". Rode o 44a antes e depois.
--  * orders.oppref          código de atribuição do anúncio (vem do cookie bio_oppref na criação do pedido)
--  * orders.ads_event_id    UUID aleatório do evento (NUNCA o número do pedido); mesmo id na fase 2 (API de Conversões)
--  * orders.ads_tag_sent_at "tag enviada": o pedido pago só entrega a tag UMA vez
-- Sem estas colunas a medição fica inerte (nada quebra). Nenhum dado existente é alterado.
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'oppref') THEN
    ALTER TABLE orders ADD COLUMN oppref text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'ads_event_id') THEN
    ALTER TABLE orders ADD COLUMN ads_event_id uuid;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'ads_tag_sent_at') THEN
    ALTER TABLE orders ADD COLUMN ads_tag_sent_at timestamptz;
  END IF;
END $$;

COMMIT;

SELECT 'ok' AS resultado;
