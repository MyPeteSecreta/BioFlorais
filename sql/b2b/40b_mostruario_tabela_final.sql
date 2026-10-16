-- ============================================================================
-- BIO FLORAIS B2B — 40b: MOSTRUÁRIO, tabela final do Luis (15/10). Projeto Neon: bio-florais.
-- ADITIVO e idempotente, transação única. Rode o 40a antes (39b já aplicado). NUNCA apaga grupo.
--  * b2b_showcase_line_caps: teto por LINHA (unidades na janela), editável no admin. Sem linha na tabela =
--    padrão do app (soma dos limites dos grupos da linha): Adulto 3, Pet 3, demais florais 2, Cosméticos 5,
--    Cosméticos Pet 4, Home Care 2 — já é a tabela final, então nada é semeado aqui.
--  * Ajusta o grupo de florais criado pelo 39b (só se ainda está como o seed: linhas originais) para cobrir
--    Infantil/Baby/Kids/Teen/Virtudes Divinas/Dose Única com 2 por linha; Adulto e Pet ganham grupos próprios (3).
--  * Home Care entra com 1 de cada tipo: Aromatizador Spray e Sabonete Líquido.
-- Grupos novos só são criados se o nome ainda não existe (admin que editou/renomeou não é sobrescrito).
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS b2b_showcase_line_caps (
  line_slug text PRIMARY KEY,
  cap_qty integer NOT NULL CHECK (cap_qty >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Florais: 2 por linha nas demais linhas (Adulto e Pet saem para grupos próprios com 3).
UPDATE b2b_showcase_groups
   SET name = 'Florais (por linha)',
       line_slugs = ARRAY['infantil','baby','kids','teen','virtudes-divinas','dose-unica'],
       categories = ARRAY['Floral em gotas','Floral dose única','Virtudes Divinas'],
       updated_at = now()
 WHERE line_slugs = ARRAY['adulto','infantil','baby','pet','kids','teen']
   AND per_line = true;

INSERT INTO b2b_showcase_groups (name, line_slugs, categories, name_includes, name_excludes, limit_qty, per_line, lowest_volume_only, active, sort_order)
SELECT v.name, v.line_slugs, v.categories, ARRAY[]::text[], ARRAY[]::text[], v.limit_qty, false, v.lowest_volume_only, true, v.sort_order
  FROM (VALUES
    ('Florais · Adulto',              ARRAY['adulto'],    ARRAY['Floral em gotas'],     3, false, 9),
    ('Florais · Pet',                 ARRAY['pet'],       ARRAY['Floral em gotas'],     3, false, 9),
    ('Home Care · Aromatizador',      ARRAY['home-care'], ARRAY['Aromatizador Spray'],  1, true,  40),
    ('Home Care · Sabonete líquido',  ARRAY['home-care'], ARRAY['Sabonete Líquido'],    1, true,  41)
  ) AS v(name, line_slugs, categories, limit_qty, lowest_volume_only, sort_order)
 WHERE NOT EXISTS (SELECT 1 FROM b2b_showcase_groups g WHERE g.name = v.name);

COMMIT;
