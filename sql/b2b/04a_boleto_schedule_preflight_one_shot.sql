-- ============================================================================
-- BIO FLORAIS B2B — VENCIMENTOS DO BOLETO: PREFLIGHT EM CONSULTA ÚNICA
-- ============================================================================
-- UM único SELECT, UMA linha, UMA coluna json. Somente leitura.
-- Rodar antes de 04b_boleto_schedule_candidate_if_not_exists.sql.
-- ============================================================================

SELECT json_build_object(

  'generated_at', now(),

  -- Fuso da sessão: os vencimentos usam orders.created_at (timestamp sem
  -- fuso) lido como UTC. Esperado: 'UTC' / 'Etc/UTC' (padrão do Neon).
  'session_timezone', current_setting('TimeZone'),

  -- Tabela e coluna nova.
  'boleto_requests_table_exists', to_regclass('public.b2b_boleto_requests') IS NOT NULL,
  'schedule_column', (
    SELECT json_build_object(
             'status', CASE WHEN count(*) = 0 THEN 'FALTANDO' ELSE 'ok' END,
             'data_type', max(data_type))
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'b2b_boleto_requests'
       AND column_name = 'schedule'
  ),

  -- Tipo de orders.created_at (esperado: timestamp without time zone).
  'orders_created_at_type', (
    SELECT data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'created_at'
  ),

  -- Solicitações de boleto já existentes (ficam sem cronograma até uma
  -- nova chamada da rota; o admin mostra "sem cronograma").
  'existing_boleto_requests', (
    SELECT json_build_object(
             'total', count(*),
             'by_status', coalesce(json_object_agg(status, n), '{}'::json))
      FROM (SELECT status, count(*) AS n FROM b2b_boleto_requests GROUP BY status) x
  )

) AS preflight_boleto_schedule;
