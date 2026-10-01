-- ============================================================================
-- BIO FLORAIS B2B — 08b: tira o "BIO-B2B TEST GROUP <hex>" dos cards
-- Projeto Neon: bio-florais. Só UPDATE (sem DELETE), em BEGIN/COMMIT.
-- Mexe SOMENTE em b2b_commercial_groups (tabela B2B; o B2C não lê). Os
-- produtos continuam existindo e intactos. Reversível: active=true e
-- b2b_visible=true devolvem o grupo.
-- ============================================================================

-- 1) CONFERÊNCIA ANTES (rode primeiro e confira que só aparece o grupo de teste)
SELECT id, slug, name, active, b2b_visible
  FROM b2b_commercial_groups
 WHERE name ILIKE 'BIO-B2B TEST%' OR slug ILIKE 'bio-b2b-test%';

BEGIN;

SET LOCAL lock_timeout = '5s';

UPDATE b2b_commercial_groups
   SET active = false, b2b_visible = false, updated_at = now()
 WHERE (name ILIKE 'BIO-B2B TEST%' OR slug ILIKE 'bio-b2b-test%')
   AND (active OR b2b_visible);

-- 2) CONFERÊNCIA DEPOIS (esperado: active=false e b2b_visible=false em todos)
SELECT id, slug, name, active, b2b_visible
  FROM b2b_commercial_groups
 WHERE name ILIKE 'BIO-B2B TEST%' OR slug ILIKE 'bio-b2b-test%';

COMMIT;
