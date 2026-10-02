-- ============================================================================
-- BIO FLORAIS B2B — 12b: corrige o texto quebrado (UPDATE por linha, BEGIN/COMMIT, antes/depois)
-- Projeto Neon: bio-florais. Corrige texto com encoding quebrado (mojibake)
-- trocando as sequências típicas ("Ã§"->ç, "Ã£"->ã, "â€”"->—, "Â·"->·...).
-- ============================================================================
-- Rode DEPOIS do 12a e confira 'corrigido'. Só altera linha cujo resultado fica
-- sem Ã/â€/Â. Nada é apagado.

-- ANTES
SELECT 'b2b_promotions' AS tabela, id, name AS atual, replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(name, 'Ã§', 'ç'), 'Ã£', 'ã'), 'Ã©', 'é'), 'Ã¡', 'á'), 'Ãª', 'ê'), 'Ã³', 'ó'), 'Ãº', 'ú'), 'Ã­', 'í'), 'Ãµ', 'õ'), 'Ã´', 'ô'), 'Ã¢', 'â'), 'Ã ', 'à'), 'Ã‡', 'Ç'), 'Ãƒ', 'Ã'), 'â€”', '—'), 'â€“', '–'), 'Â·', '·'), 'Â ', '') AS corrigido FROM b2b_promotions WHERE name ~ '(Ã|â€|Â)'
UNION ALL
SELECT 'b2b_commercial_groups' AS tabela, id, name AS atual, replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(name, 'Ã§', 'ç'), 'Ã£', 'ã'), 'Ã©', 'é'), 'Ã¡', 'á'), 'Ãª', 'ê'), 'Ã³', 'ó'), 'Ãº', 'ú'), 'Ã­', 'í'), 'Ãµ', 'õ'), 'Ã´', 'ô'), 'Ã¢', 'â'), 'Ã ', 'à'), 'Ã‡', 'Ç'), 'Ãƒ', 'Ã'), 'â€”', '—'), 'â€“', '–'), 'Â·', '·'), 'Â ', '') AS corrigido FROM b2b_commercial_groups WHERE name ~ '(Ã|â€|Â)'
UNION ALL
SELECT 'b2b_clients' AS tabela, id, display_name AS atual, replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(display_name, 'Ã§', 'ç'), 'Ã£', 'ã'), 'Ã©', 'é'), 'Ã¡', 'á'), 'Ãª', 'ê'), 'Ã³', 'ó'), 'Ãº', 'ú'), 'Ã­', 'í'), 'Ãµ', 'õ'), 'Ã´', 'ô'), 'Ã¢', 'â'), 'Ã ', 'à'), 'Ã‡', 'Ç'), 'Ãƒ', 'Ã'), 'â€”', '—'), 'â€“', '–'), 'Â·', '·'), 'Â ', '') AS corrigido FROM b2b_clients WHERE display_name ~ '(Ã|â€|Â)'
UNION ALL
SELECT 'b2b_responsibles' AS tabela, id, name AS atual, replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(name, 'Ã§', 'ç'), 'Ã£', 'ã'), 'Ã©', 'é'), 'Ã¡', 'á'), 'Ãª', 'ê'), 'Ã³', 'ó'), 'Ãº', 'ú'), 'Ã­', 'í'), 'Ãµ', 'õ'), 'Ã´', 'ô'), 'Ã¢', 'â'), 'Ã ', 'à'), 'Ã‡', 'Ç'), 'Ãƒ', 'Ã'), 'â€”', '—'), 'â€“', '–'), 'Â·', '·'), 'Â ', '') AS corrigido FROM b2b_responsibles WHERE name ~ '(Ã|â€|Â)';

BEGIN;
SET LOCAL lock_timeout = '5s';

UPDATE b2b_promotions
   SET name = replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(name, 'Ã§', 'ç'), 'Ã£', 'ã'), 'Ã©', 'é'), 'Ã¡', 'á'), 'Ãª', 'ê'), 'Ã³', 'ó'), 'Ãº', 'ú'), 'Ã­', 'í'), 'Ãµ', 'õ'), 'Ã´', 'ô'), 'Ã¢', 'â'), 'Ã ', 'à'), 'Ã‡', 'Ç'), 'Ãƒ', 'Ã'), 'â€”', '—'), 'â€“', '–'), 'Â·', '·'), 'Â ', ''), updated_at = now()
 WHERE name ~ '(Ã|â€|Â)'
   AND replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(name, 'Ã§', 'ç'), 'Ã£', 'ã'), 'Ã©', 'é'), 'Ã¡', 'á'), 'Ãª', 'ê'), 'Ã³', 'ó'), 'Ãº', 'ú'), 'Ã­', 'í'), 'Ãµ', 'õ'), 'Ã´', 'ô'), 'Ã¢', 'â'), 'Ã ', 'à'), 'Ã‡', 'Ç'), 'Ãƒ', 'Ã'), 'â€”', '—'), 'â€“', '–'), 'Â·', '·'), 'Â ', '') !~ '(Ã|â€|Â)';

UPDATE b2b_commercial_groups
   SET name = replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(name, 'Ã§', 'ç'), 'Ã£', 'ã'), 'Ã©', 'é'), 'Ã¡', 'á'), 'Ãª', 'ê'), 'Ã³', 'ó'), 'Ãº', 'ú'), 'Ã­', 'í'), 'Ãµ', 'õ'), 'Ã´', 'ô'), 'Ã¢', 'â'), 'Ã ', 'à'), 'Ã‡', 'Ç'), 'Ãƒ', 'Ã'), 'â€”', '—'), 'â€“', '–'), 'Â·', '·'), 'Â ', ''), updated_at = now()
 WHERE name ~ '(Ã|â€|Â)'
   AND replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(name, 'Ã§', 'ç'), 'Ã£', 'ã'), 'Ã©', 'é'), 'Ã¡', 'á'), 'Ãª', 'ê'), 'Ã³', 'ó'), 'Ãº', 'ú'), 'Ã­', 'í'), 'Ãµ', 'õ'), 'Ã´', 'ô'), 'Ã¢', 'â'), 'Ã ', 'à'), 'Ã‡', 'Ç'), 'Ãƒ', 'Ã'), 'â€”', '—'), 'â€“', '–'), 'Â·', '·'), 'Â ', '') !~ '(Ã|â€|Â)';

UPDATE b2b_clients
   SET display_name = replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(display_name, 'Ã§', 'ç'), 'Ã£', 'ã'), 'Ã©', 'é'), 'Ã¡', 'á'), 'Ãª', 'ê'), 'Ã³', 'ó'), 'Ãº', 'ú'), 'Ã­', 'í'), 'Ãµ', 'õ'), 'Ã´', 'ô'), 'Ã¢', 'â'), 'Ã ', 'à'), 'Ã‡', 'Ç'), 'Ãƒ', 'Ã'), 'â€”', '—'), 'â€“', '–'), 'Â·', '·'), 'Â ', ''), updated_at = now()
 WHERE display_name ~ '(Ã|â€|Â)'
   AND replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(display_name, 'Ã§', 'ç'), 'Ã£', 'ã'), 'Ã©', 'é'), 'Ã¡', 'á'), 'Ãª', 'ê'), 'Ã³', 'ó'), 'Ãº', 'ú'), 'Ã­', 'í'), 'Ãµ', 'õ'), 'Ã´', 'ô'), 'Ã¢', 'â'), 'Ã ', 'à'), 'Ã‡', 'Ç'), 'Ãƒ', 'Ã'), 'â€”', '—'), 'â€“', '–'), 'Â·', '·'), 'Â ', '') !~ '(Ã|â€|Â)';

UPDATE b2b_responsibles
   SET name = replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(name, 'Ã§', 'ç'), 'Ã£', 'ã'), 'Ã©', 'é'), 'Ã¡', 'á'), 'Ãª', 'ê'), 'Ã³', 'ó'), 'Ãº', 'ú'), 'Ã­', 'í'), 'Ãµ', 'õ'), 'Ã´', 'ô'), 'Ã¢', 'â'), 'Ã ', 'à'), 'Ã‡', 'Ç'), 'Ãƒ', 'Ã'), 'â€”', '—'), 'â€“', '–'), 'Â·', '·'), 'Â ', ''), updated_at = now()
 WHERE name ~ '(Ã|â€|Â)'
   AND replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(name, 'Ã§', 'ç'), 'Ã£', 'ã'), 'Ã©', 'é'), 'Ã¡', 'á'), 'Ãª', 'ê'), 'Ã³', 'ó'), 'Ãº', 'ú'), 'Ã­', 'í'), 'Ãµ', 'õ'), 'Ã´', 'ô'), 'Ã¢', 'â'), 'Ã ', 'à'), 'Ã‡', 'Ç'), 'Ãƒ', 'Ã'), 'â€”', '—'), 'â€“', '–'), 'Â·', '·'), 'Â ', '') !~ '(Ã|â€|Â)';

-- DEPOIS (esperado: vazio)
SELECT 'b2b_promotions' AS tabela, id, name AS ainda_quebrado FROM b2b_promotions WHERE name ~ '(Ã|â€|Â)'
UNION ALL
SELECT 'b2b_commercial_groups' AS tabela, id, name AS ainda_quebrado FROM b2b_commercial_groups WHERE name ~ '(Ã|â€|Â)'
UNION ALL
SELECT 'b2b_clients' AS tabela, id, display_name AS ainda_quebrado FROM b2b_clients WHERE display_name ~ '(Ã|â€|Â)'
UNION ALL
SELECT 'b2b_responsibles' AS tabela, id, name AS ainda_quebrado FROM b2b_responsibles WHERE name ~ '(Ã|â€|Â)';

COMMIT;
