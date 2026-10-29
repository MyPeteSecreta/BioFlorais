-- ============================================================================
-- BIO FLORAIS — 54b: nome "Rescue SOS" -> "S.O.S." nos produtos de cosméticos, home care e cosméticos pet (o catálogo do código já
-- usa "S.O.S."). Projeto Neon: bio-florais. Aditivo/idempotente, transação única, só muda o NOME dos produtos que hoje se chamam
-- exatamente "Rescue SOS" (nada de slug, preço, estoque ou peso). O peso do frete dos cremes para mãos NÃO é alterado aqui: confira
-- com o 54a e ajuste por SQL à parte, se estiver diferente do real.
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

UPDATE products SET name = 'S.O.S.' WHERE name = 'Rescue SOS';

SELECT count(*) AS ainda_rescue_sos FROM products WHERE name = 'Rescue SOS';

COMMIT;
