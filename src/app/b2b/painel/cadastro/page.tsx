/** Cadastro completo do vendedor (acessível durante o teste; no teste vencido o layout já mostra só esta tela). */

import CompleteProfileForm from "@/components/b2b/CompleteProfileForm";
import { requireResponsiblePage } from "@/lib/b2b/current-responsible";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { loadProfileSources } from "@/lib/central/central-client";
import { bannerText, loadVendorAccess } from "@/lib/b2b/vendor-profile";

export const dynamic = "force-dynamic";

export default async function CompleteProfilePage() {
  const responsible = await requireResponsiblePage();
  const run = getAppSqlRunner();
  const access = await loadVendorAccess(run, responsible.id);
  // V4: o e-mail vem do cadastro logado (nunca digitado), então ninguém consulta dados de outra pessoa.
  const [owner] = await run(`SELECT email FROM b2b_responsibles WHERE id = $1`, [responsible.id]);
  const sources = owner ? await loadProfileSources(String(owner.email)) : [];

  return <CompleteProfileForm requiresRcaTerms={responsible.type === "rca"} expired={access.state === "expired"} bannerText={bannerText(access)} sources={sources} />;
}
