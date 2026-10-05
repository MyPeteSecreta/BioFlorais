/** Cadastro completo do vendedor (acessível durante o teste; no teste vencido o layout já mostra só esta tela). */

import CompleteProfileForm from "@/components/b2b/CompleteProfileForm";
import { requireResponsiblePage } from "@/lib/b2b/current-responsible";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { bannerText, loadVendorAccess } from "@/lib/b2b/vendor-profile";

export const dynamic = "force-dynamic";

export default async function CompleteProfilePage() {
  const responsible = await requireResponsiblePage();
  const access = await loadVendorAccess(getAppSqlRunner(), responsible.id);

  return <CompleteProfileForm requiresRcaTerms={responsible.type === "rca"} expired={access.state === "expired"} bannerText={bannerText(access)} />;
}
