-- ============================================================================
-- BIO FLORAIS B2B — 12a: diagnóstico de texto quebrado (SOMENTE LEITURA, uma linha JSON)
-- Projeto Neon: bio-florais. Corrige texto com encoding quebrado (mojibake)
-- trocando as sequências típicas ("Ã§"->ç, "Ã£"->ã, "â€”"->—, "Â·"->·...).
-- ============================================================================
WITH suspeitos AS (
  SELECT 'b2b_promotions' AS tabela, id::text AS id, 'name' AS campo, name AS texto FROM b2b_promotions
  UNION ALL SELECT 'b2b_commercial_groups' AS tabela, id::text AS id, 'name' AS campo, name AS texto FROM b2b_commercial_groups
  UNION ALL SELECT 'b2b_clients' AS tabela, id::text AS id, 'display_name' AS campo, display_name AS texto FROM b2b_clients
  UNION ALL SELECT 'b2b_responsibles' AS tabela, id::text AS id, 'name' AS campo, name AS texto FROM b2b_responsibles
)
SELECT json_build_object(
  'achados', (
    SELECT coalesce(json_agg(json_build_object('tabela', tabela, 'id', id, 'campo', campo, 'texto', texto,
             'corrigido', replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(texto, 'Ã§', 'ç'), 'Ã£', 'ã'), 'Ã©', 'é'), 'Ã¡', 'á'), 'Ãª', 'ê'), 'Ã³', 'ó'), 'Ãº', 'ú'), 'Ã­', 'í'), 'Ãµ', 'õ'), 'Ã´', 'ô'), 'Ã¢', 'â'), 'Ã ', 'à'), 'Ã‡', 'Ç'), 'Ãƒ', 'Ã'), 'â€”', '—'), 'â€“', '–'), 'Â·', '·'), 'Â ', ''))), '[]'::json)
      FROM suspeitos
     WHERE texto ~ '(Ã|â€|Â)'
  ),
  'total_verificado', (SELECT count(*) FROM suspeitos)
) AS diagnostico_texto_quebrado;
