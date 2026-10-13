-- ============================================================================
-- BIO FLORAIS B2B — 38a: preflight do "Nome no Omie" padrão. Projeto Neon: bio-florais.
-- SOMENTE LEITURA, uma consulta, uma linha JSON. Mostra quantos vendedores REAIS estão sem o nome no Omie
-- (o 38b grava neles o nome do cadastro; demonstração fica de fora).
-- ============================================================================
SELECT json_build_object(
  'coluna_existe', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'b2b_responsibles' AND column_name = 'omie_vendor_code'),
  'vendedores_total', (SELECT count(*) FROM b2b_responsibles),
  'sem_nome_no_omie', (
    SELECT count(*) FROM b2b_responsibles
     WHERE COALESCE(to_jsonb(b2b_responsibles) ->> 'omie_vendor_code', '') = ''
       AND COALESCE(to_jsonb(b2b_responsibles) ->> 'is_demo', 'false') <> 'true'),
  'exemplos', (
    SELECT coalesce(json_agg(json_build_object('nome', name, 'sera_gravado', left(regexp_replace(btrim(name), '\s+', ' ', 'g'), 70))), '[]'::json)
      FROM (SELECT name FROM b2b_responsibles
             WHERE COALESCE(to_jsonb(b2b_responsibles) ->> 'omie_vendor_code', '') = ''
               AND COALESCE(to_jsonb(b2b_responsibles) ->> 'is_demo', 'false') <> 'true' LIMIT 10) s),
  'pode_prosseguir', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'b2b_responsibles' AND column_name = 'omie_vendor_code')
) AS preflight_omie_nome_padrao;
