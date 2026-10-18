-- ============================================================================
-- BIO FLORAIS B2B — 42b: renomeia o Kit Provador It's Blossom para "Kit Provador Aromatizador It's Blossom" (linha Home
-- Care, aromatizadores). Projeto Neon: bio-florais. ADITIVO/idempotente, transação única, linha final "ok".
-- Só mexe em products.name do produto INTERNO bio-prov-itsblossom (criado pelo 41b). O código BIO-PROV-ITSBLOSSOM e o
-- BIO-PROV-AMBPET não mudam. Pet 13 un., Dose Única 12 e Baby 22 são regra do app (sem SQL). Rode o 42a antes e depois.
-- Quem ainda não rodou o 41b não precisa do 42b (o 41b já cria com o nome novo; este UPDATE não acha nada e segue).
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

UPDATE products
   SET name = 'Kit Provador Aromatizador It''s Blossom · BIO-PROV-ITSBLOSSOM'
 WHERE slug = 'bio-prov-itsblossom'
   AND name <> 'Kit Provador Aromatizador It''s Blossom · BIO-PROV-ITSBLOSSOM';

COMMIT;

SELECT 'ok' AS resultado;
