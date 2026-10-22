-- ============================================================================
-- BIO FLORAIS — 47a: CONFERÊNCIA da edição de clientes no admin (Rodada 19b). Projeto Neon: bio-florais.
-- SOMENTE LEITURA, uma linha JSON. Rode antes e depois do 47b.
-- ============================================================================
SELECT json_build_object(
  'tabela_b2b_clients_existe', to_regclass('public.b2b_clients') IS NOT NULL,
  'clientes', CASE WHEN to_regclass('public.b2b_clients') IS NOT NULL
    THEN (xpath('/row/c/text()', query_to_xml('SELECT count(*) AS c FROM b2b_clients', false, true, '')))[1]::text::int ELSE 0 END,
  'colunas_cadastro_existentes', (SELECT count(*) FROM information_schema.columns
      WHERE table_name = 'b2b_clients' AND column_name IN ('document', 'city', 'state', 'postal_code', 'street', 'address_number', 'address_complement', 'neighborhood')),
  'colunas_cadastro_esperadas', 8,
  'tabela_historico_existe', to_regclass('public.b2b_client_edits') IS NOT NULL,
  'edicoes_registradas', CASE WHEN to_regclass('public.b2b_client_edits') IS NOT NULL
    THEN (xpath('/row/c/text()', query_to_xml('SELECT count(*) AS c FROM b2b_client_edits', false, true, '')))[1]::text::int ELSE 0 END,
  'pode_prosseguir', to_regclass('public.b2b_clients') IS NOT NULL
) AS conferencia_clientes_edicao;
