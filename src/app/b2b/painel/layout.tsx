import Link from "next/link";
import type { ReactNode } from "react";

import { requireResponsiblePage } from "@/lib/b2b/current-responsible";
import LogoutButton from "@/components/b2b/LogoutButton";
import CompleteProfileForm from "@/components/b2b/CompleteProfileForm";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { bannerText, loadVendorAccess } from "@/lib/b2b/vendor-profile";

export const dynamic = "force-dynamic";

/** Área do vendedor: exige sessão B2B ativa em todas as páginas. */
export default async function B2BPanelLayout({ children }: { children: ReactNode }) {
  const responsible = await requireResponsiblePage();
  const access = await loadVendorAccess(getAppSqlRunner(), responsible.id);

  return (
    <div className="min-h-screen bg-[#fffaf6] text-[#422347]">
      <header className="border-b border-[#eadfd9] bg-white">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-3 px-5 py-4 lg:px-10">
          <Link href="/b2b/painel" className="leading-tight">
            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#9b6c24]">
              Bio Florais · Área comercial B2B
            </span>
            <span className="block text-lg font-extrabold text-[#55245f]">Meus clientes</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            {access.state !== "expired" && (
              <>
                <Link href="/b2b/painel" className="font-bold text-[#63326d] underline underline-offset-4">
                  Clientes
                </Link>
                <Link href="/b2b/painel/comissoes" className="font-bold text-[#63326d] underline underline-offset-4">
                  Minhas comissões
                </Link>
              </>
            )}
            <span className="font-semibold">{responsible.name}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      {access.state === "trial" && (
        <div className="sticky top-0 z-40 border-b border-amber-300 bg-amber-100 px-5 py-3 text-amber-950" role="status">
          <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold">{bannerText(access)}</p>
            <Link href="/b2b/painel/cadastro" className="rounded-full bg-[#55245f] px-5 py-2 text-sm font-extrabold text-white">
              Completar agora
            </Link>
          </div>
        </div>
      )}

      {/* Teste vencido sem cadastro completo: o painel mostra SÓ a tela de completar (os links dos clientes seguem funcionando). */}
      {access.state === "expired" ? (
        <CompleteProfileForm requiresRcaTerms={responsible.type === "rca"} expired bannerText={null} />
      ) : (
        children
      )}
    </div>
  );
}
