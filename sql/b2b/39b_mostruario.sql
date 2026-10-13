-- ============================================================================
-- BIO FLORAIS B2B — 39b: MOSTRUÁRIO do vendedor/RCA. Projeto Neon: bio-florais.
-- SOMENTE ADITIVO, idempotente, transação única. Rode o 39a antes (37b e 14b já aplicados).
--  * b2b_showcase_groups: grupos do mostruário (nome, linhas/categorias/nomes que entram, limite por janela,
--    "por linha", "só menor volume", ativo). Linha nova NÃO entra: só entra o que o admin listar.
--  * b2b_settings: showcase_price_percent (15) e showcase_window_days (45), só se ainda não existem.
--  * Seed dos grupos da Bio (só se a tabela está vazia). Condicionador fica FORA em todo lugar (regra no app).
-- Nenhum DROP/DELETE/UPDATE em dado existente. O pedido de mostruário usa orders.origin = 'mostruario' (37b).
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS b2b_showcase_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  line_slugs text[] NOT NULL DEFAULT '{}',
  categories text[] NOT NULL DEFAULT '{}',
  name_includes text[] NOT NULL DEFAULT '{}',
  name_excludes text[] NOT NULL DEFAULT '{}',
  limit_qty integer NOT NULL DEFAULT 1 CHECK (limit_qty >= 0),
  per_line boolean NOT NULL DEFAULT false,
  lowest_volume_only boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS b2b_showcase_groups_active_idx ON b2b_showcase_groups (active, sort_order);

INSERT INTO b2b_settings (key, value)
SELECT 'showcase_price_percent', '15'
 WHERE NOT EXISTS (SELECT 1 FROM b2b_settings WHERE key = 'showcase_price_percent');

INSERT INTO b2b_settings (key, value)
SELECT 'showcase_window_days', '45'
 WHERE NOT EXISTS (SELECT 1 FROM b2b_settings WHERE key = 'showcase_window_days');

INSERT INTO b2b_showcase_groups (name, line_slugs, categories, name_includes, name_excludes, limit_qty, per_line, lowest_volume_only, active, sort_order)
SELECT v.name, v.line_slugs, v.categories, v.name_includes, v.name_excludes, v.limit_qty, v.per_line, v.lowest_volume_only, true, v.sort_order
  FROM (VALUES
    ('Florais (até 2 por linha)',  ARRAY['adulto','infantil','baby','pet','kids','teen'], ARRAY['Floral em gotas'], ARRAY[]::text[],          ARRAY[]::text[],          2, true,  false, 10),
    ('Shampoo Murumuru',           ARRAY['cosmeticos'],     ARRAY['Shampoo'],            ARRAY['muru muru'],       ARRAY[]::text[],          1, false, true,  20),
    ('Shampoo (humano)',           ARRAY['cosmeticos'],     ARRAY['Shampoo'],            ARRAY[]::text[],          ARRAY['muru muru'],       1, false, true,  21),
    ('Creme de mãos',              ARRAY['cosmeticos'],     ARRAY['Creme Mãos'],         ARRAY[]::text[],          ARRAY[]::text[],          1, false, true,  22),
    ('Creme corporal',             ARRAY['cosmeticos'],     ARRAY['Creme Corpo'],        ARRAY[]::text[],          ARRAY[]::text[],          1, false, true,  23),
    ('Sabonete líquido',           ARRAY['cosmeticos'],     ARRAY['Sabonete Líquido'],   ARRAY[]::text[],          ARRAY[]::text[],          1, false, true,  24),
    ('Pet · Shampoo',              ARRAY['cosmeticos-pet'], ARRAY['Shampoo'],            ARRAY[]::text[],          ARRAY[]::text[],          1, false, true,  30),
    ('Pet · Perfume',              ARRAY['cosmeticos-pet'], ARRAY['Perfume Spray'],      ARRAY[]::text[],          ARRAY[]::text[],          1, false, true,  31),
    ('Pet · Floral de ambiente',   ARRAY['cosmeticos-pet'], ARRAY['Floral de Ambiente'], ARRAY[]::text[],          ARRAY[]::text[],          1, false, true,  32),
    ('Pet · Spray para hálito',    ARRAY['cosmeticos-pet'], ARRAY['Higiene Oral'],       ARRAY['hálito'],          ARRAY[]::text[],          1, false, true,  33)
  ) AS v(name, line_slugs, categories, name_includes, name_excludes, limit_qty, per_line, lowest_volume_only, sort_order)
 WHERE NOT EXISTS (SELECT 1 FROM b2b_showcase_groups);

COMMIT;
