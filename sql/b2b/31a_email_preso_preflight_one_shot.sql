-- ============================================================================
-- BIO FLORAIS B2B — 31a: preflight do "e-mail preso" (V2)
-- Projeto Neon: bio-florais. SOMENTE LEITURA, uma consulta, uma linha JSON.
-- Mostra se as colunas de histórico já existem e quais vendedores NÃO ativos ainda seguram um e-mail
-- (candidatos a "Desativar e liberar e-mail"). Nada é alterado.
-- ============================================================================
SELECT json_build_object(
  'colunas_existem', (
    SELECT count(*) = 3 FROM information_schema.columns
     WHERE table_name = 'b2b_responsibles' AND column_name IN ('email_original', 'login_original', 'released_at')),
  'vendedores_total', (SELECT count(*) FROM b2b_responsibles),
  'inativos_segurando_email', (
    SELECT coalesce(json_agg(json_build_object('id', id, 'nome', name, 'email', email, 'status', status) ORDER BY created_at), '[]'::json)
      FROM b2b_responsibles WHERE status <> 'active' AND email NOT LIKE 'liberado+%@invalid'),
  'convites_pendentes_vencidos', (
    SELECT count(*) FROM b2b_responsible_invites WHERE status = 'pending' AND expires_at < now()),
  'pode_prosseguir', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'b2b_responsibles')
) AS preflight_email_preso;
