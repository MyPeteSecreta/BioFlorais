-- ============================================================================
-- BIO FLORAIS B2B — ADMIN: PREFLIGHT EM CONSULTA ÚNICA (somente leitura)
-- ============================================================================
-- UM único SELECT, UMA linha, UMA coluna json ("preflight_admin").
-- Não escreve nada. Rodar ANTES de 03b_admin_candidate_if_not_exists.sql.
-- Usa to_jsonb(linha) para ler colunas que talvez ainda não existam
-- (purpose, responsible_id, last_login_at) sem quebrar a consulta.
-- ============================================================================

SELECT json_build_object(

  'generated_at', now(),

  -- [A1] Colunas novas do admin: ok / FALTANDO.
  'a1_new_columns', (
    SELECT json_agg(json_build_object(
             'table_name', e.table_name,
             'column_name', e.column_name,
             'data_type', c.data_type,
             'is_nullable', c.is_nullable,
             'column_default', c.column_default,
             'status', CASE WHEN c.column_name IS NULL THEN 'FALTANDO' ELSE 'ok' END
           ) ORDER BY e.table_name, e.column_name)
      FROM (VALUES
        ('b2b_responsibles', 'last_login_at'),
        ('b2b_responsible_invites', 'purpose'),
        ('b2b_responsible_invites', 'responsible_id')
      ) AS e(table_name, column_name)
      LEFT JOIN information_schema.columns c
        ON c.table_schema = 'public'
       AND c.table_name = e.table_name
       AND c.column_name = e.column_name
  ),

  -- [A2] Colunas atuais das duas tabelas (tipo, nulabilidade, default).
  'a2_columns', (
    SELECT json_agg(json_build_object(
             'table_name', c.table_name,
             'column_name', c.column_name,
             'data_type', c.data_type,
             'is_nullable', c.is_nullable,
             'column_default', c.column_default
           ) ORDER BY c.table_name, c.ordinal_position)
      FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name IN ('b2b_responsibles', 'b2b_responsible_invites')
  ),

  -- [A3] Índices e constraints das duas tabelas.
  'a3_indexes', (
    SELECT coalesce(json_agg(json_build_object('table', i.tablename, 'name', i.indexname, 'def', i.indexdef)
                             ORDER BY i.tablename, i.indexname), '[]'::json)
      FROM pg_indexes i
     WHERE i.schemaname = 'public'
       AND i.tablename IN ('b2b_responsibles', 'b2b_responsible_invites')
  ),
  'a3_constraints', (
    SELECT coalesce(json_agg(json_build_object(
             'table', rel.relname, 'name', con.conname, 'type', con.contype,
             'def', pg_get_constraintdef(con.oid)) ORDER BY rel.relname, con.conname), '[]'::json)
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = rel.relnamespace
     WHERE ns.nspname = 'public'
       AND rel.relname IN ('b2b_responsibles', 'b2b_responsible_invites')
  ),

  -- [A4] Valores de tipo e status já gravados (o admin usa rca / clt e
  --      pending / active / inactive).
  'a4_responsible_type_status', (
    SELECT coalesce(json_agg(x), '[]'::json)
      FROM (SELECT type, status, count(*) AS total,
                   count(*) FILTER (WHERE company_approved_at IS NOT NULL) AS approved,
                   count(*) FILTER (WHERE password_hash IS NOT NULL) AS with_password
              FROM b2b_responsibles GROUP BY type, status ORDER BY type, status) x
  ),
  'a4_invite_type_status', (
    SELECT coalesce(json_agg(x), '[]'::json)
      FROM (SELECT responsible_type, status,
                   to_jsonb(i) ->> 'purpose' AS purpose,
                   count(*) AS total,
                   count(*) FILTER (WHERE expires_at < now()) AS expired
              FROM b2b_responsible_invites i
             GROUP BY 1, 2, 3 ORDER BY 1, 2, 3) x
  ),

  -- [A5] Duplicidades que quebrariam a busca case-insensitive de login
  --      e e-mail (esperado: []).
  'a5_duplicate_login_ci', (
    SELECT coalesce(json_agg(x), '[]'::json)
      FROM (SELECT lower(login) AS login, count(*) AS total
              FROM b2b_responsibles WHERE login IS NOT NULL
             GROUP BY 1 HAVING count(*) > 1) x
  ),
  'a5_duplicate_email_ci', (
    SELECT coalesce(json_agg(x), '[]'::json)
      FROM (SELECT lower(email) AS email, count(*) AS total
              FROM b2b_responsibles
             GROUP BY 1 HAVING count(*) > 1) x
  )

) AS preflight_admin;
