-- ============================================================================
-- BIO FLORAIS B2B — 08c: desativa SÓ o vendedor e o cliente de teste vazados
-- Projeto Neon: bio-florais. Só UPDATE (sem DELETE), em BEGIN/COMMIT, pelo
-- id exato. Não toca em ClienteTesteB2, Teste4, Bio-B2B-2 Test nem
-- Bio-B2B-Test5 (testes manuais do Luis). Reversível: status='active' e
-- active=true devolvem os registros.
-- ============================================================================

-- 1) CONFERÊNCIA ANTES (esperado: 1 vendedor e 1 cliente, ambos ativos)
SELECT 'vendedor' AS tipo, id, name, email, status::text AS situacao
  FROM b2b_responsibles WHERE id = 'dcb67a56-cadf-4cce-ab46-86fb1285f288'
UNION ALL
SELECT 'cliente', id, display_name, email, CASE WHEN active THEN 'active' ELSE 'inactive' END
  FROM b2b_clients WHERE id = '1d403746-7519-454e-a9e6-32408d62d1ec';

BEGIN;

SET LOCAL lock_timeout = '5s';

UPDATE b2b_responsibles
   SET status = 'inactive', updated_at = now()
 WHERE id = 'dcb67a56-cadf-4cce-ab46-86fb1285f288';

UPDATE b2b_clients
   SET active = false, updated_at = now()
 WHERE id = '1d403746-7519-454e-a9e6-32408d62d1ec';

-- 2) CONFERÊNCIA DEPOIS (esperado: vendedor 'inactive' e cliente 'inactive')
SELECT 'vendedor' AS tipo, id, name, email, status::text AS situacao
  FROM b2b_responsibles WHERE id = 'dcb67a56-cadf-4cce-ab46-86fb1285f288'
UNION ALL
SELECT 'cliente', id, display_name, email, CASE WHEN active THEN 'active' ELSE 'inactive' END
  FROM b2b_clients WHERE id = '1d403746-7519-454e-a9e6-32408d62d1ec';

COMMIT;
