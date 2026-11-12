-- ============================================================================
-- BIO FLORAIS — 56a: CONFERÊNCIA (one-shot, SÓ LEITURA) antes do 56b (carrinho abandonado). Projeto Neon: bio-florais.
-- Não altera nada. Mostra se a tabela já existe e se as tabelas que o recurso usa estão lá.
-- ============================================================================
SELECT
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cart_recoveries') AS cart_recoveries_ja_existe,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'coupons') AS coupons_existe,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'b2b_settings') AS b2b_settings_existe,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'gen_random_uuid') AS gen_random_uuid_disponivel;
