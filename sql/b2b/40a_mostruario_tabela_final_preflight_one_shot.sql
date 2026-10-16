-- ============================================================================
-- BIO FLORAIS B2B — 40a: preflight do ajuste do MOSTRUÁRIO (tabela final do Luis 15/10). Projeto Neon: bio-florais.
-- SOMENTE LEITURA, uma consulta, uma linha JSON. Exige o 39b já aplicado. Roda antes do 40b sem erro.
-- ============================================================================
SELECT json_build_object(
  'grupos_39b_existem', to_regclass('public.b2b_showcase_groups') IS NOT NULL,
  'tabela_tetos_ja_existe', to_regclass('public.b2b_showcase_line_caps') IS NOT NULL,
  'grupos_total', CASE WHEN to_regclass('public.b2b_showcase_groups') IS NOT NULL
    THEN (xpath('/row/c/text()', query_to_xml('SELECT count(*) AS c FROM b2b_showcase_groups', false, true, '')))[1]::text::int
    ELSE 0 END,
  'florais_seed_original_a_ajustar', CASE WHEN to_regclass('public.b2b_showcase_groups') IS NOT NULL
    THEN (xpath('/row/c/text()', query_to_xml($q$SELECT count(*) AS c FROM b2b_showcase_groups
        WHERE line_slugs = ARRAY['adulto','infantil','baby','pet','kids','teen']$q$, false, true, '')))[1]::text::int
    ELSE 0 END,
  'grupos_novos_ja_existentes', CASE WHEN to_regclass('public.b2b_showcase_groups') IS NOT NULL
    THEN (xpath('/row/c/text()', query_to_xml($q$SELECT count(*) AS c FROM b2b_showcase_groups
        WHERE name IN ('Florais · Adulto','Florais · Pet','Home Care · Aromatizador','Home Care · Sabonete líquido')$q$, false, true, '')))[1]::text::int
    ELSE 0 END,
  'pode_prosseguir', to_regclass('public.b2b_showcase_groups') IS NOT NULL
) AS preflight_mostruario_tabela_final;
