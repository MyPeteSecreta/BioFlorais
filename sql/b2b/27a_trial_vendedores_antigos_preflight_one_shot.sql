-- ============================================================================
-- BIO FLORAIS B2B — 27a: preflight do teste para vendedores antigos INCOMPLETOS
-- Projeto Neon: bio-florais. SOMENTE LEITURA, uma consulta, uma linha JSON.
-- Lista quem receberia trial_ends_at = agora + 7 dias no 27b: sem prazo ainda,
-- sem cadastro completo e SEM documento+CEP+Pix.
-- ============================================================================
SELECT json_build_object(
  'colunas_do_26b_existem', (
    SELECT count(*) = 2 FROM information_schema.columns
     WHERE table_name = 'b2b_responsibles' AND column_name IN ('trial_ends_at', 'profile_completed_at')),
  'receberiam_prazo', (
    SELECT coalesce(json_agg(json_build_object('id', id, 'name', name, 'status', status, 'tipo', type,
             'tem_documento', (cpf IS NOT NULL OR cnpj IS NOT NULL), 'tem_cep', postal_code IS NOT NULL,
             'tem_pix', coalesce(pix_key, '') <> '') ORDER BY name), '[]'::json)
      FROM b2b_responsibles
     WHERE trial_ends_at IS NULL AND profile_completed_at IS NULL
       AND NOT ((cpf IS NOT NULL OR cnpj IS NOT NULL) AND postal_code IS NOT NULL AND coalesce(pix_key, '') <> '')),
  'ja_completos', (SELECT count(*) FROM b2b_responsibles WHERE profile_completed_at IS NOT NULL),
  'ja_em_teste', (SELECT count(*) FROM b2b_responsibles WHERE trial_ends_at IS NOT NULL)
) AS preflight_trial_antigos;
