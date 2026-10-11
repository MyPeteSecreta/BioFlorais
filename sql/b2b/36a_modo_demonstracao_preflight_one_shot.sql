-- ============================================================================
-- BIO FLORAIS B2B — 36a: preflight do MODO DEMONSTRAÇÃO. Projeto Neon: bio-florais.
-- SOMENTE LEITURA, uma consulta, uma linha JSON.
-- ============================================================================
SELECT json_build_object(
  'colunas_existem', (
    SELECT count(*) = 3 FROM information_schema.columns
     WHERE table_name = 'b2b_responsibles' AND column_name IN ('is_demo', 'demo_expires_at', 'demo_link_id')),
  'tabelas_existem', (
    SELECT count(*) = 2 FROM information_schema.tables WHERE table_name IN ('b2b_demo_links', 'b2b_demo_creations')),
  'vendedores_total', (SELECT count(*) FROM b2b_responsibles),
  'tabelas_de_limpeza', (
    SELECT coalesce(json_agg(table_name ORDER BY table_name), '[]'::json) FROM information_schema.tables
     WHERE table_name IN ('b2b_offers', 'b2b_offer_links', 'b2b_offer_promotions', 'b2b_offer_commercial_groups',
                          'b2b_offer_line_views', 'b2b_commission_rules', 'b2b_offer_templates', 'b2b_client_relationships', 'b2b_clients')),
  'pode_prosseguir', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'b2b_responsibles')
) AS preflight_modo_demonstracao;
