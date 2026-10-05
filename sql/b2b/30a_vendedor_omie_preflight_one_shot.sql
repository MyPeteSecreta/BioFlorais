-- ============================================================================
-- BIO FLORAIS B2B — 30a: preflight do "Vendedor no Omie"
-- Projeto Neon: bio-florais. SOMENTE LEITURA, uma consulta, uma linha JSON.
-- Mostra se a coluna b2b_responsibles.omie_vendor_code já existe e quantos vendedores
-- ativos existem (todos precisarão do nome no Omie para o pedido B2B ser exportado).
-- ============================================================================
SELECT json_build_object(
  'coluna_omie_vendor_code_existe', EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'b2b_responsibles' AND column_name = 'omie_vendor_code'),
  'vendedores_ativos', (SELECT count(*) FROM b2b_responsibles WHERE status = 'active'),
  'pode_prosseguir', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'b2b_responsibles')
) AS preflight_vendedor_omie;
