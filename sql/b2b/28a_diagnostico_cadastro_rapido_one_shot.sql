-- ============================================================================
-- BIO FLORAIS B2B — 28a: por que o cadastro rápido do vendedor falha (diagnóstico)
-- Projeto Neon: bio-florais. SOMENTE LEITURA, uma consulta, uma linha JSON.
-- Mostra as colunas de b2b_responsibles que são NOT NULL e SEM valor padrão e que o
-- cadastro rápido não preenche (nome, e-mail, WhatsApp, senha e tipo ele preenche),
-- e as constraints únicas/de verificação da tabela.
-- ============================================================================
SELECT json_build_object(
  'colunas_not_null_sem_default_que_o_cadastro_rapido_nao_envia', (
    SELECT coalesce(json_agg(column_name ORDER BY ordinal_position), '[]'::json)
      FROM information_schema.columns
     WHERE table_name = 'b2b_responsibles' AND is_nullable = 'NO' AND column_default IS NULL
       AND column_name NOT IN ('id', 'type', 'name', 'email')),
  'todas_as_colunas', (
    SELECT json_agg(json_build_object('coluna', column_name, 'tipo', data_type, 'not_null', is_nullable = 'NO',
                                      'default', column_default) ORDER BY ordinal_position)
      FROM information_schema.columns WHERE table_name = 'b2b_responsibles'),
  'constraints', (
    SELECT coalesce(json_agg(json_build_object('nome', conname, 'tipo', contype, 'definicao', pg_get_constraintdef(oid))), '[]'::json)
      FROM pg_constraint WHERE conrelid = 'b2b_responsibles'::regclass),
  'indices_unicos', (
    SELECT coalesce(json_agg(indexdef), '[]'::json) FROM pg_indexes
     WHERE tablename = 'b2b_responsibles' AND indexdef ILIKE '%UNIQUE%')
) AS diagnostico_cadastro_rapido;
