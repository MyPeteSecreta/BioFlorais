-- ============================================================================
-- BIO FLORAIS — 49a: CONFERÊNCIA do acesso do lojista sem senha (/b2b/entrar, Rodada 19c). Projeto Neon: bio-florais.
-- SOMENTE LEITURA, uma linha JSON. Rode antes e depois do 49b.
-- ============================================================================
SELECT json_build_object(
  'tabela_acessos_existe', to_regclass('public.b2b_access_requests') IS NOT NULL,
  'pedidos_de_acesso_ultima_hora', CASE WHEN to_regclass('public.b2b_access_requests') IS NOT NULL
    THEN (xpath('/row/c/text()', query_to_xml('SELECT count(*) AS c FROM b2b_access_requests WHERE created_at > now() - interval ''1 hour''', false, true, '')))[1]::text::int
    ELSE 0 END,
  'clientes_ativos_com_email', (SELECT count(*) FROM b2b_clients WHERE active = true AND coalesce(btrim(email), '') <> ''),
  'pode_prosseguir', to_regclass('public.b2b_clients') IS NOT NULL
) AS conferencia_acesso_lojista;
