-- ============================================================================
-- BIO FLORAIS B2B — 35b: página /parceiros (L3). Projeto Neon: bio-florais.
-- SOMENTE ADITIVO, idempotente, transação única. Rode o 35a antes. Nada existente é alterado.
--  * b2b_responsibles.referral_code: código curto (6 letras/números, sem revelar e-mail) do "Meu link de
--    captação" (/parceiros?v=<código>); único sem diferenciar maiúsculas; gerado aqui para quem já existe.
--  * b2b_clients.document/city/state/lead_source/lead_referral_code: dados do lojista captado pela página.
--  * O "vendedor da casa" fica em b2b_settings (key = 'house_responsible_id'), escolhido no admin.
-- ============================================================================
BEGIN;

ALTER TABLE b2b_responsibles ADD COLUMN IF NOT EXISTS referral_code text;
ALTER TABLE b2b_clients ADD COLUMN IF NOT EXISTS document text;
ALTER TABLE b2b_clients ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE b2b_clients ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE b2b_clients ADD COLUMN IF NOT EXISTS lead_source text;
ALTER TABLE b2b_clients ADD COLUMN IF NOT EXISTS lead_referral_code text;

CREATE UNIQUE INDEX IF NOT EXISTS b2b_responsibles_referral_code_uq
  ON b2b_responsibles (upper(referral_code)) WHERE referral_code IS NOT NULL;

-- Código para quem já existe (sem 0/O/1/I/L para não confundir no flyer); repete se colidir.
DO $$
DECLARE
  r record;
  candidate text;
BEGIN
  FOR r IN SELECT id FROM b2b_responsibles WHERE referral_code IS NULL LOOP
    LOOP
      candidate := '';
      FOR i IN 1..6 LOOP
        candidate := candidate || substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1);
      END LOOP;

      EXIT WHEN NOT EXISTS (SELECT 1 FROM b2b_responsibles WHERE upper(referral_code) = candidate);
    END LOOP;

    UPDATE b2b_responsibles SET referral_code = candidate WHERE id = r.id;
  END LOOP;
END $$;

COMMIT;
