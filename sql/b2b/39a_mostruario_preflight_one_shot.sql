-- ============================================================================
-- BIO FLORAIS B2B — 39a: preflight do MOSTRUÁRIO do vendedor/RCA. Projeto Neon: bio-florais.
-- SOMENTE LEITURA, uma consulta, uma linha JSON. Confere os pré-requisitos do 39b.
--  * b2b_settings (SQL 14b) guarda o % de preço e a janela de dias.
--  * orders.origin (SQL 37b) marca o pedido de mostruário (origin = 'mostruario').
-- As contagens usam query_to_xml (executa só se a tabela/coluna existe), então o preflight roda
-- ANTES do 39b sem erro de "relation does not exist".
-- ============================================================================
SELECT json_build_object(
  'b2b_settings_existe', to_regclass('public.b2b_settings') IS NOT NULL,
  'orders_origin_existe', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'origin'),
  'tabela_grupos_ja_existe', to_regclass('public.b2b_showcase_groups') IS NOT NULL,
  'grupos_atuais', CASE WHEN to_regclass('public.b2b_showcase_groups') IS NOT NULL
    THEN (xpath('/row/c/text()', query_to_xml('SELECT count(*) AS c FROM b2b_showcase_groups', false, true, '')))[1]::text::int
    ELSE 0 END,
  'pedidos_de_mostruario', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'origin')
    THEN (xpath('/row/c/text()', query_to_xml('SELECT count(*) AS c FROM orders WHERE origin = ''mostruario''', false, true, '')))[1]::text::int
    ELSE 0 END,
  'pode_prosseguir', to_regclass('public.b2b_settings') IS NOT NULL
                     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'origin')
) AS preflight_mostruario;
