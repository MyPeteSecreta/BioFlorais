-- ============================================================================
-- BIO FLORAIS B2B — 26a: preflight do período de teste do vendedor
-- Projeto Neon: bio-florais. SOMENTE LEITURA, uma consulta, uma linha JSON.
-- Mostra se as colunas do 26b já existem, quantos vendedores o 26b marcará como
-- "cadastro completo" (têm documento, endereço e Pix) e quais ficarão de fora.
-- ============================================================================
SELECT json_build_object(
  'colunas_ja_existem', (
    SELECT coalesce(json_object_agg(column_name, true), '{}'::json) FROM information_schema.columns
     WHERE table_name = 'b2b_responsibles'
       AND column_name IN ('trial_ends_at', 'profile_completed_at', 'rca_terms_accepted_ip', 'rca_terms_version')),
  'colunas_necessarias_existem', (
    SELECT count(*) = 8 FROM information_schema.columns
     WHERE table_name = 'b2b_responsibles'
       AND column_name IN ('cpf', 'cnpj', 'postal_code', 'pix_key', 'onboarding_completed_at', 'company_approved_at', 'rca_terms_accepted_at', 'created_at')),
  'vendedores_total', (SELECT count(*) FROM b2b_responsibles),
  'seriam_marcados_completos', (
    SELECT count(*) FROM b2b_responsibles
     WHERE (cpf IS NOT NULL OR cnpj IS NOT NULL) AND postal_code IS NOT NULL AND coalesce(pix_key, '') <> ''),
  'ficariam_fora', (
    SELECT coalesce(json_agg(json_build_object('id', id, 'name', name, 'status', status)), '[]'::json)
      FROM b2b_responsibles
     WHERE NOT ((cpf IS NOT NULL OR cnpj IS NOT NULL) AND postal_code IS NOT NULL AND coalesce(pix_key, '') <> ''))
) AS preflight_trial_vendedor;
