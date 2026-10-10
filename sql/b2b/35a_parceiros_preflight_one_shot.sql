-- ============================================================================
-- BIO FLORAIS B2B — 35a: preflight da página /parceiros (L3): código de captação do vendedor,
-- vendedor da casa e dados do lojista captado. Projeto Neon: bio-florais. SOMENTE LEITURA, uma linha JSON.
-- ============================================================================
SELECT json_build_object(
  'colunas_existem', (
    SELECT count(*) = 6 FROM information_schema.columns
     WHERE (table_name, column_name) IN (('b2b_responsibles','referral_code'), ('b2b_clients','document'), ('b2b_clients','city'),
                                         ('b2b_clients','state'), ('b2b_clients','lead_source'), ('b2b_clients','lead_referral_code'))),
  'vendedores_ativos', (SELECT count(*) FROM b2b_responsibles WHERE status = 'active'),
  'settings_existe', to_regclass('public.b2b_settings') IS NOT NULL,
  'pode_prosseguir', to_regclass('public.b2b_settings') IS NOT NULL
) AS preflight_parceiros;
