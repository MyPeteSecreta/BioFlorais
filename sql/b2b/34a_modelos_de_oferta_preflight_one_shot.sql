-- ============================================================================
-- BIO FLORAIS B2B — 34a: preflight dos modelos de oferta do vendedor ("Minhas ofertas padrão", L2)
-- Projeto Neon: bio-florais. SOMENTE LEITURA, uma consulta, uma linha JSON.
-- ============================================================================
SELECT json_build_object(
  'tabela_modelos_existe', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'b2b_offer_templates'),
  'vendedores_ativos', (SELECT count(*) FROM b2b_responsibles WHERE status = 'active'),
  'pode_prosseguir', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'b2b_responsibles')
) AS preflight_modelos_de_oferta;
